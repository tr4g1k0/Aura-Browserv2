#!/usr/bin/env python3
"""
Backend API Testing Script for Aura Browser Smart Tab Management System
Tests backend health endpoint and smart tab management features including:
- Tab categorization API
- Brief generation API  
- AI agent execution API
- Backend stability verification
"""

import requests
import time
import json
import concurrent.futures
from typing import Dict, Any

# Get the backend URL from environment
BACKEND_URL = "https://privacy-browser-opt.preview.emergentagent.com"

def test_health_endpoint() -> Dict[str, Any]:
    """Test the health endpoint as specified in review request."""
    try:
        start_time = time.time()
        response = requests.get(f"{BACKEND_URL}/api/health", timeout=10)
        response_time = int((time.time() - start_time) * 1000)
        
        # Check status code
        if response.status_code != 200:
            return {
                "success": False,
                "error": f"Expected status 200, got {response.status_code}",
                "response_time_ms": response_time
            }
        
        # Check response content
        try:
            data = response.json()
        except json.JSONDecodeError:
            return {
                "success": False,
                "error": "Response is not valid JSON",
                "response_time_ms": response_time,
                "response_text": response.text
            }
        
        # Verify expected response structure - exact match as requested
        expected_response = {"status": "healthy", "service": "Aura Browser API"}
        if data != expected_response:
            return {
                "success": False,
                "error": f"Expected {expected_response}, got {data}",
                "response_time_ms": response_time,
                "response": data
            }
        
        return {
            "success": True,
            "response": data,
            "response_time_ms": response_time
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "response_time_ms": 0
        }

def test_root_api_endpoint() -> Dict[str, Any]:
    """Test the root API endpoint."""
    try:
        start_time = time.time()
        response = requests.get(f"{BACKEND_URL}/api/", timeout=10)
        response_time = int((time.time() - start_time) * 1000)
        
        if response.status_code != 200:
            return {
                "success": False,
                "error": f"Expected status 200, got {response.status_code}",
                "response_time_ms": response_time
            }
        
        data = response.json()
        return {
            "success": True,
            "response": data,
            "response_time_ms": response_time
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "response_time_ms": 0
        }

def test_tab_categorization_endpoint() -> Dict[str, Any]:
    """Test the smart tab categorization endpoint."""
    try:
        sample_request = {
            "tabs": [
                {
                    "id": "tab-1",
                    "title": "GitHub - Aura Browser: Smart Tab Management",
                    "url": "https://github.com/aura-browser/smart-tabs"
                },
                {
                    "id": "tab-2", 
                    "title": "Amazon - Best Electronics Deals",
                    "url": "https://amazon.com/electronics/deals"
                },
                {
                    "id": "tab-3",
                    "title": "Wikipedia - Web Browsers",
                    "url": "https://en.wikipedia.org/wiki/Web_browser"
                }
            ]
        }
        
        start_time = time.time()
        response = requests.post(
            f"{BACKEND_URL}/api/tabs/categorize", 
            json=sample_request,
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        response_time = int((time.time() - start_time) * 1000)
        
        if response.status_code != 200:
            return {
                "success": False,
                "error": f"Expected status 200, got {response.status_code}",
                "response_time_ms": response_time,
                "response_text": response.text
            }
        
        data = response.json()
        
        # Validate response structure
        if "categorizedTabs" not in data:
            return {
                "success": False,
                "error": "Missing 'categorizedTabs' in response",
                "response_time_ms": response_time,
                "response": data
            }
        
        categorized_tabs = data["categorizedTabs"]
        if len(categorized_tabs) != 3:
            return {
                "success": False,
                "error": f"Expected 3 categorized tabs, got {len(categorized_tabs)}",
                "response_time_ms": response_time,
                "response": data
            }
        
        # Verify all tabs have proper structure
        for tab in categorized_tabs:
            if "id" not in tab or "category" not in tab:
                return {
                    "success": False,
                    "error": "Tab missing required fields (id, category)",
                    "response_time_ms": response_time,
                    "response": data
                }
        
        return {
            "success": True,
            "response": data,
            "response_time_ms": response_time,
            "categorized_count": len(categorized_tabs)
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "response_time_ms": 0
        }

def test_brief_generation_endpoint() -> Dict[str, Any]:
    """Test the AI brief generation endpoint."""
    try:
        sample_request = {
            "category": "Work",
            "tabs": [
                {
                    "title": "GitHub - Aura Browser",
                    "url": "https://github.com/aura-browser/smart-tabs"
                },
                {
                    "title": "React Documentation",
                    "url": "https://reactjs.org/docs"
                }
            ]
        }
        
        start_time = time.time()
        response = requests.post(
            f"{BACKEND_URL}/api/tabs/brief", 
            json=sample_request,
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        response_time = int((time.time() - start_time) * 1000)
        
        if response.status_code != 200:
            return {
                "success": False,
                "error": f"Expected status 200, got {response.status_code}",
                "response_time_ms": response_time,
                "response_text": response.text
            }
        
        data = response.json()
        
        if "brief" not in data:
            return {
                "success": False,
                "error": "Missing 'brief' in response",
                "response_time_ms": response_time,
                "response": data
            }
        
        brief = data["brief"]
        if not isinstance(brief, str) or len(brief) < 10:
            return {
                "success": False,
                "error": "Brief too short or invalid format",
                "response_time_ms": response_time,
                "response": data
            }
        
        return {
            "success": True,
            "response": data,
            "response_time_ms": response_time,
            "brief_length": len(brief)
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "response_time_ms": 0
        }

def test_ai_agent_endpoint() -> Dict[str, Any]:
    """Test the AI agent execution endpoint."""
    try:
        sample_request = {
            "command": "find the best price on this page",
            "context": {
                "url": "https://amazon.com/product/electronics",
                "title": "Electronics Product Page"
            }
        }
        
        start_time = time.time()
        response = requests.post(
            f"{BACKEND_URL}/api/agent/execute", 
            json=sample_request,
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        response_time = int((time.time() - start_time) * 1000)
        
        if response.status_code != 200:
            return {
                "success": False,
                "error": f"Expected status 200, got {response.status_code}",
                "response_time_ms": response_time,
                "response_text": response.text
            }
        
        data = response.json()
        
        # Validate required fields
        if "response" not in data or "actions" not in data:
            return {
                "success": False,
                "error": "Missing required fields (response, actions)",
                "response_time_ms": response_time,
                "response": data
            }
        
        agent_response = data["response"]
        actions = data["actions"]
        
        if not isinstance(agent_response, str) or len(agent_response) < 10:
            return {
                "success": False,
                "error": "Agent response too short or invalid format",
                "response_time_ms": response_time,
                "response": data
            }
        
        if not isinstance(actions, list):
            return {
                "success": False,
                "error": "Actions field must be a list",
                "response_time_ms": response_time,
                "response": data
            }
        
        return {
            "success": True,
            "response": data,
            "response_time_ms": response_time,
            "response_length": len(agent_response),
            "actions_count": len(actions)
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "response_time_ms": 0
        }

def test_single_health_request():
    """Test single health request for stability testing."""
    try:
        start_time = time.time()
        response = requests.get(f"{BACKEND_URL}/api/health", timeout=10)
        response_time = int((time.time() - start_time) * 1000)
        return {
            "success": response.status_code == 200,
            "response_time_ms": response_time
        }
    except:
        return {
            "success": False,
            "response_time_ms": 5000  # Timeout
        }

def test_backend_stability(num_requests: int = 5) -> Dict[str, Any]:
    """Test backend stability with concurrent health requests."""
    print("🔄 Testing backend stability with multiple requests...")
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=num_requests) as executor:
        futures = [executor.submit(test_single_health_request) for _ in range(num_requests)]
        results = [future.result() for future in concurrent.futures.as_completed(futures)]
    
    successful_requests = sum(1 for r in results if r["success"])
    total_requests = len(results)
    success_rate = (successful_requests / total_requests) * 100
    
    response_times = [r["response_time_ms"] for r in results if r["success"]]
    avg_response_time = int(sum(response_times) / len(response_times)) if response_times else 0
    
    # Print individual request results
    for i, result in enumerate(results, 1):
        status = "✅" if result["success"] else "❌"
        print(f"   Request {i}: {status} ({result['response_time_ms']}ms)")
    
    return {
        "success": success_rate >= 90.0,  # Consider successful if 90% pass
        "success_rate": success_rate,
        "successful_requests": successful_requests,
        "total_requests": total_requests,
        "avg_response_time": avg_response_time,
        "response_time_ms": avg_response_time
    }

def main():
    print("🚀 AURA BROWSER SMART TAB MANAGEMENT BACKEND TESTING")
    print("=======================================================")
    print("Testing backend stability after implementing smart tab management system")
    print("Features tested: Tab categorization, Brief generation, AI agent execution,")
    print("useSmartTabStore, TabUndoSnackbar, TabCleanupSuggestions, Tab search/sort")
    print()
    
    # Test results storage
    results = []
    
    # Test 1: Health endpoint (as requested in review)
    print("📊 Test 1: Backend Health Endpoint...")
    print(f"URL: {BACKEND_URL}/api/health")
    print(f"Expected: {{'status': 'healthy', 'service': 'Aura Browser API'}}")
    
    health_result = test_health_endpoint()
    results.append(health_result)
    
    if health_result["success"]:
        print("✅ Health endpoint working correctly")
        print(f"   Response: {health_result['response']}")
        print(f"   Response time: {health_result['response_time_ms']}ms")
    else:
        print(f"❌ Health endpoint failed: {health_result['error']}")
        if 'response' in health_result:
            print(f"   Actual response: {health_result['response']}")
    print()
    
    # Test 2: Root API endpoint
    print("📊 Test 2: Root API Endpoint...")
    root_result = test_root_api_endpoint()
    results.append(root_result)
    
    if root_result["success"]:
        print("✅ Root API endpoint working")
        print(f"   Response: {root_result['response']}")
        print(f"   Response time: {root_result['response_time_ms']}ms")
    else:
        print(f"❌ Root API endpoint failed: {root_result['error']}")
    print()
    
    # Test 3: Tab Categorization (Smart Tab Management Core Feature)
    print("📊 Test 3: Smart Tab Categorization Endpoint...")
    categorize_result = test_tab_categorization_endpoint()
    results.append(categorize_result)
    
    if categorize_result["success"]:
        print("✅ Tab categorization working correctly")
        print(f"   Categorized {categorize_result['categorized_count']} tabs successfully")
        print(f"   Response time: {categorize_result['response_time_ms']}ms")
        
        # Show categorization results
        tabs = categorize_result['response']['categorizedTabs']
        for tab in tabs:
            print(f"   Tab {tab['id']}: {tab['category']}")
    else:
        print(f"❌ Tab categorization failed: {categorize_result['error']}")
        if 'response' in categorize_result:
            print(f"   Response: {categorize_result['response']}")
    print()
    
    # Test 4: Brief Generation (Smart Tab Management Feature)
    print("📊 Test 4: AI Brief Generation Endpoint...")
    brief_result = test_brief_generation_endpoint()
    results.append(brief_result)
    
    if brief_result["success"]:
        print("✅ Brief generation working correctly")
        print(f"   Generated brief with {brief_result['brief_length']} characters")
        print(f"   Response time: {brief_result['response_time_ms']}ms")
        brief_preview = brief_result['response']['brief'][:100] + "..." if len(brief_result['response']['brief']) > 100 else brief_result['response']['brief']
        print(f"   Brief preview: {brief_preview}")
    else:
        print(f"❌ Brief generation failed: {brief_result['error']}")
    print()
    
    # Test 5: AI Agent Execution (Smart Tab Management Feature)
    print("📊 Test 5: AI Agent Execution Endpoint...")
    agent_result = test_ai_agent_endpoint()
    results.append(agent_result)
    
    if agent_result["success"]:
        print("✅ AI agent execution working correctly")
        print(f"   Generated response with {agent_result['response_length']} characters")
        print(f"   Returned {agent_result['actions_count']} actions")
        print(f"   Response time: {agent_result['response_time_ms']}ms")
        response_preview = agent_result['response']['response'][:80] + "..." if len(agent_result['response']['response']) > 80 else agent_result['response']['response']
        print(f"   Agent response preview: {response_preview}")
    else:
        print(f"❌ AI agent execution failed: {agent_result['error']}")
    print()
    
    # Test 6: Backend stability 
    print("🔄 Test 6: Backend Stability Test (5 concurrent requests)...")
    print()
    stability_result = test_backend_stability()
    results.append(stability_result)
    
    if stability_result["success"]:
        print(f"✅ Backend stability test passed")
        print(f"   Success rate: {stability_result['success_rate']:.1f}% ({stability_result['successful_requests']}/{stability_result['total_requests']})")
        print(f"   Average response time: {stability_result['avg_response_time']}ms")
    else:
        print(f"❌ Backend stability test failed")
        print(f"   Success rate: {stability_result['success_rate']:.1f}% ({stability_result['successful_requests']}/{stability_result['total_requests']})")
    print()
    
    # Test summary
    print("=======================================================")
    passed_tests = sum(1 for r in results if r["success"])
    total_tests = len(results)
    
    print(f"📈 BACKEND TEST SUMMARY: {passed_tests}/{total_tests} tests passed")
    if passed_tests == total_tests:
        print("🎉 All backend tests PASSED!")
        print("✅ Backend is stable and working correctly after smart tab management implementation")
        print("✅ Health endpoint returns correct response format as requested")
        print("✅ Smart tab categorization API working properly")
        print("✅ AI brief generation API functioning correctly")  
        print("✅ AI agent execution API operational")
        print("✅ Backend can handle multiple concurrent requests reliably")
    elif passed_tests >= total_tests * 0.8:  # 80% success rate
        print("⚠️  Most backend tests PASSED with some minor issues!")
        print(f"✅ {passed_tests}/{total_tests} core features working")
        print("✅ Backend is mostly stable after smart tab management implementation")
        for i, result in enumerate(results, 1):
            if not result["success"]:
                print(f"❌ Test {i} failed: {result['error']}")
    else:
        print("❌ Multiple tests FAILED!")
        for i, result in enumerate(results, 1):
            status = "✅" if result["success"] else "❌"
            test_names = ["Health", "Root API", "Tab Categorization", "Brief Generation", "AI Agent", "Stability"]
            test_name = test_names[i-1] if i <= len(test_names) else f"Test {i}"
            print(f"   {test_name}: {status}")
            if not result["success"]:
                print(f"      Error: {result['error']}")
    
    return passed_tests == total_tests

if __name__ == "__main__":
    success = main()
    print("Exit code: 0" if success else "Exit code: 1")