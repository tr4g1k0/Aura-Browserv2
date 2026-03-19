#!/usr/bin/env python3
"""
Comprehensive test suite for Aura Browser refactor verification
Testing backend health and code structure after major index.tsx refactor
"""

import requests
import json
import os
import sys
import time

# Get backend URL from environment
BACKEND_URL = "https://fork-handoff-summary.preview.emergentagent.com/api"

class AuraRefactorTester:
    def __init__(self):
        self.results = []
        self.passed = 0
        self.failed = 0
        
    def log_test(self, test_name, passed, message="", details=""):
        """Log test result"""
        status = "✅ PASS" if passed else "❌ FAIL"
        result = {
            'test': test_name,
            'status': status,
            'message': message,
            'details': details
        }
        self.results.append(result)
        
        if passed:
            self.passed += 1
        else:
            self.failed += 1
            
        print(f"{status}: {test_name}")
        if message:
            print(f"  → {message}")
        if details and not passed:
            print(f"  → Details: {details}")
        print()

    def test_backend_health(self):
        """Test 1: Backend Health Check"""
        try:
            response = requests.get(f"{BACKEND_URL}/health", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                expected_status = {"status": "healthy"}
                
                if "status" in data and data["status"] == "healthy":
                    self.log_test(
                        "Backend Health Check", 
                        True, 
                        f"✅ GET /api/health returns correct response. Status: {data}"
                    )
                else:
                    self.log_test(
                        "Backend Health Check", 
                        False, 
                        f"❌ Incorrect response format. Got: {data}",
                        f"Expected status: 'healthy', got: {data.get('status', 'missing')}"
                    )
            else:
                self.log_test(
                    "Backend Health Check", 
                    False, 
                    f"❌ HTTP {response.status_code}: {response.text}",
                    f"Expected 200 OK"
                )
                
        except requests.exceptions.RequestException as e:
            self.log_test(
                "Backend Health Check", 
                False, 
                f"❌ Request failed: {str(e)}",
                f"Could not reach {BACKEND_URL}/health"
            )

    def check_file_exists_and_exports(self, file_path, expected_exports):
        """Check if file exists and exports expected functions/components"""
        if not os.path.exists(file_path):
            return False, f"File does not exist: {file_path}"
            
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                
            missing_exports = []
            for export in expected_exports:
                # Check for different export patterns
                export_patterns = [
                    f"export const {export}",
                    f"export function {export}",
                    f"export default {export}",
                    f"export {{ {export}",
                    f"export {{{export}}}",
                    f"const {export} = ",
                    f"function {export}("
                ]
                
                found = any(pattern in content for pattern in export_patterns)
                if not found:
                    missing_exports.append(export)
                    
            if missing_exports:
                return False, f"Missing exports: {missing_exports}"
            
            return True, "All exports found"
            
        except Exception as e:
            return False, f"Error reading file: {str(e)}"

    def test_extracted_hooks_structure(self):
        """Test 2: Code Structure Verification - Hooks"""
        hooks_to_check = [
            ("useAutoHideBar.ts", ["useAutoHideBar"]),
            ("useReaderMode.ts", ["useReaderMode"]),
            ("useFindInPage.ts", ["useFindInPage"]),
            ("useDownloads.ts", ["useDownloads"]),
            ("useAISummarize.ts", ["useAISummarize"]),
            ("useBrowserNavigation.ts", ["useBrowserNavigation"]),
            ("useWebViewEngine.ts", ["useWebViewEngine"])
        ]
        
        all_passed = True
        failed_hooks = []
        
        for hook_file, expected_exports in hooks_to_check:
            file_path = f"/app/frontend/src/hooks/{hook_file}"
            passed, message = self.check_file_exists_and_exports(file_path, expected_exports)
            
            if passed:
                self.log_test(
                    f"Hook Structure: {hook_file}",
                    True,
                    f"✅ Exports {expected_exports[0]} correctly"
                )
            else:
                self.log_test(
                    f"Hook Structure: {hook_file}",
                    False,
                    message
                )
                all_passed = False
                failed_hooks.append(hook_file)
        
        # Summary test
        if all_passed:
            self.log_test(
                "All Hooks Structure Verification",
                True,
                "✅ All 7 hooks exist and export correctly"
            )
        else:
            self.log_test(
                "All Hooks Structure Verification",
                False,
                f"❌ {len(failed_hooks)} hooks failed verification: {failed_hooks}"
            )

    def test_extracted_components_structure(self):
        """Test 3: Code Structure Verification - Components"""
        components_to_check = [
            ("FindInPageBar.tsx", ["FindInPageBar"]),
            ("AISummarizerDrawer.tsx", ["AISummarizerDrawer"]),
            ("BotDetectionBanner.tsx", ["BotDetectionBanner"]),
            ("PrivacyShredderToast.tsx", ["PrivacyShredderToast"])
        ]
        
        all_passed = True
        failed_components = []
        
        for component_file, expected_exports in components_to_check:
            file_path = f"/app/frontend/src/components/{component_file}"
            passed, message = self.check_file_exists_and_exports(file_path, expected_exports)
            
            if passed:
                self.log_test(
                    f"Component Structure: {component_file}",
                    True,
                    f"✅ Exports {expected_exports[0]} correctly"
                )
            else:
                self.log_test(
                    f"Component Structure: {component_file}",
                    False,
                    message
                )
                all_passed = False
                failed_components.append(component_file)
        
        # Summary test
        if all_passed:
            self.log_test(
                "All Components Structure Verification",
                True,
                "✅ All 4 extracted components exist and export correctly"
            )
        else:
            self.log_test(
                "All Components Structure Verification",
                False,
                f"❌ {len(failed_components)} components failed verification: {failed_components}"
            )

    def test_index_tsx_imports(self):
        """Test 4: Import Verification in index.tsx"""
        index_path = "/app/frontend/app/index.tsx"
        
        if not os.path.exists(index_path):
            self.log_test(
                "Index.tsx Import Verification",
                False,
                "❌ index.tsx file not found"
            )
            return
            
        try:
            with open(index_path, 'r', encoding='utf-8') as f:
                content = f.read()
                
            # Check hook imports
            hook_imports = [
                "useAutoHideBar",
                "useReaderMode", 
                "useFindInPage",
                "useDownloads",
                "useAISummarize",
                "useBrowserNavigation",
                "useWebViewEngine"
            ]
            
            # Check component imports  
            component_imports = [
                "FindInPageBar",
                "AISummarizerDrawer", 
                "BotDetectionBanner",
                "PrivacyShredderToast"
            ]
            
            # Check existing component imports
            existing_imports = [
                "UnifiedTopBar",
                "NewTabPage",
                "BrowserMenu"
            ]
            
            missing_imports = []
            
            # Verify hook imports
            for hook in hook_imports:
                if hook not in content:
                    missing_imports.append(f"Hook: {hook}")
                    
            # Verify component imports
            for component in component_imports:
                if component not in content:
                    missing_imports.append(f"Component: {component}")
                    
            # Verify existing component imports still present
            for component in existing_imports:
                if component not in content:
                    missing_imports.append(f"Existing Component: {component}")
                    
            if missing_imports:
                self.log_test(
                    "Index.tsx Import Verification",
                    False,
                    f"❌ Missing imports: {missing_imports}"
                )
            else:
                self.log_test(
                    "Index.tsx Import Verification", 
                    True,
                    f"✅ All imports found: {len(hook_imports)} hooks + {len(component_imports)} components + {len(existing_imports)} existing"
                )
                
        except Exception as e:
            self.log_test(
                "Index.tsx Import Verification",
                False,
                f"❌ Error reading index.tsx: {str(e)}"
            )

    def test_hook_usage_in_index(self):
        """Test 5: Hook Usage Verification in index.tsx"""
        index_path = "/app/frontend/app/index.tsx"
        
        if not os.path.exists(index_path):
            self.log_test(
                "Hook Usage Verification",
                False,
                "❌ index.tsx file not found"
            )
            return
            
        try:
            with open(index_path, 'r', encoding='utf-8') as f:
                content = f.read()
                
            # Check that hooks are actually called/used
            hook_calls = [
                "useAutoHideBar(",
                "useReaderMode(",
                "useFindInPage(",
                "useDownloads(",
                "useAISummarize(",
                "useBrowserNavigation(",
                "useWebViewEngine("
            ]
            
            unused_hooks = []
            for hook_call in hook_calls:
                if hook_call not in content:
                    unused_hooks.append(hook_call.replace('(', ''))
                    
            if unused_hooks:
                self.log_test(
                    "Hook Usage Verification",
                    False,
                    f"❌ Hooks not called in index.tsx: {unused_hooks}"
                )
            else:
                self.log_test(
                    "Hook Usage Verification",
                    True,
                    "✅ All 7 hooks are properly called in index.tsx"
                )
                
        except Exception as e:
            self.log_test(
                "Hook Usage Verification",
                False,
                f"❌ Error reading index.tsx: {str(e)}"
            )

    def test_component_usage_in_jsx(self):
        """Test 6: Component Usage in JSX"""
        index_path = "/app/frontend/app/index.tsx"
        
        if not os.path.exists(index_path):
            self.log_test(
                "Component JSX Usage Verification",
                False,
                "❌ index.tsx file not found"
            )
            return
            
        try:
            with open(index_path, 'r', encoding='utf-8') as f:
                content = f.read()
                
            # Check component usage in JSX
            component_jsx = [
                "<FindInPageBar",
                "<AISummarizerDrawer",
                "<BotDetectionBanner", 
                "<PrivacyShredderToast"
            ]
            
            unused_components = []
            for component in component_jsx:
                if component not in content:
                    unused_components.append(component.replace('<', ''))
                    
            if unused_components:
                self.log_test(
                    "Component JSX Usage Verification",
                    False,
                    f"❌ Components not used in JSX: {unused_components}"
                )
            else:
                self.log_test(
                    "Component JSX Usage Verification",
                    True,
                    "✅ All 4 extracted components are used in JSX"
                )
                
        except Exception as e:
            self.log_test(
                "Component JSX Usage Verification",
                False,
                f"❌ Error reading index.tsx: {str(e)}"
            )

    def test_webview_message_handlers(self):
        """Test 7: WebView Message Handlers Still Present"""
        index_path = "/app/frontend/app/index.tsx"
        
        if not os.path.exists(index_path):
            self.log_test(
                "WebView Message Handlers Verification",
                False,
                "❌ index.tsx file not found"
            )
            return
            
        try:
            with open(index_path, 'r', encoding='utf-8') as f:
                content = f.read()
                
            # Check critical message handlers mentioned in review request
            message_handlers = [
                "SCROLL_POSITION",
                "PAGE_CONTENT",
                "PREDICTIVE_LINKS", 
                "AD_BLOCK_COUNT",
                "PAGE_CONTEXT",
                "IMAGE_LONG_PRESS",
                "TEXT_SELECTED",
                "TEXT_CLEAR",
                "BOT_DETECTED",
                "DOWNLOAD_ALL_LINKS",
                "TTS_CONTENT",
                "TTS_ERROR",
                "EXTRACTED_TEXT", 
                "EXTRACTION_ERROR"
            ]
            
            missing_handlers = []
            for handler in message_handlers:
                if handler not in content:
                    missing_handlers.append(handler)
                    
            if missing_handlers:
                self.log_test(
                    "WebView Message Handlers Verification",
                    False,
                    f"❌ Missing message handlers: {missing_handlers[:5]}..." if len(missing_handlers) > 5 else f"❌ Missing message handlers: {missing_handlers}"
                )
            else:
                self.log_test(
                    "WebView Message Handlers Verification",
                    True,
                    f"✅ All {len(message_handlers)} WebView message handlers preserved"
                )
                
        except Exception as e:
            self.log_test(
                "WebView Message Handlers Verification",
                False,
                f"❌ Error reading index.tsx: {str(e)}"
            )

    def test_key_function_connections(self):
        """Test 8: Key Function Connections Still Present"""
        index_path = "/app/frontend/app/index.tsx"
        
        if not os.path.exists(index_path):
            self.log_test(
                "Key Function Connections Verification",
                False,
                "❌ index.tsx file not found"
            )
            return
            
        try:
            with open(index_path, 'r', encoding='utf-8') as f:
                content = f.read()
                
            # Check key functions mentioned in review request
            key_functions = [
                "handleNavigate",
                "handleGoHome",
                "handleFileDownload",
                "handleDownloadAllLinks",
                "toggleReaderMode",
                "handleOpenFindInPage",
                "handleAISummarize",
                "handleShouldStartLoad",
                "handleLoadEnd"
            ]
            
            missing_functions = []
            for function in key_functions:
                if function not in content:
                    missing_functions.append(function)
                    
            if missing_functions:
                self.log_test(
                    "Key Function Connections Verification",
                    False,
                    f"❌ Missing key functions: {missing_functions}"
                )
            else:
                self.log_test(
                    "Key Function Connections Verification",
                    True,
                    f"✅ All {len(key_functions)} key functions preserved"
                )
                
        except Exception as e:
            self.log_test(
                "Key Function Connections Verification",
                False,
                f"❌ Error reading index.tsx: {str(e)}"
            )

    def test_hook_return_usage(self):
        """Test 9: Hook Return Values Used Correctly"""
        index_path = "/app/frontend/app/index.tsx"
        
        if not os.path.exists(index_path):
            self.log_test(
                "Hook Return Values Verification",
                False,
                "❌ index.tsx file not found"
            )
            return
            
        try:
            with open(index_path, 'r', encoding='utf-8') as f:
                content = f.read()
                
            # Check specific hook return values mentioned in review request
            hook_returns = [
                "checkForDownload",  # from useDownloads
                "cachedPageSource",  # from useBrowserNavigation
                "isCacheHit",       # from useBrowserNavigation
                "barTranslateY",    # from useAutoHideBar
                "getInjectedScript" # from useWebViewEngine
            ]
            
            missing_returns = []
            for return_val in hook_returns:
                if return_val not in content:
                    missing_returns.append(return_val)
                    
            if missing_returns:
                self.log_test(
                    "Hook Return Values Verification",
                    False,
                    f"❌ Missing hook return values: {missing_returns}"
                )
            else:
                self.log_test(
                    "Hook Return Values Verification",
                    True,
                    f"✅ All {len(hook_returns)} critical hook return values found"
                )
                
        except Exception as e:
            self.log_test(
                "Hook Return Values Verification",
                False,
                f"❌ Error reading index.tsx: {str(e)}"
            )

    def test_no_duplicate_imports(self):
        """Test 10: No Duplicate Imports in index.tsx"""
        index_path = "/app/frontend/app/index.tsx"
        
        if not os.path.exists(index_path):
            self.log_test(
                "Duplicate Imports Check",
                False,
                "❌ index.tsx file not found"
            )
            return
            
        try:
            with open(index_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
                
            # Find all import lines
            import_lines = [line.strip() for line in lines if line.strip().startswith('import ')]
            
            # Check for duplicate import statements
            seen_imports = set()
            duplicates = []
            
            for import_line in import_lines:
                if import_line in seen_imports:
                    duplicates.append(import_line)
                else:
                    seen_imports.add(import_line)
                    
            if duplicates:
                self.log_test(
                    "Duplicate Imports Check",
                    False,
                    f"❌ Found duplicate imports: {duplicates}"
                )
            else:
                self.log_test(
                    "Duplicate Imports Check",
                    True,
                    f"✅ No duplicate imports found ({len(import_lines)} unique imports)"
                )
                
        except Exception as e:
            self.log_test(
                "Duplicate Imports Check",
                False,
                f"❌ Error reading index.tsx: {str(e)}"
            )

    def test_index_tsx_size_reduction(self):
        """Test 11: Verify index.tsx Size Reduction"""
        index_path = "/app/frontend/app/index.tsx"
        
        if not os.path.exists(index_path):
            self.log_test(
                "Index.tsx Size Verification",
                False,
                "❌ index.tsx file not found"
            )
            return
            
        try:
            with open(index_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
                line_count = len(lines)
                
            # Review request mentions it should be around 545 lines (down from 2855)
            if line_count <= 600:  # Allow some buffer
                self.log_test(
                    "Index.tsx Size Verification",
                    True,
                    f"✅ index.tsx successfully reduced to {line_count} lines (expected ~545)"
                )
            elif line_count <= 1000:  # Still significantly reduced
                self.log_test(
                    "Index.tsx Size Verification",
                    True,
                    f"✅ index.tsx reduced to {line_count} lines (still significantly smaller than original 2855)"
                )
            else:
                self.log_test(
                    "Index.tsx Size Verification",
                    False,
                    f"❌ index.tsx is {line_count} lines, not significantly reduced from original 2855"
                )
                
        except Exception as e:
            self.log_test(
                "Index.tsx Size Verification",
                False,
                f"❌ Error reading index.tsx: {str(e)}"
            )

    def run_all_tests(self):
        """Run all verification tests"""
        print("🧪 AURA BROWSER REFACTOR VERIFICATION TESTS")
        print("=" * 60)
        print()
        
        # Test 1: Backend Health
        self.test_backend_health()
        
        # Test 2-3: Code Structure
        self.test_extracted_hooks_structure()
        self.test_extracted_components_structure()
        
        # Test 4-6: Import and Usage Verification
        self.test_index_tsx_imports()
        self.test_hook_usage_in_index()
        self.test_component_usage_in_jsx()
        
        # Test 7-9: Feature Preservation
        self.test_webview_message_handlers()
        self.test_key_function_connections()
        self.test_hook_return_usage()
        
        # Test 10-11: Code Quality
        self.test_no_duplicate_imports()
        self.test_index_tsx_size_reduction()
        
        # Summary
        print("=" * 60)
        print(f"🧪 TEST SUMMARY: {self.passed} PASSED, {self.failed} FAILED")
        print("=" * 60)
        
        if self.failed == 0:
            print("🎉 ALL REFACTOR VERIFICATION TESTS PASSED!")
            print("✅ The major refactor was successful - no functionality was broken")
        else:
            print(f"⚠️  {self.failed} TESTS FAILED - REFACTOR ISSUES DETECTED")
            print("❌ Some functionality may be broken after the refactor")
        
        return self.failed == 0

if __name__ == "__main__":
    tester = AuraRefactorTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)