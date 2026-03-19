#!/usr/bin/env python3

import requests
import time
import sys

def test_backend_health():
    """Test the Aura Browser API health endpoint"""
    
    # Use the same backend URL from frontend env
    backend_url = "https://browser-preview-2.preview.emergentagent.com/api"
    
    print("=" * 60)
    print("🔍 AURA BROWSER BACKEND TESTING")
    print("=" * 60)
    
    try:
        print(f"📡 Testing Backend Health Endpoint...")
        print(f"🌐 URL: {backend_url}/health")
        
        start_time = time.time()
        response = requests.get(f"{backend_url}/health", timeout=10)
        response_time = round((time.time() - start_time) * 1000)
        
        print(f"⏱️  Response Time: {response_time}ms")
        print(f"📊 Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Response Data: {data}")
            
            # Verify expected response structure
            if data.get("status") == "healthy" and data.get("service") == "Aura Browser API":
                print(f"✅ HEALTH CHECK PASSED")
                print(f"✅ Backend API is responding correctly")
                return True
            else:
                print(f"❌ HEALTH CHECK FAILED - Unexpected response format")
                return False
        else:
            print(f"❌ HEALTH CHECK FAILED - Status code: {response.status_code}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ HEALTH CHECK FAILED - Network error: {e}")
        return False
    except Exception as e:
        print(f"❌ HEALTH CHECK FAILED - Error: {e}")
        return False

def main():
    print("Starting Aura Browser Bottom Bar Fixes Testing...")
    
    # Test backend health
    health_passed = test_backend_health()
    
    print("\n" + "=" * 60)
    print("📋 BACKEND TEST SUMMARY")
    print("=" * 60)
    
    if health_passed:
        print("✅ Backend Health Endpoint: WORKING")
        print("✅ All backend tests passed!")
        return True
    else:
        print("❌ Backend Health Endpoint: FAILED")
        print("❌ Backend tests failed!")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)