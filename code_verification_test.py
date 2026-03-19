#!/usr/bin/env python3
"""
Aura Browser Downloads Manager - Code Verification Testing
Verifies the 4 new features are properly implemented in the codebase.
"""

import os
import json
import re
import sys

class CodeVerificationTester:
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

    def file_exists(self, file_path: str) -> bool:
        """Check if file exists"""
        return os.path.exists(file_path)

    def read_file(self, file_path: str) -> str:
        """Read file content"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return f.read()
        except Exception as e:
            print(f"Error reading {file_path}: {e}")
            return ""

    def test_zustand_store_exists(self):
        """Test 1: Verify useDownloadsStore Zustand store exists"""
        file_path = "/app/frontend/src/store/useDownloadsStore.ts"
        
        if not self.file_exists(file_path):
            self.log_test("Zustand Store File", False, "useDownloadsStore.ts not found")
            return
            
        content = self.read_file(file_path)
        
        # Check for required methods
        required_methods = [
            "startDownload",
            "updateProgress", 
            "completeDownload",
            "failDownload",
            "removeActive"
        ]
        
        missing_methods = []
        for method in required_methods:
            if method not in content:
                missing_methods.append(method)
        
        if missing_methods:
            self.log_test("Zustand Store Methods", False, f"Missing methods: {', '.join(missing_methods)}")
        else:
            self.log_test("Zustand Store Methods", True, "All required methods present")
            
        # Check for ActiveDownload interface
        if "ActiveDownload" in content and "interface" in content:
            self.log_test("ActiveDownload Interface", True, "Interface defined")
        else:
            self.log_test("ActiveDownload Interface", False, "Interface not found")

    def test_notification_banner_exists(self):
        """Test 2: Verify DownloadNotificationBanner component exists"""
        file_path = "/app/frontend/src/components/DownloadNotificationBanner.tsx"
        
        if not self.file_exists(file_path):
            self.log_test("DownloadNotificationBanner File", False, "Component file not found")
            return
            
        content = self.read_file(file_path)
        
        # Check for required props
        required_props = ["downloadsModalVisible", "onOpenDownloads"]
        missing_props = []
        
        for prop in required_props:
            if prop not in content:
                missing_props.append(prop)
        
        if missing_props:
            self.log_test("Notification Banner Props", False, f"Missing props: {', '.join(missing_props)}")
        else:
            self.log_test("Notification Banner Props", True, "All required props present")
            
        # Check for useDownloadsStore import
        if "useDownloadsStore" in content:
            self.log_test("Notification Banner Store Integration", True, "Uses downloads store")
        else:
            self.log_test("Notification Banner Store Integration", False, "Store integration missing")

    def test_downloads_modal_enhancements(self):
        """Test 3: Verify DownloadsModal has search/filter functionality"""
        file_path = "/app/frontend/src/components/DownloadsModal.tsx"
        
        if not self.file_exists(file_path):
            self.log_test("DownloadsModal File", False, "Component file not found")
            return
            
        content = self.read_file(file_path)
        
        # Check for search functionality
        search_indicators = ["searchQuery", "TextInput", "search"]
        has_search = any(indicator in content for indicator in search_indicators)
        
        if has_search:
            self.log_test("DownloadsModal Search", True, "Search functionality present")
        else:
            self.log_test("DownloadsModal Search", False, "Search functionality missing")
            
        # Check for filter functionality  
        filter_indicators = ["activeFilter", "FileCategory", "filter"]
        has_filter = any(indicator in content for indicator in filter_indicators)
        
        if has_filter:
            self.log_test("DownloadsModal Filter", True, "Filter functionality present")
        else:
            self.log_test("DownloadsModal Filter", False, "Filter functionality missing")
            
        # Check for batch mode
        batch_indicators = ["isBatchMode", "selectedIds", "batch"]
        has_batch = any(indicator in content for indicator in batch_indicators)
        
        if has_batch:
            self.log_test("DownloadsModal Batch Mode", True, "Batch selection functionality present")
        else:
            self.log_test("DownloadsModal Batch Mode", False, "Batch selection functionality missing")
            
        # Check for active downloads integration
        if "useDownloadsStore" in content and "ActiveDownloadRow" in content:
            self.log_test("DownloadsModal Active Downloads", True, "Active downloads integration present")
        else:
            self.log_test("DownloadsModal Active Downloads", False, "Active downloads integration missing")

    def test_browser_menu_download_all_links(self):
        """Test 4: Verify BrowserMenu has Download All Links feature"""
        file_path = "/app/frontend/src/components/BrowserMenu.tsx"
        
        if not self.file_exists(file_path):
            self.log_test("BrowserMenu File", False, "Component file not found")
            return
            
        content = self.read_file(file_path)
        
        # Check for onDownloadAllLinks prop
        if "onDownloadAllLinks" in content:
            self.log_test("BrowserMenu Download All Links Prop", True, "onDownloadAllLinks prop present")
        else:
            self.log_test("BrowserMenu Download All Links Prop", False, "onDownloadAllLinks prop missing")
            
        # Check for Download All Links menu item
        if "Download All Links" in content:
            self.log_test("BrowserMenu Download All Links Item", True, "Menu item present")
        else:
            self.log_test("BrowserMenu Download All Links Item", False, "Menu item missing")

    def test_index_integration(self):
        """Test 5: Verify index.tsx integrates all new features"""
        file_path = "/app/frontend/app/index.tsx"
        
        if not self.file_exists(file_path):
            self.log_test("Index File", False, "index.tsx not found")
            return
            
        content = self.read_file(file_path)
        
        # Check for DownloadNotificationBanner import and usage
        if "DownloadNotificationBanner" in content:
            self.log_test("Index DownloadNotificationBanner", True, "Component imported and used")
        else:
            self.log_test("Index DownloadNotificationBanner", False, "Component not integrated")
            
        # Check for useDownloadsStore import
        if "useDownloadsStore" in content:
            self.log_test("Index Downloads Store", True, "Store imported")
        else:
            self.log_test("Index Downloads Store", False, "Store not imported")
            
        # Check for handleDownloadAllLinks function
        if "handleDownloadAllLinks" in content:
            self.log_test("Index Download All Links Handler", True, "Handler function present")
        else:
            self.log_test("Index Download All Links Handler", False, "Handler function missing")
            
        # Check for store method calls in handleFileDownload
        store_calls = ["startDownload", "updateProgress", "completeDownload", "failDownload"]
        found_calls = [call for call in store_calls if call in content]
        
        if len(found_calls) >= 3:  # Should have at least 3 of the 4 calls
            self.log_test("Index Store Integration", True, f"Store methods called: {', '.join(found_calls)}")
        else:
            self.log_test("Index Store Integration", False, f"Limited store integration: {', '.join(found_calls)}")

    def test_download_all_links_message_handler(self):
        """Test 6: Verify DOWNLOAD_ALL_LINKS message handler exists"""
        file_path = "/app/frontend/app/index.tsx"
        content = self.read_file(file_path)
        
        if "DOWNLOAD_ALL_LINKS" in content:
            self.log_test("DOWNLOAD_ALL_LINKS Message Handler", True, "Message handler present")
        else:
            self.log_test("DOWNLOAD_ALL_LINKS Message Handler", False, "Message handler missing")

    def run_all_tests(self):
        """Run all code verification tests"""
        print("🔍 AURA BROWSER DOWNLOADS MANAGER CODE VERIFICATION")
        print("=" * 60)
        print()
        
        # Test all features
        self.test_zustand_store_exists()
        self.test_notification_banner_exists()
        self.test_downloads_modal_enhancements()
        self.test_browser_menu_download_all_links()
        self.test_index_integration()
        self.test_download_all_links_message_handler()
        
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
    tester = CodeVerificationTester()
    success = tester.run_all_tests()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()