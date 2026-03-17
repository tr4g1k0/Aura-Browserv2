#!/usr/bin/env python3

import requests
import json
import sys
import uuid
from typing import Dict, List, Any

# Get backend URL from frontend config
BACKEND_BASE_URL = "https://access-browser.preview.emergentagent.com/api"

class BackendTester:
    def __init__(self):
        self.results = []
        self.session = requests.Session()
        self.session.timeout = 30
        
    def log_result(self, test_name: str, success: bool, details: str, response_data: Any = None):
        """Log test result"""
        result = {
            "test": test_name,
            "success": success,
            "details": details,
            "response_data": response_data
        }
        self.results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {details}")
        if response_data and not success:
            print(f"   Response: {json.dumps(response_data, indent=2)}")
        print()

    def test_health_endpoint(self):
        """Test GET /api/health"""
        try:
            response = self.session.get(f"{BACKEND_BASE_URL}/health")
            
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "healthy" and "service" in data:
                    self.log_result("Health Check", True, f"Status: {data.get('status')}, Service: {data.get('service')}", data)
                else:
                    self.log_result("Health Check", False, "Invalid response format", data)
            else:
                self.log_result("Health Check", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("Health Check", False, f"Exception: {str(e)}")

    def test_tab_categorization(self):
        """Test POST /api/tabs/categorize"""
        try:
            # Prepare test data with various types of tabs
            test_tabs = [
                {
                    "id": str(uuid.uuid4()),
                    "title": "Amazon - iPhone 15 Pro",
                    "url": "https://amazon.com/iphone-15-pro",
                    "metaDescription": "Buy the latest iPhone 15 Pro"
                },
                {
                    "id": str(uuid.uuid4()),
                    "title": "CNN Breaking News",
                    "url": "https://cnn.com/news/breaking",
                    "metaDescription": "Latest breaking news"
                },
                {
                    "id": str(uuid.uuid4()),
                    "title": "Wikipedia - Machine Learning",
                    "url": "https://wikipedia.org/wiki/machine_learning",
                    "metaDescription": "Article about machine learning"
                },
                {
                    "id": str(uuid.uuid4()),
                    "title": "YouTube - Funny Videos",
                    "url": "https://youtube.com/watch?v=funny",
                    "metaDescription": "Entertainment videos"
                },
                {
                    "id": str(uuid.uuid4()),
                    "title": "GitHub - React Project",
                    "url": "https://github.com/user/react-project",
                    "metaDescription": "Open source React project"
                }
            ]
            
            payload = {"tabs": test_tabs}
            response = self.session.post(
                f"{BACKEND_BASE_URL}/tabs/categorize",
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                if "categorizedTabs" in data and isinstance(data["categorizedTabs"], list):
                    categorized = data["categorizedTabs"]
                    if len(categorized) == len(test_tabs):
                        # Check if all tabs have valid categories
                        valid_categories = ["Shopping", "Research", "Entertainment", "News", "Social", "Work", "Other"]
                        all_valid = all(
                            tab.get("category") in valid_categories and "id" in tab
                            for tab in categorized
                        )
                        
                        if all_valid:
                            category_summary = {}
                            for tab in categorized:
                                cat = tab["category"]
                                category_summary[cat] = category_summary.get(cat, 0) + 1
                                
                            self.log_result(
                                "Tab Categorization", 
                                True, 
                                f"Successfully categorized {len(categorized)} tabs. Categories: {dict(category_summary)}", 
                                data
                            )
                        else:
                            self.log_result("Tab Categorization", False, "Invalid categories or missing IDs", data)
                    else:
                        self.log_result("Tab Categorization", False, f"Expected {len(test_tabs)} results, got {len(categorized)}", data)
                else:
                    self.log_result("Tab Categorization", False, "Invalid response format - missing categorizedTabs", data)
            else:
                self.log_result("Tab Categorization", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("Tab Categorization", False, f"Exception: {str(e)}")

    def test_brief_generation(self):
        """Test POST /api/tabs/brief"""
        try:
            # Test with shopping category tabs
            test_tabs = [
                {"title": "iPhone 15 Pro Max", "url": "https://apple.com/iphone-15-pro"},
                {"title": "Samsung Galaxy S24", "url": "https://samsung.com/galaxy-s24"},
                {"title": "Best Phone Deals 2024", "url": "https://techradar.com/deals/phones"}
            ]
            
            payload = {
                "category": "Shopping",
                "tabs": test_tabs
            }
            
            response = self.session.post(
                f"{BACKEND_BASE_URL}/tabs/brief",
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                if "brief" in data and isinstance(data["brief"], str) and len(data["brief"]) > 10:
                    brief_content = data["brief"]
                    # Check if brief mentions relevant content
                    contains_relevant = any(word in brief_content.lower() for word in ["phone", "shopping", "deals", "samsung", "iphone"])
                    
                    if contains_relevant:
                        self.log_result(
                            "Brief Generation", 
                            True, 
                            f"Generated brief with {len(brief_content)} characters containing relevant content", 
                            {"brief_preview": brief_content[:100] + "..." if len(brief_content) > 100 else brief_content}
                        )
                    else:
                        self.log_result("Brief Generation", False, "Brief doesn't contain relevant content", data)
                else:
                    self.log_result("Brief Generation", False, "Invalid response format or empty brief", data)
            else:
                self.log_result("Brief Generation", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("Brief Generation", False, f"Exception: {str(e)}")

    def test_agent_execute(self):
        """Test POST /api/agent/execute"""
        try:
            # Test with various command types
            test_commands = [
                {
                    "command": "Find the cheapest item on this page",
                    "context": {
                        "url": "https://amazon.com/electronics",
                        "title": "Amazon Electronics"
                    },
                    "expected_keywords": ["price", "cheap", "cost", "scan", "analyze"]
                },
                {
                    "command": "Summarize this article",
                    "context": {
                        "url": "https://techcrunch.com/ai-news",
                        "title": "Latest AI News - TechCrunch"
                    },
                    "expected_keywords": ["summary", "summarize", "content", "main", "key"]
                },
                {
                    "command": "Find contact information",
                    "context": {
                        "url": "https://company.com/about",
                        "title": "About Us - Company"
                    },
                    "expected_keywords": ["contact", "email", "phone", "search", "address"]
                }
            ]
            
            all_passed = True
            command_results = []
            
            for test_cmd in test_commands:
                payload = {
                    "command": test_cmd["command"],
                    "context": test_cmd["context"]
                }
                
                response = self.session.post(
                    f"{BACKEND_BASE_URL}/agent/execute",
                    json=payload,
                    headers={"Content-Type": "application/json"}
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if "response" in data and isinstance(data["response"], str) and len(data["response"]) > 10:
                        agent_response = data["response"].lower()
                        
                        # Check if response contains expected keywords for the command type
                        contains_expected = any(keyword in agent_response for keyword in test_cmd["expected_keywords"])
                        
                        if contains_expected:
                            command_results.append(f"✓ '{test_cmd['command']}' - Relevant response")
                        else:
                            command_results.append(f"✗ '{test_cmd['command']}' - Generic response")
                            all_passed = False
                    else:
                        command_results.append(f"✗ '{test_cmd['command']}' - Invalid response format")
                        all_passed = False
                else:
                    command_results.append(f"✗ '{test_cmd['command']}' - HTTP {response.status_code}")
                    all_passed = False
            
            if all_passed:
                self.log_result(
                    "AI Agent Execute", 
                    True, 
                    f"All {len(test_commands)} commands executed successfully", 
                    {"command_results": command_results}
                )
            else:
                self.log_result(
                    "AI Agent Execute", 
                    False, 
                    f"Some commands failed", 
                    {"command_results": command_results}
                )
                
        except Exception as e:
            self.log_result("AI Agent Execute", False, f"Exception: {str(e)}")

    def test_additional_endpoints(self):
        """Test additional endpoints found in the backend"""
        try:
            # Test root endpoint
            response = self.session.get(f"{BACKEND_BASE_URL}/")
            if response.status_code == 200:
                data = response.json()
                if "message" in data and "version" in data:
                    self.log_result("Root Endpoint", True, f"Message: {data.get('message')}, Version: {data.get('version')}")
                else:
                    self.log_result("Root Endpoint", False, "Invalid response format", data)
            else:
                self.log_result("Root Endpoint", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("Root Endpoint", False, f"Exception: {str(e)}")

    def run_all_tests(self):
        """Run all backend tests"""
        print(f"🚀 Starting ACCESS Browser Backend API Tests")
        print(f"Backend URL: {BACKEND_BASE_URL}")
        print("=" * 60)
        
        # Run all tests
        self.test_health_endpoint()
        self.test_tab_categorization()
        self.test_brief_generation()
        self.test_agent_execute()
        self.test_additional_endpoints()
        
        # Summary
        print("=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for r in self.results if r["success"])
        failed = len(self.results) - passed
        
        print(f"Total Tests: {len(self.results)}")
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {failed}")
        print(f"Success Rate: {(passed/len(self.results)*100):.1f}%")
        
        if failed > 0:
            print("\n🔍 FAILED TESTS:")
            for result in self.results:
                if not result["success"]:
                    print(f"  • {result['test']}: {result['details']}")
        
        return failed == 0

if __name__ == "__main__":
    tester = BackendTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)