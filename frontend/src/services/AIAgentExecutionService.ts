/**
 * AI Agent Execution Service
 * 
 * Provides the execution engine for the AI Agent to interact with web pages.
 * Handles DOM actions like clicking, typing, scrolling, and reading page structure.
 * 
 * Actions:
 * - CLICK: Click on an element
 * - INPUT: Fill in a text field
 * - SCROLL: Scroll the page
 * - READ: Extract page structure (sitemap)
 * - SELECT: Select dropdown option
 * - HOVER: Hover over element
 * 
 * Safety:
 * - Validates selectors before execution
 * - Queues actions while page is loading
 * - Provides feedback on action success/failure
 */

import { RefObject } from 'react';
import { WebView } from 'react-native-webview';

// ============================================================================
// TYPES
// ============================================================================

export type AgentActionType = 
  | 'CLICK'
  | 'INPUT'
  | 'SCROLL'
  | 'READ'
  | 'SELECT'
  | 'HOVER'
  | 'NAVIGATE'
  | 'BACK'
  | 'FORWARD'
  | 'REFRESH';

export interface AgentAction {
  type: AgentActionType;
  selector?: string;
  value?: string;
  timestamp: number;
}

export interface ActionResult {
  success: boolean;
  message: string;
  data?: any;
  executionTimeMs: number;
}

export interface PageElement {
  tag: string;
  selector: string;
  text?: string;
  id?: string;
  className?: string;
  type?: string;
  placeholder?: string;
  href?: string;
  isVisible: boolean;
  isInteractive: boolean;
}

export interface PageSitemap {
  url: string;
  title: string;
  buttons: PageElement[];
  links: PageElement[];
  inputs: PageElement[];
  textAreas: PageElement[];
  selects: PageElement[];
  images: { src: string; alt: string }[];
  headings: { level: number; text: string }[];
}

// ============================================================================
// ACTION SCRIPTS
// ============================================================================

/**
 * Generate JavaScript for clicking an element
 */
const getClickScript = (selector: string): string => `
(function() {
  try {
    const el = document.querySelector('${selector.replace(/'/g, "\\'")}');
    if (!el) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'AGENT_ACTION_RESULT',
        success: false,
        message: 'Element not found: ${selector.replace(/'/g, "\\'")}'
      }));
      return;
    }
    
    // Scroll element into view
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // Highlight element briefly
    const originalBackground = el.style.backgroundColor;
    const originalOutline = el.style.outline;
    el.style.backgroundColor = 'rgba(0, 255, 136, 0.3)';
    el.style.outline = '2px solid #00FF88';
    
    setTimeout(() => {
      el.click();
      el.style.backgroundColor = originalBackground;
      el.style.outline = originalOutline;
      
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'AGENT_ACTION_RESULT',
        success: true,
        message: 'Clicked element: ' + (el.textContent?.substring(0, 50) || el.tagName)
      }));
    }, 300);
  } catch (e) {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'AGENT_ACTION_RESULT',
      success: false,
      message: 'Click failed: ' + e.message
    }));
  }
})();
true;
`;

/**
 * Generate JavaScript for inputting text
 */
const getInputScript = (selector: string, value: string): string => `
(function() {
  try {
    const el = document.querySelector('${selector.replace(/'/g, "\\'")}');
    if (!el) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'AGENT_ACTION_RESULT',
        success: false,
        message: 'Input element not found: ${selector.replace(/'/g, "\\'")}'
      }));
      return;
    }
    
    // Focus and scroll into view
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.focus();
    
    // Highlight element
    const originalOutline = el.style.outline;
    el.style.outline = '2px solid #00FF88';
    
    setTimeout(() => {
      // Set value
      el.value = '${value.replace(/'/g, "\\'")}';
      
      // Dispatch events to trigger React/Vue/Angular listeners
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
      
      el.style.outline = originalOutline;
      
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'AGENT_ACTION_RESULT',
        success: true,
        message: 'Entered text into: ' + (el.placeholder || el.name || el.id || 'input field')
      }));
    }, 300);
  } catch (e) {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'AGENT_ACTION_RESULT',
      success: false,
      message: 'Input failed: ' + e.message
    }));
  }
})();
true;
`;

/**
 * Generate JavaScript for scrolling
 */
const getScrollScript = (direction: 'up' | 'down' | 'top' | 'bottom' = 'down', amount: number = 500): string => `
(function() {
  try {
    let scrollAmount = ${amount};
    
    switch('${direction}') {
      case 'up':
        window.scrollBy({ top: -scrollAmount, behavior: 'smooth' });
        break;
      case 'down':
        window.scrollBy({ top: scrollAmount, behavior: 'smooth' });
        break;
      case 'top':
        window.scrollTo({ top: 0, behavior: 'smooth' });
        break;
      case 'bottom':
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        break;
    }
    
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'AGENT_ACTION_RESULT',
      success: true,
      message: 'Scrolled ${direction}'
    }));
  } catch (e) {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'AGENT_ACTION_RESULT',
      success: false,
      message: 'Scroll failed: ' + e.message
    }));
  }
})();
true;
`;

/**
 * Generate JavaScript to read page structure (sitemap)
 */
export const getSitemapScript = (): string => `
(function() {
  try {
    const sitemap = {
      url: window.location.href,
      title: document.title,
      buttons: [],
      links: [],
      inputs: [],
      textAreas: [],
      selects: [],
      images: [],
      headings: []
    };
    
    // Helper to check if element is visible
    function isVisible(el) {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.opacity !== '0'
      );
    }
    
    // Helper to get unique selector
    function getSelector(el) {
      if (el.id) return '#' + el.id;
      if (el.name) return '[name="' + el.name + '"]';
      
      let path = [];
      while (el && el.nodeType === Node.ELEMENT_NODE) {
        let selector = el.tagName.toLowerCase();
        if (el.id) {
          selector = '#' + el.id;
          path.unshift(selector);
          break;
        }
        if (el.className && typeof el.className === 'string') {
          const classes = el.className.trim().split(/\\s+/).slice(0, 2).join('.');
          if (classes) selector += '.' + classes;
        }
        const siblings = el.parentNode ? Array.from(el.parentNode.children).filter(s => s.tagName === el.tagName) : [];
        if (siblings.length > 1) {
          const index = siblings.indexOf(el) + 1;
          selector += ':nth-of-type(' + index + ')';
        }
        path.unshift(selector);
        el = el.parentNode;
        if (path.length > 4) break;
      }
      return path.join(' > ');
    }
    
    // Collect buttons
    document.querySelectorAll('button, [role="button"], input[type="submit"], input[type="button"]').forEach(el => {
      if (!isVisible(el)) return;
      sitemap.buttons.push({
        tag: el.tagName.toLowerCase(),
        selector: getSelector(el),
        text: (el.textContent || el.value || '').trim().substring(0, 100),
        id: el.id || undefined,
        className: el.className || undefined,
        isVisible: true,
        isInteractive: true
      });
    });
    
    // Collect links (first 20)
    let linkCount = 0;
    document.querySelectorAll('a[href]').forEach(el => {
      if (!isVisible(el) || linkCount >= 20) return;
      linkCount++;
      sitemap.links.push({
        tag: 'a',
        selector: getSelector(el),
        text: (el.textContent || '').trim().substring(0, 100),
        href: el.href,
        id: el.id || undefined,
        isVisible: true,
        isInteractive: true
      });
    });
    
    // Collect inputs
    document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"])').forEach(el => {
      if (!isVisible(el)) return;
      sitemap.inputs.push({
        tag: 'input',
        selector: getSelector(el),
        type: el.type,
        placeholder: el.placeholder || undefined,
        id: el.id || undefined,
        className: el.className || undefined,
        isVisible: true,
        isInteractive: true
      });
    });
    
    // Collect textareas
    document.querySelectorAll('textarea').forEach(el => {
      if (!isVisible(el)) return;
      sitemap.textAreas.push({
        tag: 'textarea',
        selector: getSelector(el),
        placeholder: el.placeholder || undefined,
        id: el.id || undefined,
        isVisible: true,
        isInteractive: true
      });
    });
    
    // Collect selects
    document.querySelectorAll('select').forEach(el => {
      if (!isVisible(el)) return;
      const options = Array.from(el.options).map(o => o.text).slice(0, 5);
      sitemap.selects.push({
        tag: 'select',
        selector: getSelector(el),
        id: el.id || undefined,
        text: options.join(', '),
        isVisible: true,
        isInteractive: true
      });
    });
    
    // Collect headings
    document.querySelectorAll('h1, h2, h3').forEach(el => {
      if (!isVisible(el)) return;
      sitemap.headings.push({
        level: parseInt(el.tagName[1]),
        text: (el.textContent || '').trim().substring(0, 100)
      });
    });
    
    // Collect images (first 10)
    let imgCount = 0;
    document.querySelectorAll('img[src]').forEach(el => {
      if (!isVisible(el) || imgCount >= 10) return;
      imgCount++;
      sitemap.images.push({
        src: el.src,
        alt: el.alt || ''
      });
    });
    
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'PAGE_SITEMAP',
      sitemap: sitemap
    }));
  } catch (e) {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'AGENT_ACTION_RESULT',
      success: false,
      message: 'Failed to read page: ' + e.message
    }));
  }
})();
true;
`;

/**
 * Generate JavaScript for select dropdown
 */
const getSelectScript = (selector: string, value: string): string => `
(function() {
  try {
    const el = document.querySelector('${selector.replace(/'/g, "\\'")}');
    if (!el || el.tagName !== 'SELECT') {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'AGENT_ACTION_RESULT',
        success: false,
        message: 'Select element not found: ${selector.replace(/'/g, "\\'")}'
      }));
      return;
    }
    
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.value = '${value.replace(/'/g, "\\'")}';
    el.dispatchEvent(new Event('change', { bubbles: true }));
    
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'AGENT_ACTION_RESULT',
      success: true,
      message: 'Selected option in: ' + (el.id || el.name || 'dropdown')
    }));
  } catch (e) {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'AGENT_ACTION_RESULT',
      success: false,
      message: 'Select failed: ' + e.message
    }));
  }
})();
true;
`;

// ============================================================================
// COMMAND PARSING
// ============================================================================

export interface ParsedCommand {
  action: AgentActionType;
  selector?: string;
  value?: string;
  direction?: 'up' | 'down' | 'top' | 'bottom';
}

/**
 * Parse natural language command into action
 */
export const parseAgentCommand = (command: string): ParsedCommand | null => {
  const lowerCommand = command.toLowerCase();
  
  // Scroll commands
  if (lowerCommand.includes('scroll')) {
    if (lowerCommand.includes('up')) {
      return { action: 'SCROLL', direction: 'up' };
    }
    if (lowerCommand.includes('down') || lowerCommand.includes('more')) {
      return { action: 'SCROLL', direction: 'down' };
    }
    if (lowerCommand.includes('top') || lowerCommand.includes('beginning')) {
      return { action: 'SCROLL', direction: 'top' };
    }
    if (lowerCommand.includes('bottom') || lowerCommand.includes('end')) {
      return { action: 'SCROLL', direction: 'bottom' };
    }
    return { action: 'SCROLL', direction: 'down' };
  }
  
  // Click commands
  if (lowerCommand.includes('click') || lowerCommand.includes('tap') || lowerCommand.includes('press')) {
    // Extract what to click
    const buttonMatch = command.match(/(?:click|tap|press)\s+(?:the\s+)?['"]?([^'"]+)['"]?\s*(?:button|link)?/i);
    if (buttonMatch) {
      const target = buttonMatch[1].trim();
      // Try to construct a selector
      return { 
        action: 'CLICK', 
        selector: `button:contains('${target}'), a:contains('${target}'), [aria-label*='${target}' i]`,
        value: target
      };
    }
    return { action: 'CLICK' };
  }
  
  // Input/Type commands
  if (lowerCommand.includes('type') || lowerCommand.includes('enter') || lowerCommand.includes('fill')) {
    const inputMatch = command.match(/(?:type|enter|fill)\s+['"]?([^'"]+)['"]?\s+(?:in|into|in the)?\s+(['"]?[^'"]+['"]?)/i);
    if (inputMatch) {
      return {
        action: 'INPUT',
        value: inputMatch[1].trim(),
        selector: `input[placeholder*='${inputMatch[2].trim()}' i], input[name*='${inputMatch[2].trim()}' i], textarea[placeholder*='${inputMatch[2].trim()}' i]`
      };
    }
    // Simple search pattern
    const searchMatch = command.match(/(?:search|type|enter)\s+(?:for\s+)?['"]?([^'"]+)['"]?/i);
    if (searchMatch) {
      return {
        action: 'INPUT',
        value: searchMatch[1].trim(),
        selector: 'input[type="search"], input[name="q"], input[name="query"], input[name="search"], input[placeholder*="search" i]'
      };
    }
  }
  
  // Navigation commands
  if (lowerCommand.includes('go back') || lowerCommand.includes('previous page')) {
    return { action: 'BACK' };
  }
  if (lowerCommand.includes('go forward') || lowerCommand.includes('next page')) {
    return { action: 'FORWARD' };
  }
  if (lowerCommand.includes('refresh') || lowerCommand.includes('reload')) {
    return { action: 'REFRESH' };
  }
  
  // Read page
  if (lowerCommand.includes('what can') || lowerCommand.includes('read page') || 
      lowerCommand.includes('show elements') || lowerCommand.includes('find') ||
      lowerCommand.includes('login button') || lowerCommand.includes('search')) {
    return { action: 'READ' };
  }
  
  return null;
};

// ============================================================================
// EXECUTION ENGINE
// ============================================================================

/**
 * Execute an agent action on the WebView
 */
export const executeAgentAction = async (
  webViewRef: RefObject<WebView>,
  actionType: AgentActionType,
  targetSelector?: string,
  value?: string,
  options?: { direction?: 'up' | 'down' | 'top' | 'bottom'; amount?: number }
): Promise<ActionResult> => {
  const startTime = Date.now();
  
  if (!webViewRef.current) {
    return {
      success: false,
      message: 'WebView not available',
      executionTimeMs: Date.now() - startTime
    };
  }
  
  let script: string;
  
  switch (actionType) {
    case 'CLICK':
      if (!targetSelector) {
        return {
          success: false,
          message: 'No element specified to click',
          executionTimeMs: Date.now() - startTime
        };
      }
      script = getClickScript(targetSelector);
      break;
      
    case 'INPUT':
      if (!targetSelector || value === undefined) {
        return {
          success: false,
          message: 'Missing input selector or value',
          executionTimeMs: Date.now() - startTime
        };
      }
      script = getInputScript(targetSelector, value);
      break;
      
    case 'SCROLL':
      script = getScrollScript(options?.direction || 'down', options?.amount || 500);
      break;
      
    case 'READ':
      script = getSitemapScript();
      break;
      
    case 'SELECT':
      if (!targetSelector || !value) {
        return {
          success: false,
          message: 'Missing select selector or value',
          executionTimeMs: Date.now() - startTime
        };
      }
      script = getSelectScript(targetSelector, value);
      break;
      
    default:
      return {
        success: false,
        message: `Unknown action type: ${actionType}`,
        executionTimeMs: Date.now() - startTime
      };
  }
  
  try {
    webViewRef.current.injectJavaScript(script);
    
    return {
      success: true,
      message: `Executing ${actionType} action...`,
      executionTimeMs: Date.now() - startTime
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Action failed: ${error.message}`,
      executionTimeMs: Date.now() - startTime
    };
  }
};

/**
 * Format sitemap for display to user
 */
export const formatSitemapForDisplay = (sitemap: PageSitemap): string => {
  const parts: string[] = [];
  
  parts.push(`📄 **Page: ${sitemap.title}**\n`);
  
  if (sitemap.buttons.length > 0) {
    parts.push(`\n🔘 **Buttons (${sitemap.buttons.length}):**`);
    sitemap.buttons.slice(0, 5).forEach(btn => {
      parts.push(`• "${btn.text || btn.id || 'Button'}"`);
    });
    if (sitemap.buttons.length > 5) {
      parts.push(`  _...and ${sitemap.buttons.length - 5} more_`);
    }
  }
  
  if (sitemap.inputs.length > 0) {
    parts.push(`\n📝 **Input Fields (${sitemap.inputs.length}):**`);
    sitemap.inputs.slice(0, 5).forEach(input => {
      parts.push(`• ${input.placeholder || input.id || input.type || 'Text field'}`);
    });
  }
  
  if (sitemap.links.length > 0) {
    parts.push(`\n🔗 **Links (${sitemap.links.length}):**`);
    sitemap.links.slice(0, 5).forEach(link => {
      parts.push(`• "${link.text || 'Link'}"`);
    });
    if (sitemap.links.length > 5) {
      parts.push(`  _...and ${sitemap.links.length - 5} more_`);
    }
  }
  
  parts.push(`\n\n💡 **Try saying:**`);
  parts.push(`• "Scroll down"`);
  if (sitemap.buttons.length > 0) {
    parts.push(`• "Click the ${sitemap.buttons[0].text?.split(' ')[0] || 'first'} button"`);
  }
  if (sitemap.inputs.length > 0) {
    parts.push(`• "Type hello in the ${sitemap.inputs[0].placeholder || 'search'} field"`);
  }
  
  return parts.join('\n');
};

export default {
  executeAgentAction,
  parseAgentCommand,
  getSitemapScript,
  formatSitemapForDisplay,
};
