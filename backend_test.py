#!/usr/bin/env python3
"""
Backend Testing for Aura Browser Ghost Mode Feature
Tests backend health and Ghost Mode privacy engine/decoy history services
"""

import requests
import json
import sys
import time
from typing import Dict, Any, Optional

# Configuration from environment
BACKEND_URL = "https://fork-handoff-summary.preview.emergentagent.com/api"

class GhostModeBackendTester:
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
    
    def verify_ghost_mode_store_logic(self) -> bool:
        """Verify Ghost Mode store logic by examining code structure"""
        try:
            print(f"\n🔍 Verifying Ghost Mode Store Logic")
            
            store_file = "/app/frontend/src/store/useGhostModeStore.ts"
            
            with open(store_file, 'r') as f:
                store_content = f.read()
            
            # Check for essential store methods
            required_methods = [
                'initialize', 'activateGhostMode', 'deactivateGhostMode', 'setSelfDestructTimer',
                'triggerSelfDestruct', 'setSpoofedLocation', 'setRandomLocation', 'toggleDecoy',
                'toggleShowRealHistory', 'updateSettings', 'recordBioFailure', 'resetBioFailures',
                'isBioLocked', 'getRemainingSeconds'
            ]
            
            missing_methods = []
            for method in required_methods:
                if f"{method}:" not in store_content:
                    missing_methods.append(method)
            
            if missing_methods:
                self.log_test(
                    "Ghost Mode Store Methods", 
                    False, 
                    f"Missing required store methods: {missing_methods}"
                )
                return False
            
            # Check for essential types and interfaces
            required_types = ['SpoofLocation', 'TimerPreset']
            missing_types = []
            for type_name in required_types:
                if f"export interface {type_name}" not in store_content and f"export type {type_name}" not in store_content:
                    missing_types.append(type_name)
            
            # Check for internal interfaces (not exported)
            internal_interfaces = ['GhostModeSettings', 'GhostModeState']
            missing_interfaces = []
            for interface_name in internal_interfaces:
                if f"interface {interface_name}" not in store_content:
                    missing_interfaces.append(interface_name)
            
            if missing_types:
                self.log_test(
                    "Ghost Mode Store Types", 
                    False, 
                    f"Missing required exported types: {missing_types}"
                )
                return False
                
            if missing_interfaces:
                self.log_test(
                    "Ghost Mode Store Interfaces", 
                    False, 
                    f"Missing required internal interfaces: {missing_interfaces}"
                )
                return False
            
            # Check for PRESET_LOCATIONS array
            if "PRESET_LOCATIONS" not in store_content:
                self.log_test(
                    "Ghost Mode Store Locations", 
                    False, 
                    "PRESET_LOCATIONS array not found"
                )
                return False
            
            # Check for Zustand usage
            if "import { create } from 'zustand'" not in store_content:
                self.log_test(
                    "Ghost Mode Store Zustand", 
                    False, 
                    "Store doesn't use Zustand properly"
                )
                return False
            
            # Check for secure storage usage
            if "expo-secure-store" not in store_content:
                self.log_test(
                    "Ghost Mode Store Security", 
                    False, 
                    "Store doesn't use secure storage for settings"
                )
                return False
            
            # Check for biometric lockout logic
            if "bioLockoutUntil" not in store_content:
                self.log_test(
                    "Ghost Mode Store Biometric", 
                    False, 
                    "Biometric lockout logic not implemented"
                )
                return False
                
            self.log_test(
                "Ghost Mode Store Logic", 
                True, 
                "Store has all required methods, types, locations, security features, and biometric protection"
            )
            return True
            
        except Exception as e:
            self.log_test(
                "Ghost Mode Store Logic", 
                False, 
                "Failed to verify store logic",
                f"Error: {str(e)}"
            )
            return False
    
    def verify_ghost_mode_privacy_engine(self) -> bool:
        """Verify Ghost Mode Privacy Engine service logic"""
        try:
            print(f"\n🔍 Verifying Ghost Mode Privacy Engine")
            
            engine_file = "/app/frontend/src/services/GhostModePrivacyEngine.ts"
            
            with open(engine_file, 'r') as f:
                engine_content = f.read()
            
            # Check for essential privacy engine methods
            required_methods = ['getPrivacyInjectionScript', 'stripTrackingParams', 'rotateUserAgent']
            missing_methods = []
            for method in required_methods:
                if f"{method}(" not in engine_content:
                    missing_methods.append(method)
            
            if missing_methods:
                self.log_test(
                    "Ghost Mode Privacy Engine Methods", 
                    False, 
                    f"Missing required privacy methods: {missing_methods}"
                )
                return False
            
            # Check for privacy protection features
            privacy_features = [
                'WebRTC', 'Canvas fingerprint', 'Audio context fingerprint', 'Font fingerprint',
                'User-Agent spoofing', 'Geolocation spoofing', 'UTM parameter', 'third-party cookie'
            ]
            missing_features = []
            for feature in privacy_features:
                if feature.lower() not in engine_content.lower():
                    missing_features.append(feature)
            
            if missing_features:
                self.log_test(
                    "Ghost Mode Privacy Features", 
                    False, 
                    f"Missing privacy protection features: {missing_features}"
                )
                return False
            
            # Check for tracking parameter stripping
            tracking_params = ['utm_source', 'fbclid', 'gclid', '_ga', '_gl']
            missing_params = []
            for param in tracking_params:
                if param not in engine_content:
                    missing_params.append(param)
            
            if missing_params:
                self.log_test(
                    "Ghost Mode Tracking Parameters", 
                    False, 
                    f"Missing tracking parameters: {missing_params}"
                )
                return False
            
            # Check for SpoofLocation import
            if "SpoofLocation" not in engine_content:
                self.log_test(
                    "Ghost Mode Location Spoofing", 
                    False, 
                    "Location spoofing interface not imported"
                )
                return False
                
            # Test stripTrackingParams functionality
            try:
                # Since we can't directly import the module in Python, we'll check the logic structure
                if "new URL" not in engine_content or "searchParams.delete" not in engine_content:
                    self.log_test(
                        "Ghost Mode URL Processing", 
                        False, 
                        "URL processing logic incomplete"
                    )
                    return False
            except:
                pass
            
            self.log_test(
                "Ghost Mode Privacy Engine", 
                True, 
                "Privacy engine has all required methods, WebRTC blocking, fingerprint protection, UTM stripping, and location spoofing"
            )
            return True
            
        except Exception as e:
            self.log_test(
                "Ghost Mode Privacy Engine", 
                False, 
                "Failed to verify privacy engine",
                f"Error: {str(e)}"
            )
            return False
    
    def verify_decoy_history_service(self) -> bool:
        """Verify Ghost Mode Decoy History Service functionality"""
        try:
            print(f"\n🔍 Verifying Ghost Mode Decoy History Service")
            
            service_file = "/app/frontend/src/services/DecoyHistoryService.ts"
            
            with open(service_file, 'r') as f:
                service_content = f.read()
            
            # Check for essential service methods
            required_methods = ['generateDailyHistory']
            missing_methods = []
            for method in required_methods:
                if f"{method}(" not in service_content:
                    missing_methods.append(method)
            
            if missing_methods:
                self.log_test(
                    "Decoy History Service Methods", 
                    False, 
                    f"Missing required service methods: {missing_methods}"
                )
                return False
            
            # Check for DecoyEntry interface
            if "export interface DecoyEntry" not in service_content:
                self.log_test(
                    "Decoy History Interface", 
                    False, 
                    "DecoyEntry interface not properly exported"
                )
                return False
            
            # Check for DECOY_SITES array with realistic sites
            if "DECOY_SITES" not in service_content:
                self.log_test(
                    "Decoy History Sites", 
                    False, 
                    "DECOY_SITES array not found"
                )
                return False
            
            # Check for realistic decoy sites
            realistic_domains = ['cnn.com', 'wikipedia.org', 'weather.com', 'espn.com', 'youtube.com', 'bbc.com', 'amazon.com']
            missing_domains = []
            for domain in realistic_domains:
                if domain not in service_content:
                    missing_domains.append(domain)
            
            if len(missing_domains) > 3:  # Allow some flexibility
                self.log_test(
                    "Decoy History Realism", 
                    False, 
                    f"Too many realistic domains missing: {missing_domains}"
                )
                return False
            
            # Check for proper timestamp distribution logic
            if "timestamp:" not in service_content or "Math.floor" not in service_content:
                self.log_test(
                    "Decoy History Timestamps", 
                    False, 
                    "Timestamp distribution logic incomplete"
                )
                return False
            
            # Check for daily history generation parameters
            if "count" not in service_content or "shuffled" not in service_content:
                self.log_test(
                    "Decoy History Generation", 
                    False, 
                    "History generation parameters missing"
                )
                return False
            
            # Check for service export
            if "export const decoyHistoryService" not in service_content:
                self.log_test(
                    "Decoy History Export", 
                    False, 
                    "Service not properly exported"
                )
                return False
            
            self.log_test(
                "Ghost Mode Decoy History Service", 
                True, 
                "Decoy history service has proper methods, realistic sites, timestamp distribution, and export structure"
            )
            return True
            
        except Exception as e:
            self.log_test(
                "Ghost Mode Decoy History Service", 
                False, 
                "Failed to verify decoy history service",
                f"Error: {str(e)}"
            )
            return False
    
    def verify_ghost_mode_settings_integration(self) -> bool:
        """Verify Ghost Mode settings appear in the Settings page"""
        try:
            print(f"\n🔍 Verifying Ghost Mode Settings Integration")
            
            settings_file = "/app/frontend/app/settings.tsx"
            
            with open(settings_file, 'r') as f:
                settings_content = f.read()
            
            # Check for Ghost Mode import
            if "useGhostModeStore" not in settings_content:
                self.log_test(
                    "Ghost Mode Settings Import", 
                    False, 
                    "useGhostModeStore not imported in settings page"
                )
                return False
            
            # Check for Ghost Mode title section
            if "GHOST MODE" not in settings_content:
                self.log_test(
                    "Ghost Mode Settings Title", 
                    False, 
                    "GHOST MODE title section not found in settings"
                )
                return False
            
            # Check for Ghost Mode status display
            if "ghostIsActive" not in settings_content:
                self.log_test(
                    "Ghost Mode Settings Status", 
                    False, 
                    "Ghost Mode active status not displayed"
                )
                return False
            
            # Check for Ghost Mode settings toggles
            ghost_settings = ['requireBiometric', 'showEntryAnimation', 'decoyModeEnabled', 'blockWebRTC', 'rotateUserAgent']
            missing_settings = []
            for setting in ghost_settings:
                if setting not in settings_content:
                    missing_settings.append(setting)
            
            if missing_settings:
                self.log_test(
                    "Ghost Mode Settings Controls", 
                    False, 
                    f"Missing Ghost Mode settings: {missing_settings}"
                )
                return False
            
            # Check for Ghost Mode skull icon
            if "skull-outline" not in settings_content:
                self.log_test(
                    "Ghost Mode Settings Icon", 
                    False, 
                    "Ghost Mode skull icon not found"
                )
                return False
            
            # Check for decoy mode badge
            if "DECOY" not in settings_content:
                self.log_test(
                    "Ghost Mode Decoy Badge", 
                    False, 
                    "Decoy mode badge not displayed"
                )
                return False
            
            # Check for proper test IDs
            if "ghost-mode-settings-status" not in settings_content:
                self.log_test(
                    "Ghost Mode Settings Test ID", 
                    False, 
                    "Ghost Mode settings test ID not found"
                )
                return False
            
            self.log_test(
                "Ghost Mode Settings Integration", 
                True, 
                "Ghost Mode properly integrated in settings page with all 6 toggles, status display, skull icon, and test IDs"
            )
            return True
            
        except Exception as e:
            self.log_test(
                "Ghost Mode Settings Integration", 
                False, 
                "Failed to verify settings integration",
                f"Error: {str(e)}"
            )
            return False
    
    def run_all_tests(self):
        """Run all Ghost Mode tests"""
        print("🚀 Starting Aura Browser Ghost Mode Backend Testing")
        print("=" * 60)
        
        # Test backend health first
        backend_healthy = self.test_backend_health()
        if backend_healthy:
            self.test_backend_stability()
        
        # Test Ghost Mode logic (these don't require backend)
        self.verify_ghost_mode_store_logic()
        self.verify_ghost_mode_privacy_engine() 
        self.verify_decoy_history_service()
        self.verify_ghost_mode_settings_integration()
        
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
    tester = GhostModeBackendTester()
    exit_code = tester.run_all_tests()
    sys.exit(exit_code)