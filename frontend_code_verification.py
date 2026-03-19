#!/usr/bin/env python3
"""
Frontend Code Verification Testing for Aura Browser Downloads Auto-Categorization
Verifies the implementation of auto-categorization features as specified in the review request.
"""

import os
import re
import json
import sys
from pathlib import Path
from typing import List, Dict, Any, Optional

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'
    BOLD = '\033[1m'

class CodeVerificationTester:
    def __init__(self):
        self.passed_tests = 0
        self.total_tests = 0
        self.results = []
        self.frontend_path = "/app/frontend"
        
    def log_test(self, test_name: str, success: bool, details: str = ""):
        """Log test result with colored output"""
        self.total_tests += 1
        if success:
            self.passed_tests += 1
            print(f"{Colors.GREEN}✅ {test_name}: PASS{Colors.RESET}")
        else:
            print(f"{Colors.RED}❌ {test_name}: FAIL{Colors.RESET}")
        
        if details:
            print(f"   {details}")
        
        self.results.append({"test": test_name, "success": success, "details": details})

    def read_file(self, file_path: str) -> Optional[str]:
        """Read file content, return None if file doesn't exist"""
        try:
            full_path = os.path.join(self.frontend_path, file_path)
            with open(full_path, 'r', encoding='utf-8') as f:
                return f.read()
        except Exception as e:
            return None

    def test_file_download_manager_exports(self):
        """Test 1: Verify getCategoryForFile exported from FileDownloadManager.ts"""
        content = self.read_file("src/services/FileDownloadManager.ts")
        if content is None:
            self.log_test("FileDownloadManager getCategoryForFile Export", False, "FileDownloadManager.ts not found")
            return

        # Check for getCategoryForFile function export
        has_function = 'export function getCategoryForFile(' in content
        has_return_type = 'DownloadCategory' in content and 'function getCategoryForFile(' in content
        
        if has_function and has_return_type:
            self.log_test("FileDownloadManager getCategoryForFile Export", True, "Function exported with correct type signature")
        else:
            self.log_test("FileDownloadManager getCategoryForFile Export", False, "getCategoryForFile function not properly exported")

    def test_category_constants_exports(self):
        """Test 2: Verify CATEGORY_ICONS and CATEGORY_COLORS are exported"""
        content = self.read_file("src/services/FileDownloadManager.ts")
        if content is None:
            self.log_test("Category Constants Export", False, "FileDownloadManager.ts not found")
            return

        has_icons = 'CATEGORY_ICONS' in content and 'export { CATEGORY_ICONS' in content
        has_colors = 'CATEGORY_COLORS' in content and 'export { CATEGORY_ICONS, CATEGORY_COLORS }' in content
        
        if has_icons and has_colors:
            self.log_test("Category Constants Export", True, "CATEGORY_ICONS and CATEGORY_COLORS exported")
        else:
            self.log_test("Category Constants Export", False, "Missing CATEGORY_ICONS or CATEGORY_COLORS exports")

    def test_download_result_type_includes_category(self):
        """Test 3: Verify DownloadResult type includes category field"""
        content = self.read_file("src/services/FileDownloadManager.ts")
        if content is None:
            self.log_test("DownloadResult Category Field", False, "FileDownloadManager.ts not found")
            return

        # Look for DownloadResult interface with category field
        interface_pattern = r'export interface DownloadResult.*?{.*?category\?\s*:\s*DownloadCategory.*?}'
        has_category_field = re.search(interface_pattern, content, re.DOTALL)
        
        if has_category_field:
            self.log_test("DownloadResult Category Field", True, "DownloadResult interface includes category field")
        else:
            self.log_test("DownloadResult Category Field", False, "DownloadResult missing category field")

    def test_category_folder_mapping(self):
        """Test 4: Verify getCategoryForFile maps extensions correctly"""
        content = self.read_file("src/services/FileDownloadManager.ts")
        if content is None:
            self.log_test("Category Extension Mapping", False, "FileDownloadManager.ts not found")
            return

        # Check for CATEGORY_FOLDER_MAP with expected categories
        required_categories = ['Documents', 'Images', 'Media', 'Archives', 'Other']
        required_extensions = {
            'Documents': ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf', 'csv', 'json', 'xml'],
            'Images': ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'heic'],
            'Media': ['mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a', 'mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v'],
            'Archives': ['zip', 'rar', '7z', 'tar', 'gz', 'bz2'],
            'Other': ['apk', 'ipa', 'dmg', 'exe']
        }
        
        all_categories_found = True
        for category in required_categories:
            if category not in content:
                all_categories_found = False
                break
        
        # Check some key extensions
        key_extensions_found = 'pdf' in content and 'jpg' in content and 'mp3' in content and 'zip' in content
        
        if all_categories_found and key_extensions_found:
            self.log_test("Category Extension Mapping", True, "All required categories and key extensions found")
        else:
            self.log_test("Category Extension Mapping", False, "Missing required categories or extensions")

    def test_ensure_category_directories_function(self):
        """Test 5: Verify ensureCategoryDirectories creates 5 category folders"""
        content = self.read_file("src/services/FileDownloadManager.ts")
        if content is None:
            self.log_test("EnsureCategoryDirectories Function", False, "FileDownloadManager.ts not found")
            return

        has_function = 'ensureCategoryDirectories' in content
        creates_folders = 'makeDirectoryAsync' in content and 'Documents' in content and 'Images' in content
        
        if has_function and creates_folders:
            self.log_test("EnsureCategoryDirectories Function", True, "Function exists and creates category directories")
        else:
            self.log_test("EnsureCategoryDirectories Function", False, "Missing ensureCategoryDirectories or directory creation")

    def test_download_file_uses_category_routing(self):
        """Test 6: Verify downloadFile calls buildCategoryUri for routing to category subfolder"""
        content = self.read_file("src/services/FileDownloadManager.ts")
        if content is None:
            self.log_test("Download File Category Routing", False, "FileDownloadManager.ts not found")
            return

        has_build_category_uri = 'buildCategoryUri' in content
        uses_in_download = 'downloadFile' in content and 'buildCategoryUri(filename)' in content
        
        if has_build_category_uri and uses_in_download:
            self.log_test("Download File Category Routing", True, "downloadFile uses buildCategoryUri for category routing")
        else:
            self.log_test("Download File Category Routing", False, "Missing buildCategoryUri usage in downloadFile")

    def test_download_item_interface_has_category(self):
        """Test 7: Verify DownloadItem interface in DownloadsModal.tsx has category field"""
        content = self.read_file("src/components/DownloadsModal.tsx")
        if content is None:
            self.log_test("DownloadItem Category Field", False, "DownloadsModal.tsx not found")
            return

        # Look for DownloadItem interface with category field
        interface_pattern = r'export interface DownloadItem.*?{.*?category\?\s*:\s*DownloadCategory.*?}'
        has_category_field = re.search(interface_pattern, content, re.DOTALL)
        
        if has_category_field:
            self.log_test("DownloadItem Category Field", True, "DownloadItem interface includes category field")
        else:
            self.log_test("DownloadItem Category Field", False, "DownloadItem missing category field")

    def test_category_section_header_component(self):
        """Test 8: Verify CategorySectionHeader component exists with collapsible toggle"""
        content = self.read_file("src/components/DownloadsModal.tsx")
        if content is None:
            self.log_test("CategorySectionHeader Component", False, "DownloadsModal.tsx not found")
            return

        has_component = 'CategorySectionHeader' in content
        has_props = 'category: DownloadCategory' in content and 'collapsed: boolean' in content and 'onToggle' in content
        has_collapsible = 'chevron-forward' in content or 'chevron-down' in content
        
        if has_component and has_props and has_collapsible:
            self.log_test("CategorySectionHeader Component", True, "Component exists with collapsible functionality")
        else:
            self.log_test("CategorySectionHeader Component", False, "Missing CategorySectionHeader or collapsible features")

    def test_downloads_modal_grouped_view(self):
        """Test 9: Verify isGrouped state and groupToggle button in DownloadsModal"""
        content = self.read_file("src/components/DownloadsModal.tsx")
        if content is None:
            self.log_test("DownloadsModal Grouped View", False, "DownloadsModal.tsx not found")
            return

        has_is_grouped = 'isGrouped' in content and 'setIsGrouped' in content
        has_group_toggle = 'groupToggle' in content or 'toggle-group-view' in content
        has_section_list = 'SectionList' in content
        
        if has_is_grouped and has_group_toggle and has_section_list:
            self.log_test("DownloadsModal Grouped View", True, "Grouped view with toggle button and SectionList implemented")
        else:
            self.log_test("DownloadsModal Grouped View", False, "Missing grouped view functionality")

    def test_grouped_sections_use_memo(self):
        """Test 10: Verify groupedSections useMemo groups downloads by category"""
        content = self.read_file("src/components/DownloadsModal.tsx")
        if content is None:
            self.log_test("GroupedSections UseMemo", False, "DownloadsModal.tsx not found")
            return

        has_grouped_sections = 'groupedSections' in content and 'useMemo' in content
        groups_by_category = 'getCategoryForFile' in content and 'Documents:' in content
        
        if has_grouped_sections and groups_by_category:
            self.log_test("GroupedSections UseMemo", True, "groupedSections useMemo groups by category")
        else:
            self.log_test("GroupedSections UseMemo", False, "Missing groupedSections or category grouping")

    def test_add_download_to_list_category_detection(self):
        """Test 11: Verify addDownloadToList calls getCategoryForFile for auto-detection"""
        content = self.read_file("src/components/DownloadsModal.tsx")
        if content is None:
            self.log_test("AddDownloadToList Category Detection", False, "DownloadsModal.tsx not found")
            return

        has_function = 'addDownloadToList' in content and 'getCategoryForFile' in content
        auto_detects = 'getCategoryForFile(filename)' in content
        
        if has_function and auto_detects:
            self.log_test("AddDownloadToList Category Detection", True, "addDownloadToList auto-detects category via getCategoryForFile")
        else:
            self.log_test("AddDownloadToList Category Detection", False, "Missing category auto-detection in addDownloadToList")

    def run_all_tests(self):
        """Run all code verification tests"""
        print(f"{Colors.BOLD}{Colors.BLUE}=== AURA BROWSER AUTO-CATEGORIZATION CODE VERIFICATION ==={Colors.RESET}")
        print(f"Frontend path: {self.frontend_path}")
        print()
        
        # Run all tests
        self.test_file_download_manager_exports()
        self.test_category_constants_exports()
        self.test_download_result_type_includes_category()
        self.test_category_folder_mapping()
        self.test_ensure_category_directories_function()
        self.test_download_file_uses_category_routing()
        self.test_download_item_interface_has_category()
        self.test_category_section_header_component()
        self.test_downloads_modal_grouped_view()
        self.test_grouped_sections_use_memo()
        self.test_add_download_to_list_category_detection()
        
        # Summary
        print()
        print(f"{Colors.BOLD}=== CODE VERIFICATION SUMMARY ==={Colors.RESET}")
        if self.passed_tests == self.total_tests:
            print(f"{Colors.GREEN}✅ All {self.total_tests} code verification tests PASSED{Colors.RESET}")
            return True
        else:
            print(f"{Colors.RED}❌ {self.total_tests - self.passed_tests} of {self.total_tests} tests FAILED{Colors.RESET}")
            return False

def main():
    """Main test runner"""
    tester = CodeVerificationTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()