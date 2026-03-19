// URL Parser Utility
// Parses user input and routes to appropriate URL or search engine

import { SearchEngine } from '../hooks/useBrowserSettings';

// Search engine URL templates
const SEARCH_ENGINE_URLS: Record<SearchEngine, string> = {
  google: 'https://www.google.com/search?q=',
  duckduckgo: 'https://duckduckgo.com/?q=',
  brave: 'https://search.brave.com/search?q=',
  bing: 'https://www.bing.com/search?q=',
};

// Regex to match domain-like patterns
// Matches: example.com, sub.example.com, example.co.uk, etc.
const DOMAIN_REGEX = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}(?:\/.*)?$/;

// Regex to match IP addresses
const IP_REGEX = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(?::\d+)?(?:\/.*)?$/;

// Regex to match localhost
const LOCALHOST_REGEX = /^localhost(?::\d+)?(?:\/.*)?$/i;

/**
 * Parse user input and return a valid URL
 * 
 * @param input - Raw user input from the URL bar
 * @param searchEngine - User's preferred search engine
 * @returns A valid URL string
 */
export const parseUrlInput = (
  input: string,
  searchEngine: SearchEngine = 'google'
): string => {
  // Trim whitespace
  const trimmedInput = input.trim();
  
  // Return empty if no input
  if (!trimmedInput) {
    return '';
  }

  // Rule 1: Direct URLs - already has protocol
  if (trimmedInput.startsWith('http://') || trimmedInput.startsWith('https://')) {
    return trimmedInput;
  }

  // Rule 2: Handle special protocols (file://, ftp://, etc.)
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmedInput)) {
    return trimmedInput;
  }

  // Rule 3: Domain Guessing - looks like a valid domain
  if (DOMAIN_REGEX.test(trimmedInput)) {
    return `https://${trimmedInput}`;
  }

  // Rule 4: IP Address detection
  if (IP_REGEX.test(trimmedInput)) {
    return `http://${trimmedInput}`;
  }

  // Rule 5: Localhost detection
  if (LOCALHOST_REGEX.test(trimmedInput)) {
    return `http://${trimmedInput}`;
  }

  // Rule 6: Check for common TLDs without full domain format
  // e.g., "google" might mean "google.com"
  const commonDomainPatterns = [
    { pattern: /^(google|youtube|facebook|twitter|instagram|amazon|wikipedia|reddit|netflix)$/i, tld: '.com' },
  ];
  
  for (const { pattern, tld } of commonDomainPatterns) {
    if (pattern.test(trimmedInput)) {
      return `https://www.${trimmedInput.toLowerCase()}${tld}`;
    }
  }

  // Rule 7: Search Query Fallback - treat as search query
  // Default to DuckDuckGo to avoid Google bot detection
  const encodedInput = encodeURIComponent(trimmedInput);
  const searchUrl = SEARCH_ENGINE_URLS[searchEngine] || SEARCH_ENGINE_URLS.duckduckgo;
  
  return `${searchUrl}${encodedInput}`;
};

/**
 * Extract display-friendly hostname from URL
 * 
 * @param url - Full URL string
 * @returns Hostname without 'www.' prefix
 */
export const getDisplayHostname = (url: string): string => {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

/**
 * Check if a string is a valid URL
 * 
 * @param string - String to check
 * @returns Boolean indicating if string is a valid URL
 */
export const isValidUrl = (string: string): boolean => {
  try {
    new URL(string);
    return true;
  } catch {
    return false;
  }
};

/**
 * Extract the domain from a URL
 * 
 * @param url - Full URL string
 * @returns Domain string
 */
export const extractDomain = (url: string): string => {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return '';
  }
};

/**
 * Check if URL is a search results page
 * 
 * @param url - URL to check
 * @returns Boolean indicating if URL is a search page
 */
export const isSearchResultsPage = (url: string): boolean => {
  const searchPatterns = [
    /google\.com\/search/,
    /duckduckgo\.com\/\?q=/,
    /bing\.com\/search/,
    /yahoo\.com\/search/,
  ];
  
  return searchPatterns.some(pattern => pattern.test(url));
};

/**
 * Extract search query from search results URL
 * 
 * @param url - Search results URL
 * @returns Decoded search query or null
 */
export const extractSearchQuery = (url: string): string | null => {
  try {
    const urlObj = new URL(url);
    const query = urlObj.searchParams.get('q');
    return query ? decodeURIComponent(query) : null;
  } catch {
    return null;
  }
};
