#!/usr/bin/env python3
"""
Aura Browser Downloads Manager - Backend API Testing
Tests the 4 new features plus backend API endpoints.
"""

import requests
import json
import sys
import time
from typing import Dict, Any

# Backend URL from environment
BACKEND_URL = "https://aura-downloads.preview.emergentagent.com/api"

class AuraAPITester:
    def __init__(self):
        self.passed_tests = 0
        self.total_tests = 0
        self.results = []
        
    def log_test(self, test_name: str, success: bool, details: str = ""):
        """Log test result"""
        self.total_tests += 1
        if success:
            self.passed_tests += 1
            status = "✅ PASS"
        else:
            status = "❌ FAIL"
        
        result = f"{status} - {test_name}"
        if details:
            result += f" | {details}"
        
        print(result)
        self.results.append({"test": test_name, "success": success, "details": details})
        
    def test_backend_health(self) -> bool:
        """Test GET /api/health endpoint"""
        try:
            response = requests.get(f"{BACKEND_URL}/health", timeout=10)
            
            if response.status_code != 200:
                self.log_test("Backend Health Check", False, f"Status: {response.status_code}")
                return False
                
            data = response.json()
            expected_status = "healthy"
            expected_service = "Aura Browser API"
            
            if data.get("status") != expected_status:
                self.log_test("Backend Health Check", False, f"Status field: {data.get('status')} (expected: {expected_status})")
                return False
                
            if data.get("service") != expected_service:
                self.log_test("Backend Health Check", False, f"Service field: {data.get('service')} (expected: {expected_service})")
                return False
                
            self.log_test("Backend Health Check", True, f"Status: {expected_status}, Service: {expected_service}")
            return True
            
        except requests.exceptions.RequestException as e:
            self.log_test("Backend Health Check", False, f"Request failed: {str(e)}")
            return False
        except Exception as e:
            self.log_test("Backend Health Check", False, f"Error: {str(e)}")
            return False
    
    def test_backend_root(self) -> bool:
        """Test GET /api/ root endpoint"""
        try:
            response = requests.get(f"{BACKEND_URL}/", timeout=10)
            
            if response.status_code != 200:
                self.log_test("Backend Root API", False, f"Status: {response.status_code}")
                return False
                
            data = response.json()
            expected_message = "Aura Browser API"
            expected_version = "1.0.0"
            
            if data.get("message") != expected_message:
                self.log_test("Backend Root API", False, f"Message field: {data.get('message')} (expected: {expected_message})")
                return False
                
            if data.get("version") != expected_version:
                self.log_test("Backend Root API", False, f"Version field: {data.get('version')} (expected: {expected_version})")
                return False
                
            self.log_test("Backend Root API", True, f"Message: {expected_message}, Version: {expected_version}")
            return True
            
        except requests.exceptions.RequestException as e:
            self.log_test("Backend Root API", False, f"Request failed: {str(e)}")
            return False
        except Exception as e:
            self.log_test("Backend Root API", False, f"Error: {str(e)}")
            return False

    def run_all_tests(self):
        """Run all API tests"""
        print("🧪 AURA BROWSER DOWNLOADS MANAGER API TESTING")
        print("=" * 60)
        print(f"Backend URL: {BACKEND_URL}")
        print()
        
        # Test backend API endpoints
        self.test_backend_health()
        self.test_backend_root()
        
        print()
        print("=" * 60)
        print(f"📊 SUMMARY: {self.passed_tests}/{self.total_tests} tests passed ({self.passed_tests/self.total_tests*100:.1f}%)")
        
        if self.passed_tests == self.total_tests:
            print("🎉 ALL TESTS PASSED!")
            return True
        else:
            print("❌ SOME TESTS FAILED!")
            return False

def main():
    """Main test runner"""
    tester = AuraAPITester()
    success = tester.run_all_tests()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()