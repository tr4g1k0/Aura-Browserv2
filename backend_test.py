#!/usr/bin/env python3
"""
Aura Browser Text Selection Menu - Backend API Testing Suite
Tests the backend health endpoint required for the Text Selection Menu feature.
"""

import requests
import sys
import os
import json
from typing import Dict, Any, Optional
import time

# Get backend URL from frontend .env file
def get_backend_url() -> str:
    """Extract backend URL from frontend .env file"""
    try:
        with open('/app/frontend/.env', 'r') as f:
            for line in f:
                if line.startswith('EXPO_PUBLIC_BACKEND_URL='):
                    url = line.split('=', 1)[1].strip()
                    return url.rstrip('/') + '/api'
        
        # Fallback
        return 'https://aura-downloads.preview.emergentagent.com/api'
    except Exception as e:
        print(f"Error reading .env file: {e}")
        return 'https://aura-downloads.preview.emergentagent.com/api'

BACKEND_URL = get_backend_url()

class TestResults:
    def __init__(self):
        self.tests_run = 0
        self.tests_passed = 0
        self.tests_failed = 0
        self.failures = []
        
    def run_test(self, test_name: str, test_func):
        """Run a single test and track results"""
        self.tests_run += 1
        print(f"\n🧪 Testing: {test_name}")
        
        try:
            result = test_func()
            if result:
                print(f"✅ PASSED: {test_name}")
                self.tests_passed += 1
                return True
            else:
                print(f"❌ FAILED: {test_name}")
                self.tests_failed += 1
                self.failures.append(test_name)
                return False
        except Exception as e:
            print(f"❌ ERROR in {test_name}: {str(e)}")
            self.tests_failed += 1
            self.failures.append(f"{test_name} - {str(e)}")
            return False
    
    def print_summary(self):
        """Print test summary"""
        print(f"\n" + "="*60)
        print(f"🧪 BACKEND API TEST SUMMARY")
        print(f"="*60)
        print(f"Tests Run: {self.tests_run}")
        print(f"✅ Passed: {self.tests_passed}")
        print(f"❌ Failed: {self.tests_failed}")
        
        if self.failures:
            print(f"\n❌ FAILURES:")
            for failure in self.failures:
                print(f"  - {failure}")
        
        success_rate = (self.tests_passed / self.tests_run) * 100 if self.tests_run > 0 else 0
        print(f"\n📊 Success Rate: {success_rate:.1f}%")
        
        if self.tests_failed == 0:
            print(f"🎉 ALL TESTS PASSED! Backend is ready for Text Selection Menu feature.")
        else:
            print(f"⚠️  Some tests failed. Please fix issues before proceeding.")

# Test functions
def test_health_endpoint():
    """Test GET /api/health endpoint"""
    try:
        print(f"   URL: {BACKEND_URL}/health")
        response = requests.get(f"{BACKEND_URL}/health", timeout=10)
        
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print(f"   Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        print(f"   Response: {data}")
        
        # Verify response structure
        if not isinstance(data, dict):
            print(f"   Response is not a dictionary")
            return False
        
        if data.get('status') != 'healthy':
            print(f"   Expected status 'healthy', got '{data.get('status')}'")
            return False
        
        if data.get('service') != 'Aura Browser API':
            print(f"   Expected service 'Aura Browser API', got '{data.get('service')}'")
            return False
        
        print(f"   ✓ Health check returns correct status and service name")
        return True
        
    except requests.exceptions.RequestException as e:
        print(f"   Network error: {e}")
        return False
    except json.JSONDecodeError as e:
        print(f"   JSON decode error: {e}")
        return False

def run_backend_tests():
    """Run all backend API tests"""
    print(f"🚀 AURA BROWSER TEXT SELECTION MENU - BACKEND API TESTING")
    print(f"Backend URL: {BACKEND_URL}")
    print(f"="*60)
    
    results = TestResults()
    
    # Test the health endpoint (required for Text Selection Menu)
    results.run_test("Health Check Endpoint", test_health_endpoint)
    
    # Print summary
    results.print_summary()
    
    return results.tests_failed == 0

if __name__ == '__main__':
    success = run_backend_tests()
    sys.exit(0 if success else 1)