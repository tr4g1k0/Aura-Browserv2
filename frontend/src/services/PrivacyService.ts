/**
 * Privacy Service
 * 
 * Handles data privacy, masking sensitive information, and managing
 * AI context memory for the ACCESS Browser.
 * 
 * Features:
 * - Sensitive data masking (passwords, credit cards, SSN, etc.)
 * - Agent memory management
 * - Privacy audit logging
 * - Data retention policies
 */

// ============================================================================
// TYPES
// ============================================================================

export interface SensitiveField {
  selector: string;
  type: string;
  reason: string;
}

export interface PrivacyAuditEntry {
  timestamp: number;
  action: 'page_read' | 'data_masked' | 'memory_cleared' | 'agent_action';
  details: string;
  url?: string;
}

export interface AgentMemory {
  sessionId: string;
  startedAt: number;
  pagesVisited: string[];
  contextWindow: string[];
  actionsPerformed: number;
}

// ============================================================================
// SENSITIVE DATA PATTERNS
// ============================================================================

// Input types that should always be masked
const SENSITIVE_INPUT_TYPES = [
  'password',
  'tel',
  'cc-number',
  'cc-exp',
  'cc-csc',
];

// Autocomplete attributes indicating sensitive data
const SENSITIVE_AUTOCOMPLETE_VALUES = [
  'cc-number',
  'cc-exp',
  'cc-exp-month',
  'cc-exp-year',
  'cc-csc',
  'cc-type',
  'cc-name',
  'new-password',
  'current-password',
  'one-time-code',
];

// Name/ID patterns indicating sensitive fields
const SENSITIVE_NAME_PATTERNS = [
  /password/i,
  /passwd/i,
  /secret/i,
  /credit.?card/i,
  /card.?number/i,
  /cc.?num/i,
  /cvv/i,
  /cvc/i,
  /security.?code/i,
  /expir/i,
  /ssn/i,
  /social.?security/i,
  /tax.?id/i,
  /bank.?account/i,
  /routing.?number/i,
  /pin/i,
  /otp/i,
  /verification.?code/i,
  /auth.?code/i,
  /token/i,
];

// ============================================================================
// INTERNAL STATE
// ============================================================================

let privacyAuditLog: PrivacyAuditEntry[] = [];
let agentMemory: AgentMemory | null = null;
const MAX_AUDIT_ENTRIES = 100;
const MAX_CONTEXT_WINDOW = 10;

// ============================================================================
// DATA MASKING FUNCTIONS
// ============================================================================

/**
 * Check if an input field is sensitive and should be masked
 */
export const isSensitiveField = (
  type?: string,
  name?: string,
  id?: string,
  autocomplete?: string,
  className?: string
): { isSensitive: boolean; reason: string } => {
  // Check input type
  if (type && SENSITIVE_INPUT_TYPES.includes(type.toLowerCase())) {
    return { isSensitive: true, reason: `Input type: ${type}` };
  }
  
  // Check autocomplete attribute
  if (autocomplete) {
    const autoLower = autocomplete.toLowerCase();
    for (const sensitive of SENSITIVE_AUTOCOMPLETE_VALUES) {
      if (autoLower.includes(sensitive)) {
        return { isSensitive: true, reason: `Autocomplete: ${autocomplete}` };
      }
    }
  }
  
  // Check name attribute
  if (name) {
    for (const pattern of SENSITIVE_NAME_PATTERNS) {
      if (pattern.test(name)) {
        return { isSensitive: true, reason: `Name matches pattern: ${name}` };
      }
    }
  }
  
  // Check ID attribute
  if (id) {
    for (const pattern of SENSITIVE_NAME_PATTERNS) {
      if (pattern.test(id)) {
        return { isSensitive: true, reason: `ID matches pattern: ${id}` };
      }
    }
  }
  
  // Check class name
  if (className) {
    for (const pattern of SENSITIVE_NAME_PATTERNS) {
      if (pattern.test(className)) {
        return { isSensitive: true, reason: `Class matches pattern` };
      }
    }
  }
  
  return { isSensitive: false, reason: '' };
};

/**
 * Generate JavaScript to mask sensitive fields in page content
 * This script redacts sensitive input values before sending to AI
 */
export const getSensitiveDataMaskingScript = (): string => `
(function() {
  'use strict';
  
  const SENSITIVE_TYPES = ${JSON.stringify(SENSITIVE_INPUT_TYPES)};
  const SENSITIVE_AUTOCOMPLETE = ${JSON.stringify(SENSITIVE_AUTOCOMPLETE_VALUES)};
  const SENSITIVE_PATTERNS = [
    /password/i, /passwd/i, /secret/i, /credit.?card/i,
    /card.?number/i, /cc.?num/i, /cvv/i, /cvc/i, /security.?code/i,
    /ssn/i, /social.?security/i, /bank.?account/i, /pin/i, /otp/i
  ];
  
  function isSensitive(el) {
    const type = (el.type || '').toLowerCase();
    const name = el.name || '';
    const id = el.id || '';
    const autocomplete = el.autocomplete || '';
    
    if (SENSITIVE_TYPES.includes(type)) return true;
    
    for (const auto of SENSITIVE_AUTOCOMPLETE) {
      if (autocomplete.toLowerCase().includes(auto)) return true;
    }
    
    for (const pattern of SENSITIVE_PATTERNS) {
      if (pattern.test(name) || pattern.test(id)) return true;
    }
    
    return false;
  }
  
  // Collect page data with sensitive fields masked
  const pageData = {
    url: window.location.href,
    title: document.title,
    maskedFields: [],
    safeContent: ''
  };
  
  // Find and log sensitive fields (but don't include their values)
  document.querySelectorAll('input, textarea').forEach(el => {
    if (isSensitive(el)) {
      pageData.maskedFields.push({
        tag: el.tagName.toLowerCase(),
        type: el.type || 'text',
        placeholder: el.placeholder || '',
        // Value is explicitly NOT included
        masked: true
      });
    }
  });
  
  // Get text content excluding scripts and sensitive areas
  const clone = document.body.cloneNode(true);
  
  // Remove scripts, styles, and sensitive forms
  clone.querySelectorAll('script, style, noscript').forEach(el => el.remove());
  clone.querySelectorAll('input[type="password"], input[autocomplete*="cc-"]').forEach(el => {
    el.value = '[REDACTED]';
  });
  
  pageData.safeContent = clone.textContent?.replace(/\\s+/g, ' ').trim().substring(0, 5000) || '';
  
  window.ReactNativeWebView.postMessage(JSON.stringify({
    type: 'PRIVACY_SAFE_CONTENT',
    data: pageData
  }));
})();
true;
`;

/**
 * Redact sensitive values from a page sitemap
 */
export const redactSensitiveFromSitemap = (sitemap: any): any => {
  if (!sitemap) return sitemap;
  
  const redacted = { ...sitemap };
  
  // Redact input values
  if (redacted.inputs) {
    redacted.inputs = redacted.inputs.map((input: any) => {
      const check = isSensitiveField(
        input.type,
        input.name,
        input.id,
        input.autocomplete,
        input.className
      );
      
      if (check.isSensitive) {
        return {
          ...input,
          value: '[REDACTED]',
          placeholder: input.placeholder ? '[Sensitive Field]' : undefined,
          redacted: true,
          redactReason: check.reason,
        };
      }
      return input;
    });
  }
  
  return redacted;
};

// ============================================================================
// AGENT MEMORY MANAGEMENT
// ============================================================================

/**
 * Initialize a new agent memory session
 */
export const initAgentMemory = (): AgentMemory => {
  agentMemory = {
    sessionId: Math.random().toString(36).substring(2, 11),
    startedAt: Date.now(),
    pagesVisited: [],
    contextWindow: [],
    actionsPerformed: 0,
  };
  
  logPrivacyAction('agent_action', 'Agent memory initialized');
  
  return agentMemory;
};

/**
 * Get current agent memory
 */
export const getAgentMemory = (): AgentMemory | null => agentMemory;

/**
 * Add page to agent context
 */
export const addPageToContext = (url: string, summary?: string): void => {
  if (!agentMemory) {
    initAgentMemory();
  }
  
  if (agentMemory) {
    // Add to pages visited
    if (!agentMemory.pagesVisited.includes(url)) {
      agentMemory.pagesVisited.push(url);
    }
    
    // Add to context window (with limit)
    const contextEntry = summary || url;
    agentMemory.contextWindow.push(contextEntry);
    
    // Trim to max size
    while (agentMemory.contextWindow.length > MAX_CONTEXT_WINDOW) {
      agentMemory.contextWindow.shift();
    }
    
    logPrivacyAction('page_read', `Page added to context: ${url}`);
  }
};

/**
 * Record an agent action
 */
export const recordAgentAction = (): void => {
  if (agentMemory) {
    agentMemory.actionsPerformed++;
  }
};

/**
 * Clear agent memory completely
 */
export const clearAgentMemory = (): boolean => {
  const hadMemory = agentMemory !== null;
  
  agentMemory = null;
  
  if (hadMemory) {
    logPrivacyAction('memory_cleared', 'Agent memory cleared by user');
  }
  
  console.log('[PrivacyService] Agent memory cleared');
  return hadMemory;
};

/**
 * Get agent memory stats for display
 */
export const getAgentMemoryStats = (): {
  hasMemory: boolean;
  pagesCount: number;
  contextSize: number;
  actionsCount: number;
  sessionDuration: number;
} => {
  if (!agentMemory) {
    return {
      hasMemory: false,
      pagesCount: 0,
      contextSize: 0,
      actionsCount: 0,
      sessionDuration: 0,
    };
  }
  
  return {
    hasMemory: true,
    pagesCount: agentMemory.pagesVisited.length,
    contextSize: agentMemory.contextWindow.length,
    actionsCount: agentMemory.actionsPerformed,
    sessionDuration: Date.now() - agentMemory.startedAt,
  };
};

// ============================================================================
// PRIVACY AUDIT LOG
// ============================================================================

/**
 * Log a privacy-related action
 */
export const logPrivacyAction = (
  action: PrivacyAuditEntry['action'],
  details: string,
  url?: string
): void => {
  const entry: PrivacyAuditEntry = {
    timestamp: Date.now(),
    action,
    details,
    url,
  };
  
  privacyAuditLog.push(entry);
  
  // Trim to max size
  while (privacyAuditLog.length > MAX_AUDIT_ENTRIES) {
    privacyAuditLog.shift();
  }
};

/**
 * Get privacy audit log
 */
export const getPrivacyAuditLog = (): PrivacyAuditEntry[] => {
  return [...privacyAuditLog];
};

/**
 * Clear privacy audit log
 */
export const clearPrivacyAuditLog = (): void => {
  privacyAuditLog = [];
};

// ============================================================================
// PRIVACY MANIFEST CONTENT
// ============================================================================

export const PRIVACY_MANIFEST = {
  whatAISees: {
    title: 'What the AI Sees',
    icon: 'eye-outline',
    color: '#8B5CF6',
    content: [
      'The AI reads the active tab\'s text and structure (DOM) only when you open the AI Agent or activate Live Captions.',
      'It can see: page title, headings, button text, link labels, and form field names.',
      'It cannot see: your browsing history, other tabs, or any data from pages you haven\'t explicitly asked it to analyze.',
    ],
  },
  whatStaysLocal: {
    title: 'What Stays on Your Phone',
    icon: 'phone-portrait-outline',
    color: '#10B981',
    content: [
      'All Speech-to-Text (STT) processing runs locally on your device\'s hardware using ONNX models.',
      'Ad-blocking vision models analyze page content entirely on-device.',
      'No audio recordings, screenshots, or page content is ever sent to external servers.',
      'Your browsing remains private - we can\'t see what you\'re viewing.',
    ],
  },
  sensitiveData: {
    title: 'Sensitive Data Protection',
    icon: 'shield-checkmark-outline',
    color: '#F59E0B',
    content: [
      'Password fields are automatically redacted and never read by the AI.',
      'Credit card inputs (cc-number, cvv, expiration) are masked before processing.',
      'Social Security numbers, bank accounts, and PINs are protected by pattern detection.',
      'You can clear all AI context at any time with the "Clear Agent Memory" button.',
    ],
  },
};

export default {
  isSensitiveField,
  getSensitiveDataMaskingScript,
  redactSensitiveFromSitemap,
  initAgentMemory,
  getAgentMemory,
  addPageToContext,
  recordAgentAction,
  clearAgentMemory,
  getAgentMemoryStats,
  logPrivacyAction,
  getPrivacyAuditLog,
  clearPrivacyAuditLog,
  PRIVACY_MANIFEST,
};
