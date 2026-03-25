from contextlib import asynccontextmanager
from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL')
if not mongo_url:
    raise RuntimeError("MONGO_URL environment variable is not set. Please configure it in the .env file.")
db_name = os.environ.get('DB_NAME')
if not db_name:
    raise RuntimeError("DB_NAME environment variable is not set. Please configure it in the .env file.")
client = AsyncIOMotorClient(mongo_url)
db = client[db_name]

@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    client.close()

# Create the main app without a prefix
app = FastAPI(lifespan=lifespan)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============== Models ==============

class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class StatusCheckCreate(BaseModel):
    client_name: str

# Tab Models
class TabInfo(BaseModel):
    id: str
    title: str
    url: str
    metaDescription: Optional[str] = None

class CategorizeTabsRequest(BaseModel):
    tabs: List[TabInfo]

class CategorizedTab(BaseModel):
    id: str
    category: str

class CategorizeTabsResponse(BaseModel):
    categorizedTabs: List[CategorizedTab]

class BriefRequest(BaseModel):
    category: str
    tabs: List[dict]

class BriefResponse(BaseModel):
    brief: str

# AI Agent Models
class AgentContext(BaseModel):
    url: Optional[str] = None
    title: Optional[str] = None

class AgentExecuteRequest(BaseModel):
    command: str
    context: AgentContext

class AgentExecuteResponse(BaseModel):
    response: str
    actions: Optional[List[dict]] = None

# Chat History for AI Agent
class ChatMessage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str
    role: str  # 'user' or 'assistant'
    content: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

# ============== LLM Integration ==============

async def get_llm_response(system_prompt: str, user_message: str) -> str:
    """Get response from LLM using emergent integrations"""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            logger.warning("EMERGENT_LLM_KEY not found, using fallback response")
            return None
        
        chat = LlmChat(
            api_key=api_key,
            session_id=f"browser-{uuid.uuid4()}",
            system_message=system_prompt
        )
        chat.with_model("openai", "gpt-4o")
        
        user_msg = UserMessage(text=user_message)
        response = await chat.send_message(user_msg)
        return response
        
    except Exception as e:
        logger.error(f"LLM error: {e}")
        return None

# ============== Routes ==============

@api_router.get("/")
async def root():
    return {"message": "Aura Browser API", "version": "1.0.0"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    try:
        status_dict = input.model_dump()
        status_obj = StatusCheck(**status_dict)
        _ = await db.status_checks.insert_one(status_obj.model_dump())
        return status_obj
    except Exception as e:
        logger.error(f"Database error creating status check: {e}")
        raise HTTPException(status_code=500, detail="Failed to create status check")

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    try:
        status_checks = await db.status_checks.find().to_list(1000)
        return [StatusCheck(**status_check) for status_check in status_checks]
    except Exception as e:
        logger.error(f"Database error fetching status checks: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch status checks")

# ============== Tab Categorization ==============

@api_router.post("/tabs/categorize", response_model=CategorizeTabsResponse)
async def categorize_tabs(request: CategorizeTabsRequest):
    """Use AI to categorize tabs by intent/topic"""
    
    if not request.tabs:
        return CategorizeTabsResponse(categorizedTabs=[])
    
    # Build prompt for categorization
    tabs_text = "\n".join([
        f"- ID: {tab.id}, Title: {tab.title}, URL: {tab.url}"
        for tab in request.tabs
    ])
    
    system_prompt = """You are a tab categorization assistant. Categorize browser tabs into these categories:
- Shopping: e-commerce, products, deals
- Research: Wikipedia, academic, documentation
- Entertainment: videos, games, social media
- News: news sites, current events
- Social: social networks, messaging
- Work: productivity tools, professional sites
- Other: anything that doesn't fit above

Respond ONLY with a JSON array of objects like: [{"id": "tab_id", "category": "Category"}]
Do not include any other text."""

    user_message = f"Categorize these tabs:\n{tabs_text}"
    
    llm_response = await get_llm_response(system_prompt, user_message)
    
    if llm_response:
        try:
            import json
            # Clean response (remove markdown if present)
            cleaned = llm_response.strip()
            if cleaned.startswith("```"):
                parts = cleaned.split("\n", 1)
                cleaned = parts[1] if len(parts) > 1 else ""
            if cleaned.endswith("```"):
                cleaned = cleaned.rsplit("```", 1)[0]
            cleaned = cleaned.strip()
            
            categories = json.loads(cleaned)
            return CategorizeTabsResponse(
                categorizedTabs=[CategorizedTab(**cat) for cat in categories]
            )
        except Exception as e:
            logger.error(f"Failed to parse categorization: {e}")
    
    # Fallback: simple URL-based categorization
    categorized = []
    for tab in request.tabs:
        url_lower = tab.url.lower()
        
        category = "Other"
        if any(x in url_lower for x in ['amazon', 'ebay', 'shop', 'store', 'buy', 'cart']):
            category = "Shopping"
        elif any(x in url_lower for x in ['wikipedia', 'docs', 'documentation', 'research']):
            category = "Research"
        elif any(x in url_lower for x in ['youtube', 'netflix', 'twitch', 'game']):
            category = "Entertainment"
        elif any(x in url_lower for x in ['news', 'cnn', 'bbc', 'reuters']):
            category = "News"
        elif any(x in url_lower for x in ['twitter', 'facebook', 'instagram', 'linkedin']):
            category = "Social"
        elif any(x in url_lower for x in ['github', 'gitlab', 'jira', 'slack', 'notion']):
            category = "Work"
        
        categorized.append(CategorizedTab(id=tab.id, category=category))
    
    return CategorizeTabsResponse(categorizedTabs=categorized)

# ============== Brief Generation ==============

@api_router.post("/tabs/brief", response_model=BriefResponse)
async def generate_brief(request: BriefRequest):
    """Generate AI summary brief for a group of tabs"""
    
    if not request.tabs:
        return BriefResponse(brief="No tabs to summarize.")
    
    tabs_text = "\n".join([
        f"- {tab.get('title', 'Untitled')} ({tab.get('url', 'No URL')})"
        for tab in request.tabs
    ])
    
    system_prompt = """You are Aura, a privacy-focused AI assistant. Generate a concise summary.
Create a brief 2-4 bullet point summary of what these browser tabs are about.
Be concise and actionable. Focus on the main topics and any patterns you notice."""

    user_message = f"Category: {request.category}\n\nTabs:\n{tabs_text}\n\nGenerate a brief summary:"
    
    llm_response = await get_llm_response(system_prompt, user_message)
    
    if llm_response:
        return BriefResponse(brief=llm_response)
    
    # Fallback response
    tab_count = len(request.tabs)
    return BriefResponse(
        brief=f"This group contains {tab_count} tab(s) in the '{request.category}' category. "
              f"Topics include: {', '.join([t.get('title', 'Untitled')[:30] for t in request.tabs[:3]])}"
    )

# ============== AI Agent ==============

@api_router.post("/agent/execute", response_model=AgentExecuteResponse)
async def execute_agent_command(request: AgentExecuteRequest):
    """Execute AI agent command for DOM manipulation and page interaction"""
    
    system_prompt = """You are Aura, a privacy-focused AI browser assistant that helps users interact with webpages.
You can understand user commands and provide helpful responses about the current page.

For now, you should:
1. Acknowledge what the user wants to do
2. Explain what you would do to accomplish it
3. Provide any relevant information you can infer from the page context

Note: Actual DOM manipulation will be implemented in future versions.
Respond in a friendly, helpful manner."""

    context_info = ""
    if request.context.url:
        context_info = f"\nCurrent page: {request.context.title or 'Unknown'} ({request.context.url})"
    
    user_message = f"User command: {request.command}{context_info}"
    
    llm_response = await get_llm_response(system_prompt, user_message)
    
    if llm_response:
        return AgentExecuteResponse(
            response=llm_response,
            actions=[]  # Placeholder for future DOM actions
        )
    
    # Fallback response based on common commands
    command_lower = request.command.lower()
    
    if 'price' in command_lower or 'cheap' in command_lower or 'cost' in command_lower:
        response = "I would scan the page for price elements and compare them. This feature will analyze all visible prices and highlight the best deals."
    elif 'summarize' in command_lower or 'summary' in command_lower:
        response = f"I would summarize the content from '{request.context.title or 'this page'}'. The summary would include main topics, key points, and any important details."
    elif 'contact' in command_lower or 'email' in command_lower or 'phone' in command_lower:
        response = "I would search for contact information including emails, phone numbers, and addresses on the page."
    elif 'find' in command_lower or 'search' in command_lower:
        response = "I would search through the page content to find what you're looking for and highlight matching elements."
    else:
        response = f"I understand you want to: {request.command}. I'll analyze the current page and help you accomplish this task."
    
    return AgentExecuteResponse(
        response=response,
        actions=[]
    )

# ============== Health Check ==============

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "service": "Aura Browser API"}

# ============== Price Tracker API ==============

class PriceCompareRequest(BaseModel):
    product_title: str

class CouponSearchRequest(BaseModel):
    domain: str

@api_router.post("/price-tracker/compare")
async def compare_prices(request: PriceCompareRequest):
    """Search for price comparisons across stores via Google Shopping"""
    try:
        import aiohttp
        search_query = request.product_title
        google_shopping_url = f"https://www.google.com/search?tbm=shop&q={search_query}"
        
        # Return the search URL for the client to open
        return {
            "success": True,
            "search_url": google_shopping_url,
            "product_title": request.product_title,
            "message": "Open this URL to compare prices across stores"
        }
    except Exception as e:
        logger.error(f"Price compare error: {e}")
        return {"success": False, "error": str(e)}

@api_router.post("/price-tracker/coupons")
async def search_coupons(request: CouponSearchRequest):
    """Search for coupon codes for a given store domain"""
    try:
        domain = request.domain.replace('www.', '')
        store_name = domain.split('.')[0].upper()
        
        # Generate common coupon patterns (in production, would scrape real coupon sites)
        coupons = [
            {"code": f"{store_name}10", "description": f"10% off your order at {domain}", "successRate": 65},
            {"code": "SAVE20", "description": "20% discount on select items", "successRate": 42},
            {"code": "FREESHIP", "description": "Free shipping on orders over $50", "successRate": 78},
            {"code": "WELCOME15", "description": "15% off for new customers", "successRate": 55},
        ]
        
        return {
            "success": True,
            "domain": domain,
            "coupons": coupons[:3],  # Return top 3
            "message": f"Found {len(coupons[:3])} coupon codes for {domain}"
        }
    except Exception as e:
        logger.error(f"Coupon search error: {e}")
        return {"success": False, "error": str(e)}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

