#!/usr/bin/env python3
"""
Backend Testing for Aura Browser Kids Mode Feature
Tests backend health and Kids Mode store/filter service logic
"""

import requests
import json
import sys
import time
from typing import Dict, Any, Optional

# Configuration from environment
BACKEND_URL = "https://fork-handoff-summary.preview.emergentagent.com/api"

class KidsModeBackendTester:
    def __init__(self):
        self.backend_url = BACKEND_URL
        self.test_results = []
        self.failed_tests = []
        
    def log_test(self, test_name: str, passed: bool, message: str, details: Optional[str] = None):
        """Log test result"""
        status = "✅ PASS" if passed else "❌ FAIL"
        result = {
            "test": test_name,
            "passed": passed,
            "message": message,
            "details": details,
            "timestamp": time.time()
        }
        self.test_results.append(result)
        if not passed:
            self.failed_tests.append(result)
        
        print(f"{status} {test_name}: {message}")
        if details and not passed:
            print(f"   Details: {details}")
    
    def test_backend_health(self) -> bool:
        """Test backend health endpoint"""
        try:
            print(f"\n🔍 Testing Backend Health Endpoint: GET {self.backend_url}/health")
            
            response = requests.get(f"{self.backend_url}/health", timeout=10)
            
            # Check status code
            if response.status_code != 200:
                self.log_test(
                    "Backend Health Status Code", 
                    False, 
                    f"Expected 200, got {response.status_code}",
                    f"Response: {response.text}"
                )
                return False
                
            # Check response format
            try:
                data = response.json()
            except json.JSONDecodeError as e:
                self.log_test(
                    "Backend Health JSON Format", 
                    False, 
                    "Response is not valid JSON",
                    f"JSON Error: {e}, Response: {response.text}"
                )
                return False
            
            # Check required fields
            expected_fields = {"status": "healthy", "service": "Aura Browser API"}
            if data != expected_fields:
                self.log_test(
                    "Backend Health Response Format", 
                    False, 
                    "Response format doesn't match expected",
                    f"Expected: {expected_fields}, Got: {data}"
                )
                return False
            
            # Check response time
            response_time = response.elapsed.total_seconds() * 1000
            self.log_test(
                "Backend Health Response", 
                True, 
                f"Health endpoint working correctly (Response time: {response_time:.0f}ms)",
                f"Response: {data}"
            )
            
            return True
            
        except requests.exceptions.RequestException as e:
            self.log_test(
                "Backend Health Connection", 
                False, 
                "Failed to connect to backend",
                f"Error: {str(e)}"
            )
            return False
    
    def test_backend_stability(self, count: int = 5) -> bool:
        """Test backend stability with multiple requests"""
        try:
            print(f"\n🔍 Testing Backend Stability ({count} concurrent requests)")
            
            successful_requests = 0
            total_response_time = 0
            
            for i in range(count):
                try:
                    start_time = time.time()
                    response = requests.get(f"{self.backend_url}/health", timeout=5)
                    response_time = (time.time() - start_time) * 1000
                    
                    if response.status_code == 200:
                        successful_requests += 1
                        total_response_time += response_time
                        
                except requests.exceptions.RequestException:
                    pass
            
            success_rate = (successful_requests / count) * 100
            avg_response_time = total_response_time / max(successful_requests, 1)
            
            if success_rate >= 80:  # Allow for some network variance
                self.log_test(
                    "Backend Stability", 
                    True, 
                    f"{successful_requests}/{count} requests successful ({success_rate}% success rate, avg {avg_response_time:.0f}ms)",
                )
                return True
            else:
                self.log_test(
                    "Backend Stability", 
                    False, 
                    f"Only {successful_requests}/{count} requests successful ({success_rate}% success rate)",
                )
                return False
                
        except Exception as e:
            self.log_test(
                "Backend Stability", 
                False, 
                "Stability test failed",
                f"Error: {str(e)}"
            )
            return False
    
    def verify_kids_mode_store_logic(self) -> bool:
        """Verify Kids Mode store logic by examining code structure"""
        try:
            print(f"\n🔍 Verifying Kids Mode Store Logic")
            
            # Since this is a React Native/Expo app, we'll verify the store logic 
            # by checking that the store has the correct structure and methods
            store_file = "/app/frontend/src/store/useKidsModeStore.ts"
            
            with open(store_file, 'r') as f:
                store_content = f.read()
            
            # Check for essential store methods
            required_methods = [
                'initialize', 'setupKidsMode', 'activateKidsMode', 'deactivateKidsMode',
                'verifyPin', 'updateConfig', 'addAllowedSite', 'removeAllowedSite',
                'addBlockedSite', 'removeBlockedSite', 'startSession', 'endSession',
                'logPageVisit', 'logBlockedAttempt', 'getTodayReport', 'incrementFailedAttempt'
            ]
            
            missing_methods = []
            for method in required_methods:
                if f"{method}:" not in store_content:
                    missing_methods.append(method)
            
            if missing_methods:
                self.log_test(
                    "Kids Mode Store Methods", 
                    False, 
                    f"Missing required store methods: {missing_methods}"
                )
                return False
            
            # Check for essential types and interfaces
            required_types = ['AgeGroup', 'TimeLimit', 'KidsModeConfig', 'ActivityLogEntry', 'DailyReport']
            missing_types = []
            for type_name in required_types:
                if f"export type {type_name}" not in store_content and f"export interface {type_name}" not in store_content:
                    missing_types.append(type_name)
            
            if missing_types:
                self.log_test(
                    "Kids Mode Store Types", 
                    False, 
                    f"Missing required types: {missing_types}"
                )
                return False
            
            # Check for Zustand usage
            if "import { create } from 'zustand'" not in store_content:
                self.log_test(
                    "Kids Mode Store Zustand", 
                    False, 
                    "Store doesn't use Zustand properly"
                )
                return False
            
            # Check for secure storage usage
            if "expo-secure-store" not in store_content:
                self.log_test(
                    "Kids Mode Store Security", 
                    False, 
                    "Store doesn't use secure storage for PIN"
                )
                return False
                
            self.log_test(
                "Kids Mode Store Logic", 
                True, 
                "Store has all required methods, types, and security features"
            )
            return True
            
        except Exception as e:
            self.log_test(
                "Kids Mode Store Logic", 
                False, 
                "Failed to verify store logic",
                f"Error: {str(e)}"
            )
            return False
    
    def verify_content_filter_service(self) -> bool:
        """Verify Kids Content Filter service logic"""
        try:
            print(f"\n🔍 Verifying Kids Content Filter Service")
            
            filter_file = "/app/frontend/src/services/KidsContentFilter.ts"
            
            with open(filter_file, 'r') as f:
                filter_content = f.read()
            
            # Check for essential filter methods
            required_methods = ['isBlocked', 'isInAllowlist', 'enforceSearchSafety', 'getBlockedPageHtml', 'getSafeSites']
            missing_methods = []
            for method in required_methods:
                if f"{method}(" not in filter_content:
                    missing_methods.append(method)
            
            if missing_methods:
                self.log_test(
                    "Content Filter Methods", 
                    False, 
                    f"Missing required filter methods: {missing_methods}"
                )
                return False
            
            # Check for blocked domains list
            if "BLOCKED_DOMAINS" not in filter_content:
                self.log_test(
                    "Content Filter Blocklist", 
                    False, 
                    "No blocked domains list found"
                )
                return False
            
            # Check for safe sites lists
            if "LITTLE_KIDS_ALLOWLIST" not in filter_content or "KIDS_ALLOWLIST" not in filter_content:
                self.log_test(
                    "Content Filter Safe Sites", 
                    False, 
                    "Safe sites allowlists not found"
                )
                return False
            
            # Check for SafeSearch enforcement
            if "SAFESEARCH_PARAMS" not in filter_content:
                self.log_test(
                    "Content Filter SafeSearch", 
                    False, 
                    "SafeSearch enforcement not implemented"
                )
                return False
            
            # Check for age-based filtering logic
            # The filter should handle 'little-kids' specially and have logic for other age groups
            if "little-kids" not in filter_content:
                self.log_test(
                    "Content Filter Age Groups", 
                    False, 
                    "Age group 'little-kids' not handled in filter"
                )
                return False
            
            # Check that ageGroup parameter is used in methods
            if "ageGroup:" not in filter_content and "ageGroup)" not in filter_content:
                self.log_test(
                    "Content Filter Age Groups", 
                    False, 
                    "Filter doesn't use ageGroup parameter properly"
                )
                return False
            
            self.log_test(
                "Kids Content Filter Service", 
                True, 
                "Content filter has all required methods, blocklists, safe sites, SafeSearch, and age-based filtering"
            )
            return True
            
        except Exception as e:
            self.log_test(
                "Kids Content Filter Service", 
                False, 
                "Failed to verify content filter",
                f"Error: {str(e)}"
            )
            return False
    
    def verify_component_integration(self) -> bool:
        """Verify Kids Mode components exist and are properly structured"""
        try:
            print(f"\n🔍 Verifying Kids Mode Component Integration")
            
            required_components = {
                "KidsModeSetupModal": "/app/frontend/src/components/KidsModeSetupModal.tsx",
                "KidsModeExitModal": "/app/frontend/src/components/KidsModeExitModal.tsx",
                "KidsModeParentDashboard": "/app/frontend/src/components/KidsModeParentDashboard.tsx",
                "KidsModeBrowser": "/app/frontend/src/components/KidsModeBrowser.tsx",
                "KidsModeTimeUp": "/app/frontend/src/components/KidsModeTimeUp.tsx"
            }
            
            missing_components = []
            for component_name, component_path in required_components.items():
                try:
                    with open(component_path, 'r') as f:
                        content = f.read()
                        # Check if component is properly exported
                        if f"export const {component_name}" not in content and f"export default {component_name}" not in content:
                            missing_components.append(f"{component_name} (not exported)")
                        # Check if component uses required testids for testing
                        if "data-testid=" not in content:
                            print(f"   ⚠️  Warning: {component_name} has no test IDs")
                except FileNotFoundError:
                    missing_components.append(component_name)
            
            if missing_components:
                self.log_test(
                    "Kids Mode Components", 
                    False, 
                    f"Missing or invalid components: {missing_components}"
                )
                return False
            
            self.log_test(
                "Kids Mode Components", 
                True, 
                "All 5 Kids Mode components exist and are properly exported"
            )
            return True
            
        except Exception as e:
            self.log_test(
                "Kids Mode Components", 
                False, 
                "Failed to verify components",
                f"Error: {str(e)}"
            )
            return False
    
    def run_all_tests(self):
        """Run all Kids Mode tests"""
        print("🚀 Starting Aura Browser Kids Mode Backend Testing")
        print("=" * 60)
        
        # Test backend health first
        backend_healthy = self.test_backend_health()
        if backend_healthy:
            self.test_backend_stability()
        
        # Test Kids Mode logic (these don't require backend)
        self.verify_kids_mode_store_logic()
        self.verify_content_filter_service() 
        self.verify_component_integration()
        
        # Print summary
        return self.print_summary()
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 60)
        print("🏁 Test Summary")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = total_tests - len(self.failed_tests)
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {len(self.failed_tests)}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if self.failed_tests:
            print("\n❌ Failed Tests:")
            for test in self.failed_tests:
                print(f"  - {test['test']}: {test['message']}")
                if test.get('details'):
                    print(f"    Details: {test['details']}")
        
        # Return exit code
        return 0 if len(self.failed_tests) == 0 else 1

if __name__ == "__main__":
    tester = KidsModeBackendTester()
    exit_code = tester.run_all_tests()
    sys.exit(exit_code)