#!/usr/bin/env python3
"""
Backend API Testing Script for Aura Browser Settings
Tests backend health endpoint as specified in the review request.
"""

import requests
import time
import json
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
        
        # Verify expected response structure
        expected_fields = {'status', 'service'}
        if not expected_fields.issubset(data.keys()):
            return {
                "success": False,
                "error": f"Missing required fields. Expected {expected_fields}, got {set(data.keys())}",
                "response_time_ms": response_time,
                "response": data
            }
        
        # Verify status value
        if data.get('status') != 'healthy':
            return {
                "success": False,
                "error": f"Expected status 'healthy', got '{data.get('status')}'",
                "response_time_ms": response_time,
                "response": data
            }
        
        # Success case
        return {
            "success": True,
            "response_time_ms": response_time,
            "response": data
        }
        
    except requests.exceptions.RequestException as e:
        return {
            "success": False,
            "error": f"Request failed: {str(e)}",
            "response_time_ms": 0
        }

def main():
    """Run all backend tests for Aura Browser Settings."""
    print("🚀 AURA BROWSER SETTINGS BACKEND TESTING")
    print("=" * 50)
    
    # Test Health Endpoint
    print("\n📊 Testing Backend Health Endpoint...")
    print(f"URL: {BACKEND_URL}/api/health")
    
    health_result = test_health_endpoint()
    
    if health_result["success"]:
        print(f"✅ Health endpoint working correctly")
        print(f"   Response: {health_result['response']}")
        print(f"   Response time: {health_result['response_time_ms']}ms")
        success_count = 1
        total_count = 1
    else:
        print(f"❌ Health endpoint failed")
        print(f"   Error: {health_result['error']}")
        if 'response' in health_result:
            print(f"   Response: {health_result['response']}")
        print(f"   Response time: {health_result['response_time_ms']}ms")
        success_count = 0
        total_count = 1
    
    # Summary
    print("\n" + "=" * 50)
    print(f"📈 BACKEND TEST SUMMARY: {success_count}/{total_count} tests passed")
    
    if success_count == total_count:
        print("🎉 All backend tests PASSED!")
        return True
    else:
        print("💥 Some backend tests FAILED!")
        return False

if __name__ == "__main__":
    main()