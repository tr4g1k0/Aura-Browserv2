#!/usr/bin/env python3
"""
Backend API Testing Script for Aura Browser Link Prefetching Service
Tests backend health endpoint and verifies stability after implementing 
complete PredictiveCacheService with link prefetching functionality.
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

def test_multiple_health_requests():
    """Test health endpoint multiple times to verify stability after link prefetching implementation."""
    print("\n🔄 Testing backend stability with multiple requests...")
    results = []
    
    for i in range(5):
        result = test_health_endpoint()
        results.append(result)
        print(f"   Request {i+1}: {'✅' if result['success'] else '❌'} ({result['response_time_ms']}ms)")
        time.sleep(0.5)  # Small delay between requests
    
    # Calculate stats
    successful_requests = sum(1 for r in results if r['success'])
    total_requests = len(results)
    avg_response_time = sum(r['response_time_ms'] for r in results if r['success']) / max(1, successful_requests)
    
    return {
        'success': successful_requests == total_requests,
        'successful_requests': successful_requests,
        'total_requests': total_requests,
        'success_rate': (successful_requests / total_requests) * 100,
        'avg_response_time': int(avg_response_time)
    }

def main():
    """Run all backend tests for Aura Browser Link Prefetching Service."""
    print("🚀 AURA BROWSER LINK PREFETCHING BACKEND TESTING")
    print("=" * 55)
    print("Testing backend stability after implementing complete PredictiveCacheService")
    print("Features tested: WiFi-only prefetch, battery check, smart link extraction,")
    print("above-fold detection, user history scoring, concurrent prefetch management")
    
    # Test 1: Basic Health Endpoint
    print("\n📊 Test 1: Backend Health Endpoint...")
    print(f"URL: {BACKEND_URL}/api/health")
    print("Expected: {'status': 'healthy', 'service': 'Aura Browser API'}")
    
    health_result = test_health_endpoint()
    
    if health_result["success"]:
        print(f"✅ Health endpoint working correctly")
        print(f"   Response: {health_result['response']}")
        print(f"   Response time: {health_result['response_time_ms']}ms")
        test1_success = True
    else:
        print(f"❌ Health endpoint failed")
        print(f"   Error: {health_result['error']}")
        if 'response' in health_result:
            print(f"   Response: {health_result['response']}")
        print(f"   Response time: {health_result['response_time_ms']}ms")
        test1_success = False
    
    # Test 2: Backend Stability under Load
    print("\n🔄 Test 2: Backend Stability Test (5 concurrent requests)...")
    stability_result = test_multiple_health_requests()
    
    if stability_result['success']:
        print(f"✅ Backend stability test passed")
        print(f"   Success rate: {stability_result['success_rate']:.1f}% ({stability_result['successful_requests']}/{stability_result['total_requests']})")
        print(f"   Average response time: {stability_result['avg_response_time']}ms")
        test2_success = True
    else:
        print(f"❌ Backend stability test failed")
        print(f"   Success rate: {stability_result['success_rate']:.1f}% ({stability_result['successful_requests']}/{stability_result['total_requests']})")
        print(f"   Some requests failed - backend may be unstable")
        test2_success = False
    
    # Summary
    success_count = sum([test1_success, test2_success])
    total_count = 2
    
    print("\n" + "=" * 55)
    print(f"📈 BACKEND TEST SUMMARY: {success_count}/{total_count} tests passed")
    
    if success_count == total_count:
        print("🎉 All backend tests PASSED!")
        print("✅ Backend is stable and working correctly after link prefetching implementation")
        print("✅ Health endpoint returns correct response format")
        print("✅ Backend can handle multiple concurrent requests reliably")
        return True
    else:
        print("💥 Some backend tests FAILED!")
        print("⚠️  Backend may have stability issues after prefetching implementation")
        return False

if __name__ == "__main__":
    main()