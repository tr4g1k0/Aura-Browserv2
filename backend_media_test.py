#!/usr/bin/env python3
"""
Backend Media Feature Testing Script

Tests the Aura Browser backend after implementing background video and audio playback features:
- BackgroundMediaService
- VideoControlToolbar  
- useBackgroundMedia hook
- YouTube background play script
- Video detection script
- Android permissions for WAKE_LOCK, FOREGROUND_SERVICE
- iOS UIBackgroundModes=["audio"]

This script verifies:
1. Health endpoint functionality
2. Backend stability under load
3. API response consistency
"""

import requests
import time
import json
from concurrent.futures import ThreadPoolExecutor
from typing import Dict, List, Tuple
import sys

# Test configuration
BACKEND_URL = "https://audit-fixes-18.preview.emergentagent.com/api"
HEALTH_ENDPOINT = f"{BACKEND_URL}/health"
EXPECTED_HEALTH_RESPONSE = {"status": "healthy", "service": "Aura Browser API"}

class BackendMediaTester:
    def __init__(self):
        self.test_results = []
        self.errors = []
        
    def log_result(self, test_name: str, success: bool, message: str, response_time: float = 0):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        result = {
            "test": test_name,
            "status": status,
            "message": message,
            "response_time_ms": round(response_time * 1000, 2) if response_time > 0 else 0
        }
        self.test_results.append(result)
        print(f"{status} {test_name}: {message}")
        if response_time > 0:
            print(f"    Response time: {result['response_time_ms']}ms")
            
    def log_error(self, error: str):
        """Log error"""
        self.errors.append(error)
        print(f"🚨 ERROR: {error}")

    def test_health_endpoint(self) -> bool:
        """Test the /api/health endpoint"""
        print("\n=== Testing Health Endpoint ===")
        
        try:
            start_time = time.time()
            response = requests.get(HEALTH_ENDPOINT, timeout=10)
            response_time = time.time() - start_time
            
            if response.status_code == 200:
                data = response.json()
                if data == EXPECTED_HEALTH_RESPONSE:
                    self.log_result("Health Endpoint Response", True, 
                                  f"Returned correct response: {data}", response_time)
                    return True
                else:
                    self.log_result("Health Endpoint Response", False,
                                  f"Unexpected response: {data}, expected: {EXPECTED_HEALTH_RESPONSE}", response_time)
                    return False
            else:
                self.log_result("Health Endpoint Response", False,
                              f"HTTP {response.status_code}: {response.text}", response_time)
                return False
                
        except requests.exceptions.RequestException as e:
            self.log_error(f"Health endpoint request failed: {e}")
            self.log_result("Health Endpoint Response", False, f"Request failed: {e}")
            return False

    def test_backend_stability(self, num_requests: int = 10, num_threads: int = 3) -> Tuple[bool, Dict]:
        """Test backend stability with concurrent requests"""
        print(f"\n=== Testing Backend Stability ({num_requests} requests, {num_threads} threads) ===")
        
        def single_health_request():
            try:
                start_time = time.time()
                response = requests.get(HEALTH_ENDPOINT, timeout=5)
                response_time = time.time() - start_time
                
                return {
                    "success": response.status_code == 200 and response.json() == EXPECTED_HEALTH_RESPONSE,
                    "status_code": response.status_code,
                    "response_time": response_time,
                    "response_data": response.json() if response.status_code == 200 else None
                }
            except Exception as e:
                return {
                    "success": False,
                    "error": str(e),
                    "response_time": 0,
                    "status_code": None
                }
        
        # Execute concurrent requests
        with ThreadPoolExecutor(max_workers=num_threads) as executor:
            futures = [executor.submit(single_health_request) for _ in range(num_requests)]
            results = [future.result() for future in futures]
        
        # Analyze results
        successful_requests = [r for r in results if r["success"]]
        failed_requests = [r for r in results if not r["success"]]
        
        success_count = len(successful_requests)
        success_rate = (success_count / num_requests) * 100
        
        if successful_requests:
            response_times = [r["response_time"] for r in successful_requests]
            avg_response_time = sum(response_times) / len(response_times)
            min_response_time = min(response_times)
            max_response_time = max(response_times)
        else:
            avg_response_time = min_response_time = max_response_time = 0
        
        stability_stats = {
            "total_requests": num_requests,
            "successful_requests": success_count,
            "failed_requests": len(failed_requests),
            "success_rate": success_rate,
            "avg_response_time": round(avg_response_time * 1000, 2),
            "min_response_time": round(min_response_time * 1000, 2),
            "max_response_time": round(max_response_time * 1000, 2)
        }
        
        # Log results
        if success_rate >= 95.0:  # 95% success rate threshold
            self.log_result("Backend Stability Test", True,
                          f"{success_count}/{num_requests} requests successful ({success_rate:.1f}% success rate). "
                          f"Avg response time: {stability_stats['avg_response_time']}ms")
            stability_test_passed = True
        else:
            self.log_result("Backend Stability Test", False,
                          f"Low success rate: {success_count}/{num_requests} successful ({success_rate:.1f}%). "
                          f"Failed requests: {len(failed_requests)}")
            stability_test_passed = False
            
        # Log failed request details
        if failed_requests:
            print(f"   Failed request details:")
            for i, req in enumerate(failed_requests[:3]):  # Show first 3 failures
                if 'error' in req:
                    print(f"     {i+1}. Error: {req['error']}")
                else:
                    print(f"     {i+1}. HTTP {req.get('status_code', 'Unknown')}")
            
        return stability_test_passed, stability_stats

    def test_root_api_endpoint(self) -> bool:
        """Test the root API endpoint"""
        print("\n=== Testing Root API Endpoint ===")
        
        root_url = f"{BACKEND_URL}/"
        try:
            start_time = time.time()
            response = requests.get(root_url, timeout=10)
            response_time = time.time() - start_time
            
            if response.status_code == 200:
                data = response.json()
                expected_keys = ["message", "version"]
                if all(key in data for key in expected_keys):
                    self.log_result("Root API Endpoint", True,
                                  f"Returned expected structure: {data}", response_time)
                    return True
                else:
                    self.log_result("Root API Endpoint", False,
                                  f"Missing expected keys in response: {data}", response_time)
                    return False
            else:
                self.log_result("Root API Endpoint", False,
                              f"HTTP {response.status_code}: {response.text}", response_time)
                return False
                
        except requests.exceptions.RequestException as e:
            self.log_error(f"Root API request failed: {e}")
            self.log_result("Root API Endpoint", False, f"Request failed: {e}")
            return False

    def run_all_tests(self) -> bool:
        """Run all backend tests"""
        print("🧪 AURA BROWSER BACKEND MEDIA FEATURE TESTING")
        print("=" * 60)
        print(f"Testing backend at: {BACKEND_URL}")
        print(f"Target health endpoint: {HEALTH_ENDPOINT}")
        print(f"Expected health response: {EXPECTED_HEALTH_RESPONSE}")
        
        all_tests_passed = True
        
        # Test 1: Health endpoint
        health_test_passed = self.test_health_endpoint()
        all_tests_passed = all_tests_passed and health_test_passed
        
        # Test 2: Root API endpoint
        root_test_passed = self.test_root_api_endpoint()
        all_tests_passed = all_tests_passed and root_test_passed
        
        # Test 3: Backend stability
        stability_test_passed, stability_stats = self.test_backend_stability()
        all_tests_passed = all_tests_passed and stability_test_passed
        
        # Summary
        print(f"\n" + "=" * 60)
        print("🏁 TEST SUMMARY")
        print("=" * 60)
        
        passed_tests = len([r for r in self.test_results if "✅ PASS" in r["status"]])
        total_tests = len(self.test_results)
        
        print(f"Tests passed: {passed_tests}/{total_tests}")
        print(f"Overall result: {'✅ ALL TESTS PASSED' if all_tests_passed else '❌ SOME TESTS FAILED'}")
        
        if stability_stats:
            print(f"\nStability metrics:")
            print(f"  • Success rate: {stability_stats['success_rate']:.1f}%")
            print(f"  • Average response time: {stability_stats['avg_response_time']}ms")
            print(f"  • Response time range: {stability_stats['min_response_time']}-{stability_stats['max_response_time']}ms")
        
        if self.errors:
            print(f"\nErrors encountered: {len(self.errors)}")
            for error in self.errors:
                print(f"  • {error}")
        
        print("\n📋 DETAILED RESULTS:")
        for result in self.test_results:
            print(f"  {result['status']} {result['test']}: {result['message']}")
            if result['response_time_ms'] > 0:
                print(f"    ⏱️ Response time: {result['response_time_ms']}ms")
        
        return all_tests_passed

def main():
    """Main test execution"""
    tester = BackendMediaTester()
    success = tester.run_all_tests()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()