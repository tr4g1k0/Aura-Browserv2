#!/usr/bin/env python3
"""
Backend API Testing for Aura Browser - Aura Action Pill Feature
Tests the backend health endpoint as required by the Aura Action Pill implementation
"""

import requests
import json
import sys
from typing import Dict, Any

# Backend URL from environment
BACKEND_URL = "https://aura-downloads.preview.emergentagent.com"

def test_health_endpoint():
    """Test GET /api/health endpoint"""
    try:
        print(f"🔍 Testing GET {BACKEND_URL}/api/health...")
        response = requests.get(f"{BACKEND_URL}/api/health", timeout=10)
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            
            # Verify expected response structure for Aura Browser
            if data.get('status') == 'healthy' and 'Aura Browser' in data.get('service', ''):
                print("✅ Health endpoint working correctly")
                return True
            else:
                print(f"❌ Unexpected response format. Expected status='healthy' and service containing 'Aura Browser'")
                return False
        else:
            print(f"❌ Health endpoint failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Network error testing health endpoint: {e}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error testing health endpoint: {e}")
        return False

def run_backend_tests():
    """Run all backend tests"""
    print("🚀 Starting Aura Browser Backend API Tests")
    print("=" * 60)
    
    results = {
        'health_endpoint': test_health_endpoint()
    }
    
    print("\n" + "=" * 60)
    print("📊 TEST RESULTS SUMMARY:")
    
    passed = 0
    total = len(results)
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{test_name}: {status}")
        if result:
            passed += 1
    
    success_rate = (passed / total) * 100
    print(f"\nSuccess Rate: {passed}/{total} ({success_rate:.0f}%)")
    
    if passed == total:
        print("🎉 ALL BACKEND TESTS PASSED!")
        return True
    else:
        print("⚠️ SOME BACKEND TESTS FAILED!")
        return False

if __name__ == "__main__":
    success = run_backend_tests()
    sys.exit(0 if success else 1)