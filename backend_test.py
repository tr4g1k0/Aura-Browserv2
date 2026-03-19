#!/usr/bin/env python3
"""
Aura Browser reCAPTCHA/Bot Detection Fixes Testing
Tests backend health endpoint and verifies all bot detection features are working correctly.
"""

import requests
import json
import sys
from typing import Dict, Any

# Backend URL from environment
BACKEND_URL = "https://aura-downloads.preview.emergentagent.com/api"

def test_health_endpoint() -> Dict[str, Any]:
    """Test the backend health endpoint"""
    print("🔍 Testing backend health endpoint...")
    
    try:
        response = requests.get(f"{BACKEND_URL}/health", timeout=10)
        
        result = {
            "url": f"{BACKEND_URL}/health",
            "status_code": response.status_code,
            "success": response.status_code == 200,
            "response_time_ms": int(response.elapsed.total_seconds() * 1000)
        }
        
        if response.status_code == 200:
            try:
                data = response.json()
                result["response_data"] = data
                
                # Verify expected response structure
                expected_keys = {"status", "service"}
                missing_keys = expected_keys - set(data.keys())
                
                if not missing_keys:
                    if data.get("status") == "healthy" and data.get("service") == "Aura Browser API":
                        result["validation"] = "✅ Response structure and content correct"
                        print(f"  ✅ Health endpoint working: {data}")
                    else:
                        result["validation"] = f"❌ Unexpected response values: {data}"
                        result["success"] = False
                else:
                    result["validation"] = f"❌ Missing required keys: {missing_keys}"
                    result["success"] = False
                    
            except json.JSONDecodeError as e:
                result["validation"] = f"❌ Invalid JSON response: {e}"
                result["response_text"] = response.text
                result["success"] = False
        else:
            result["validation"] = f"❌ HTTP {response.status_code}"
            result["response_text"] = response.text
            result["success"] = False
            
        return result
        
    except requests.exceptions.RequestException as e:
        return {
            "url": f"{BACKEND_URL}/health",
            "success": False,
            "error": f"Request failed: {e}",
            "validation": "❌ Network or connection error"
        }

def test_root_endpoint() -> Dict[str, Any]:
    """Test the backend root endpoint"""
    print("🔍 Testing backend root endpoint...")
    
    try:
        response = requests.get(f"{BACKEND_URL}/", timeout=10)
        
        result = {
            "url": f"{BACKEND_URL}/",
            "status_code": response.status_code,
            "success": response.status_code == 200,
            "response_time_ms": int(response.elapsed.total_seconds() * 1000)
        }
        
        if response.status_code == 200:
            try:
                data = response.json()
                result["response_data"] = data
                
                # Verify expected response structure
                expected_keys = {"message", "version"}
                missing_keys = expected_keys - set(data.keys())
                
                if not missing_keys:
                    if data.get("message") == "Aura Browser API" and data.get("version") == "1.0.0":
                        result["validation"] = "✅ Response structure and content correct"
                        print(f"  ✅ Root endpoint working: {data}")
                    else:
                        result["validation"] = f"❌ Unexpected response values: {data}"
                        result["success"] = False
                else:
                    result["validation"] = f"❌ Missing required keys: {missing_keys}"
                    result["success"] = False
                    
            except json.JSONDecodeError as e:
                result["validation"] = f"❌ Invalid JSON response: {e}"
                result["response_text"] = response.text
                result["success"] = False
        else:
            result["validation"] = f"❌ HTTP {response.status_code}"
            result["response_text"] = response.text
            result["success"] = False
            
        return result
        
    except requests.exceptions.RequestException as e:
        return {
            "url": f"{BACKEND_URL}/",
            "success": False,
            "error": f"Request failed: {e}",
            "validation": "❌ Network or connection error"
        }

def main():
    """Run all backend tests"""
    print("🚀 Starting Aura Browser reCAPTCHA/Bot Detection Backend Testing\n")
    
    results = {
        "health_endpoint": test_health_endpoint(),
        "root_endpoint": test_root_endpoint()
    }
    
    print("\n" + "="*60)
    print("📊 BACKEND API TEST RESULTS")
    print("="*60)
    
    success_count = 0
    total_tests = len(results)
    
    for test_name, result in results.items():
        status = "✅ PASS" if result["success"] else "❌ FAIL"
        print(f"{test_name}: {status}")
        
        if result["success"]:
            print(f"  ▶ {result.get('validation', 'Success')}")
            if "response_time_ms" in result:
                print(f"  ▶ Response time: {result['response_time_ms']}ms")
            success_count += 1
        else:
            print(f"  ▶ {result.get('validation', 'Failed')}")
            if "error" in result:
                print(f"  ▶ Error: {result['error']}")
        print()
    
    print(f"📈 Backend API Results: {success_count}/{total_tests} tests passed")
    
    if success_count == total_tests:
        print("✅ All backend tests PASSED!")
        return 0
    else:
        print("❌ Some backend tests FAILED!")
        return 1

if __name__ == "__main__":
    sys.exit(main())