#!/usr/bin/env python3
"""
Aura Browser Text Selection Menu - Code Verification Testing Suite
Verifies all Text Selection Menu components and integration are properly implemented.
"""

import os
import re
import sys
from pathlib import Path
from typing import List, Dict, Any, Optional

class CodeVerificationResults:
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
        print(f"\n" + "="*70)
        print(f"🧪 TEXT SELECTION MENU CODE VERIFICATION SUMMARY")
        print(f"="*70)
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
            print(f"🎉 ALL CODE VERIFICATION TESTS PASSED!")
            print(f"Text Selection Menu is properly implemented and ready for use.")
        else:
            print(f"⚠️  Some tests failed. Please fix issues before proceeding.")

def read_file(filepath: str) -> str:
    """Read file content safely"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        print(f"   Error reading {filepath}: {e}")
        return ""

def test_text_selection_menu_component_exists():
    """Test 1: Verify TextSelectionMenu component exists"""
    filepath = "/app/frontend/src/components/TextSelectionMenu.tsx"
    
    if not os.path.exists(filepath):
        print(f"   ❌ File not found: {filepath}")
        return False
    
    print(f"   ✓ File exists: {filepath}")
    return True

def test_text_selection_menu_props():
    """Test 2: Verify TextSelectionMenu component accepts correct props"""
    filepath = "/app/frontend/src/components/TextSelectionMenu.tsx"
    content = read_file(filepath)
    
    if not content:
        return False
    
    # Check interface definition
    if "interface TextSelectionMenuProps" not in content:
        print(f"   ❌ TextSelectionMenuProps interface not found")
        return False
    
    required_props = [
        "visible: boolean",
        "selectedText: string", 
        "onClose: () => void",
        "onNavigate: (url: string) => void"
    ]
    
    for prop in required_props:
        if prop not in content:
            print(f"   ❌ Missing prop: {prop}")
            return False
    
    print(f"   ✓ All required props found: {', '.join([p.split(':')[0] for p in required_props])}")
    return True

def test_text_selection_menu_tool_buttons():
    """Test 3: Verify TextSelectionMenu has 4 tool buttons with correct testIds"""
    filepath = "/app/frontend/src/components/TextSelectionMenu.tsx"
    content = read_file(filepath)
    
    if not content:
        return False
    
    expected_test_ids = [
        "text-menu-explain",
        "text-menu-summarize", 
        "text-menu-secure-search",
        "text-menu-copy"
    ]
    
    for test_id in expected_test_ids:
        if test_id not in content:
            print(f"   ❌ Missing testId: {test_id}")
            return False
    
    # Check backdrop testId
    if "text-menu-backdrop" not in content:
        print(f"   ❌ Missing backdrop testId: text-menu-backdrop")
        return False
    
    print(f"   ✓ All required testIds found: {', '.join(expected_test_ids)} + backdrop")
    return True

def test_text_selection_state_management():
    """Test 4: Verify selectedText and isTextMenuVisible state in index.tsx"""
    filepath = "/app/frontend/app/index.tsx"
    content = read_file(filepath)
    
    if not content:
        return False
    
    # Check state declarations
    state_checks = [
        ("selectedText state", r"const \[selectedText, setSelectedText\] = useState\(''\)"),
        ("isTextMenuVisible state", r"const \[isTextMenuVisible, setIsTextMenuVisible\] = useState\(false\)")
    ]
    
    for check_name, pattern in state_checks:
        if not re.search(pattern, content):
            print(f"   ❌ {check_name} not found")
            return False
    
    print(f"   ✓ Both state variables properly declared")
    return True

def test_text_long_press_handler():
    """Test 5: Verify TEXT_LONG_PRESS message handler"""
    filepath = "/app/frontend/app/index.tsx"
    content = read_file(filepath)
    
    if not content:
        return False
    
    # Check for TEXT_LONG_PRESS handler
    if "data.type === 'TEXT_LONG_PRESS'" not in content:
        print(f"   ❌ TEXT_LONG_PRESS handler not found")
        return False
    
    # Check handler sets state
    handler_checks = [
        "setSelectedText",
        "setIsTextMenuVisible", 
        "Haptics.impactAsync"
    ]
    
    # Find the handler block
    lines = content.split('\n')
    handler_found = False
    handler_block = []
    in_handler = False
    
    for line in lines:
        if "data.type === 'TEXT_LONG_PRESS'" in line:
            in_handler = True
            handler_found = True
        
        if in_handler:
            handler_block.append(line)
            if '}' in line and len([c for c in line if c == '}']) >= len([c for c in line if c == '{']):
                break
    
    handler_text = '\n'.join(handler_block)
    
    for check in handler_checks:
        if check not in handler_text:
            print(f"   ❌ Missing in handler: {check}")
            return False
    
    print(f"   ✓ TEXT_LONG_PRESS handler properly implemented")
    return True

def test_unified_contextmenu_interceptor():
    """Test 6: Verify unified contextmenu interceptor handles text selection"""
    filepath = "/app/frontend/app/index.tsx"
    content = read_file(filepath)
    
    if not content:
        return False
    
    # Check for contextmenu event listener
    if "addEventListener('contextmenu'" not in content:
        print(f"   ❌ contextmenu event listener not found")
        return False
    
    # Check for text selection logic
    text_selection_checks = [
        "window.getSelection().toString().trim()",
        "TEXT_LONG_PRESS",
        "-webkit-touch-callout: none"
    ]
    
    for check in text_selection_checks:
        if check not in content:
            print(f"   ❌ Missing text selection logic: {check}")
            return False
    
    print(f"   ✓ Unified contextmenu interceptor properly handles text selection")
    return True

def test_text_selection_menu_jsx_integration():
    """Test 7: Verify TextSelectionMenu is rendered in JSX with correct props"""
    filepath = "/app/frontend/app/index.tsx"
    content = read_file(filepath)
    
    if not content:
        return False
    
    # Check component import
    if "import { TextSelectionMenu }" not in content:
        print(f"   ❌ TextSelectionMenu import not found")
        return False
    
    # Check JSX rendering
    if "<TextSelectionMenu" not in content:
        print(f"   ❌ TextSelectionMenu JSX not found")
        return False
    
    # Check props
    jsx_prop_checks = [
        "visible={isTextMenuVisible}",
        "selectedText={selectedText}",
        "onClose={() => { setIsTextMenuVisible(false); setSelectedText(''); }}",
        "onNavigate={"
    ]
    
    for prop in jsx_prop_checks:
        if prop not in content:
            print(f"   ❌ Missing JSX prop: {prop}")
            return False
    
    print(f"   ✓ TextSelectionMenu properly integrated in JSX with correct props")
    return True

def test_secure_search_url_encoding():
    """Test 8: Verify Secure Search builds correct DuckDuckGo URL with encodeURIComponent"""
    filepath = "/app/frontend/src/components/TextSelectionMenu.tsx"
    content = read_file(filepath)
    
    if not content:
        return False
    
    # Check for DuckDuckGo URL construction
    url_checks = [
        "encodeURIComponent(selectedText)",
        "https://duckduckgo.com/?q=",
        "onNavigate(`https://duckduckgo.com/?q=${query}`)"
    ]
    
    for check in url_checks:
        if check not in content:
            print(f"   ❌ Missing URL construction element: {check}")
            return False
    
    print(f"   ✓ Secure Search properly builds DuckDuckGo URL with encoding")
    return True

def test_copy_functionality():
    """Test 9: Verify Copy functionality uses Clipboard.setStringAsync"""
    filepath = "/app/frontend/src/components/TextSelectionMenu.tsx"
    content = read_file(filepath)
    
    if not content:
        return False
    
    # Check for clipboard import and usage
    clipboard_checks = [
        "import * as Clipboard from 'expo-clipboard'",
        "Clipboard.setStringAsync(selectedText)"
    ]
    
    for check in clipboard_checks:
        if check not in content:
            print(f"   ❌ Missing clipboard functionality: {check}")
            return False
    
    print(f"   ✓ Copy functionality properly implemented with expo-clipboard")
    return True

def test_haptic_feedback_integration():
    """Test 10: Verify haptic feedback is integrated in both component and handler"""
    component_file = "/app/frontend/src/components/TextSelectionMenu.tsx"
    index_file = "/app/frontend/app/index.tsx"
    
    component_content = read_file(component_file)
    index_content = read_file(index_file)
    
    if not component_content or not index_content:
        return False
    
    # Check component haptics
    if "import * as Haptics from 'expo-haptics'" not in component_content:
        print(f"   ❌ Haptics import missing in TextSelectionMenu")
        return False
    
    # Check handler haptics  
    if "Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)" not in index_content:
        print(f"   ❌ Haptics feedback missing in TEXT_LONG_PRESS handler")
        return False
    
    print(f"   ✓ Haptic feedback properly integrated in both component and handler")
    return True

def test_aura_aesthetic_styling():
    """Test 11: Verify Aura aesthetic styling constants and implementation"""
    filepath = "/app/frontend/src/components/TextSelectionMenu.tsx"
    content = read_file(filepath)
    
    if not content:
        return False
    
    # Check color constants
    color_constants = [
        "DEEP_INDIGO = '#0A0A0F'",
        "CARD_BG = '#141419'", 
        "BORDER_GLOW = 'rgba(0, 242, 255, 0.12)'",
        "AURA_BLUE = '#00F2FF'",
        "GOLD = '#FFD700'"
    ]
    
    for color in color_constants:
        if color not in content:
            print(f"   ❌ Missing color constant: {color}")
            return False
    
    # Check styling usage
    style_checks = [
        "backgroundColor: DEEP_INDIGO",
        "borderColor: BORDER_GLOW",
        "glassmorphic"  # Check for glassmorphic styling comment
    ]
    
    style_found = 0
    for check in style_checks:
        if check in content:
            style_found += 1
    
    if style_found < 2:  # At least 2 of 3 should be found
        print(f"   ❌ Aura aesthetic styling not properly applied")
        return False
    
    print(f"   ✓ Aura aesthetic styling properly implemented")
    return True

def run_code_verification_tests():
    """Run all code verification tests"""
    print(f"🚀 AURA BROWSER TEXT SELECTION MENU - CODE VERIFICATION")
    print(f"="*70)
    
    results = CodeVerificationResults()
    
    # Run all verification tests
    test_functions = [
        ("TextSelectionMenu Component Exists", test_text_selection_menu_component_exists),
        ("TextSelectionMenu Props Interface", test_text_selection_menu_props),
        ("TextSelectionMenu Tool Buttons", test_text_selection_menu_tool_buttons),
        ("Text Selection State Management", test_text_selection_state_management),
        ("TEXT_LONG_PRESS Message Handler", test_text_long_press_handler),
        ("Unified Contextmenu Interceptor", test_unified_contextmenu_interceptor),
        ("TextSelectionMenu JSX Integration", test_text_selection_menu_jsx_integration),
        ("Secure Search URL Encoding", test_secure_search_url_encoding),
        ("Copy Functionality", test_copy_functionality),
        ("Haptic Feedback Integration", test_haptic_feedback_integration),
        ("Aura Aesthetic Styling", test_aura_aesthetic_styling),
    ]
    
    for test_name, test_func in test_functions:
        results.run_test(test_name, test_func)
    
    # Print summary
    results.print_summary()
    
    return results.tests_failed == 0

if __name__ == '__main__':
    success = run_code_verification_tests()
    sys.exit(0 if success else 1)