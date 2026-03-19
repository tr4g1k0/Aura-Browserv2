#!/usr/bin/env python3
"""
Backend API Testing for Aura Browser Image Context Menu Feature
Tests the health endpoint as specified in the review request.
"""

import requests
import sys
import os

# Get backend URL from environment
BACKEND_URL = None
frontend_env_path = '/app/frontend/.env'

if os.path.exists(frontend_env_path):
    with open(frontend_env_path, 'r') as f:
        for line in f:
            if line.startswith('EXPO_PUBLIC_BACKEND_URL='):
                BACKEND_URL = line.split('=', 1)[1].strip()
                break

if not BACKEND_URL:
    print("❌ EXPO_PUBLIC_BACKEND_URL not found in frontend/.env")
    sys.exit(1)

# Backend API base URL 
API_BASE_URL = f"{BACKEND_URL}/api"
print(f"🔗 Testing backend at: {API_BASE_URL}")

def test_health_endpoint():
    """Test GET /api/health endpoint"""
    try:
        response = requests.get(f"{API_BASE_URL}/health", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if (data.get('status') == 'healthy' and 
                data.get('service') == 'Aura Browser API'):
                print("✅ GET /api/health - Correct Aura Browser response")
                return True
            else:
                print(f"❌ GET /api/health - Unexpected response: {data}")
                return False
        else:
            print(f"❌ GET /api/health - Status {response.status_code}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ GET /api/health - Request failed: {e}")
        return False

def main():
    """Run backend API tests"""
    print("=" * 60)
    print("🧪 AURA BROWSER IMAGE CONTEXT MENU - BACKEND API TESTING")
    print("=" * 60)
    
    # Test backend endpoints
    health_result = test_health_endpoint()
    
    print("\n" + "=" * 60)
    print("📊 BACKEND TEST RESULTS:")
    print("=" * 60)
    
    total_tests = 1
    passed_tests = sum([health_result])
    
    print(f"✅ Health endpoint: {'PASS' if health_result else 'FAIL'}")
    print(f"\n🎯 Backend API Results: {passed_tests}/{total_tests} tests passed")
    
    if passed_tests == total_tests:
        print("🎉 All backend API tests PASSED")
        return 0
    else:
        print("❌ Some backend API tests FAILED")
        return 1

if __name__ == "__main__":
    sys.exit(main())