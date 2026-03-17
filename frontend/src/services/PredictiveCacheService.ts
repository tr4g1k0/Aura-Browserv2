/**
 * Predictive Cache Service
 * 
 * Implements zero-load instant navigation by pre-fetching pages the user
 * is likely to click. Uses an in-memory FIFO cache with size limits.
 * 
 * Architecture:
 * 1. DOM Link Extraction: JavaScript injected into WebView extracts top links
 * 2. Background Pre-fetching: Silently fetches HTML for predicted links
 * 3. Instant Navigation: Serves cached HTML instead of making network request
 * 
 * Cache Policy:
 * - Max 10 pages cached (configurable)
 * - FIFO eviction when limit reached
 * - TTL of 5 minutes per cached page
 * - Excludes non-HTML content types
 */

import { Platform } from 'react-native';

// ============================================================================
// TYPES
// ============================================================================

export interface CachedPage {
  url: string;
  html: string;
  baseUrl: string;
  timestamp: number;
  contentType: string;
  size: number; // bytes
}

export interface CacheStats {
  totalPages: number;
  totalSizeBytes: number;
  hitCount: number;
  missCount: number;
  hitRate: number;
  oldestEntry: number | null;
  newestEntry: number | null;
}

export interface PredictiveCacheConfig {
  maxPages: number;
  ttlMs: number;
  maxSizeBytes: number;
  enablePrefetch: boolean;
  prefetchConcurrency: number;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: PredictiveCacheConfig = {
  maxPages: 5,  // Reduced from 10 to save memory
  ttlMs: 5 * 60 * 1000, // 5 minutes
  maxSizeBytes: 20 * 1024 * 1024, // Reduced from 50MB to 20MB max total
  enablePrefetch: true,
  prefetchConcurrency: 1,  // Reduced from 2 to 1 - less background load
  prefetchConcurrency: 2, // Max concurrent prefetch requests
};

// Content types that are cacheable
const CACHEABLE_CONTENT_TYPES = [
  'text/html',
  'application/xhtml+xml',
];

// URLs to never cache (login, checkout, etc.)
const EXCLUDED_URL_PATTERNS = [
  /\/login/i,
  /\/signin/i,
  /\/signup/i,
  /\/checkout/i,
  /\/cart/i,
  /\/payment/i,
  /\/account/i,
  /\/api\//i,
  /\/auth/i,
  /\?.*token=/i,
  /\?.*session=/i,
];

// ============================================================================
// CACHE IMPLEMENTATION
// ============================================================================

class PredictiveCacheService {
  private cache: Map<string, CachedPage> = new Map();
  private insertionOrder: string[] = []; // For FIFO eviction
  private config: PredictiveCacheConfig = { ...DEFAULT_CONFIG };
  private prefetchQueue: Set<string> = new Set();
  private activePrefetches: number = 0;
  private stats = {
    hitCount: 0,
    missCount: 0,
  };

  constructor() {
    // Periodically clean expired entries
    if (Platform.OS !== 'web') {
      setInterval(() => this.cleanExpired(), 60000); // Every minute
    }
  }

  /**
   * Update cache configuration
   */
  configure(newConfig: Partial<PredictiveCacheConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('[PredictiveCache] Configuration updated:', this.config);
  }

  /**
   * Normalize URL for consistent cache keys
   */
  private normalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      // Remove tracking parameters
      const paramsToRemove = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid', 'ref'];
      paramsToRemove.forEach(param => urlObj.searchParams.delete(param));
      // Remove trailing slash for consistency
      let normalized = urlObj.toString();
      if (normalized.endsWith('/') && urlObj.pathname !== '/') {
        normalized = normalized.slice(0, -1);
      }
      return normalized;
    } catch {
      return url;
    }
  }

  /**
   * Check if URL should be cached
   */
  private shouldCacheUrl(url: string): boolean {
    // Check excluded patterns
    for (const pattern of EXCLUDED_URL_PATTERNS) {
      if (pattern.test(url)) {
        return false;
      }
    }
    
    // Only cache http/https
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return false;
    }
    
    return true;
  }

  /**
   * Check if content type is cacheable
   */
  private isCacheableContentType(contentType: string): boolean {
    const lowerType = contentType.toLowerCase();
    return CACHEABLE_CONTENT_TYPES.some(type => lowerType.includes(type));
  }

  /**
   * Calculate total cache size
   */
  private getTotalSize(): number {
    let total = 0;
    this.cache.forEach(page => {
      total += page.size;
    });
    return total;
  }

  /**
   * Evict oldest entries using FIFO policy
   */
  private evictOldest(requiredSpace: number = 0): void {
    // Evict until under page limit or size limit
    while (
      (this.cache.size >= this.config.maxPages || 
       this.getTotalSize() + requiredSpace > this.config.maxSizeBytes) &&
      this.insertionOrder.length > 0
    ) {
      const oldestUrl = this.insertionOrder.shift();
      if (oldestUrl) {
        const evicted = this.cache.get(oldestUrl);
        this.cache.delete(oldestUrl);
        console.log(`[PredictiveCache] Evicted (FIFO): ${oldestUrl} (${evicted?.size || 0} bytes)`);
      }
    }
  }

  /**
   * Clean expired cache entries
   */
  private cleanExpired(): void {
    const now = Date.now();
    const expiredUrls: string[] = [];
    
    this.cache.forEach((page, url) => {
      if (now - page.timestamp > this.config.ttlMs) {
        expiredUrls.push(url);
      }
    });
    
    expiredUrls.forEach(url => {
      this.cache.delete(url);
      this.insertionOrder = this.insertionOrder.filter(u => u !== url);
    });
    
    if (expiredUrls.length > 0) {
      console.log(`[PredictiveCache] Cleaned ${expiredUrls.length} expired entries`);
    }
  }

  /**
   * Store a page in the cache
   */
  set(url: string, html: string, contentType: string = 'text/html'): boolean {
    const normalizedUrl = this.normalizeUrl(url);
    
    if (!this.shouldCacheUrl(normalizedUrl)) {
      console.log(`[PredictiveCache] Skipping excluded URL: ${normalizedUrl}`);
      return false;
    }
    
    if (!this.isCacheableContentType(contentType)) {
      console.log(`[PredictiveCache] Skipping non-HTML content: ${contentType}`);
      return false;
    }
    
    const size = new Blob([html]).size;
    
    // Check if single page is too large (max 5MB per page)
    if (size > 5 * 1024 * 1024) {
      console.log(`[PredictiveCache] Page too large to cache: ${size} bytes`);
      return false;
    }
    
    // Evict old entries if needed
    this.evictOldest(size);
    
    // Remove from insertion order if already exists (will be re-added at end)
    this.insertionOrder = this.insertionOrder.filter(u => u !== normalizedUrl);
    
    // Get base URL for relative links
    let baseUrl = normalizedUrl;
    try {
      const urlObj = new URL(normalizedUrl);
      baseUrl = `${urlObj.protocol}//${urlObj.host}`;
    } catch {}
    
    // Store in cache
    const cachedPage: CachedPage = {
      url: normalizedUrl,
      html,
      baseUrl,
      timestamp: Date.now(),
      contentType,
      size,
    };
    
    this.cache.set(normalizedUrl, cachedPage);
    this.insertionOrder.push(normalizedUrl);
    
    console.log(`[PredictiveCache] Cached: ${normalizedUrl} (${Math.round(size / 1024)}KB)`);
    return true;
  }

  /**
   * Get a cached page if available
   */
  get(url: string): CachedPage | null {
    const normalizedUrl = this.normalizeUrl(url);
    const cached = this.cache.get(normalizedUrl);
    
    if (!cached) {
      this.stats.missCount++;
      return null;
    }
    
    // Check if expired
    if (Date.now() - cached.timestamp > this.config.ttlMs) {
      this.cache.delete(normalizedUrl);
      this.insertionOrder = this.insertionOrder.filter(u => u !== normalizedUrl);
      this.stats.missCount++;
      console.log(`[PredictiveCache] Expired: ${normalizedUrl}`);
      return null;
    }
    
    this.stats.hitCount++;
    console.log(`[PredictiveCache] HIT: ${normalizedUrl}`);
    return cached;
  }

  /**
   * Check if a URL is cached (without retrieving)
   */
  has(url: string): boolean {
    const normalizedUrl = this.normalizeUrl(url);
    const cached = this.cache.get(normalizedUrl);
    
    if (!cached) return false;
    
    // Check expiration
    if (Date.now() - cached.timestamp > this.config.ttlMs) {
      return false;
    }
    
    return true;
  }

  /**
   * Prefetch a URL in the background
   */
  async prefetch(url: string): Promise<boolean> {
    if (!this.config.enablePrefetch) return false;
    
    const normalizedUrl = this.normalizeUrl(url);
    
    // Skip if already cached or queued
    if (this.has(normalizedUrl) || this.prefetchQueue.has(normalizedUrl)) {
      return false;
    }
    
    // Skip excluded URLs
    if (!this.shouldCacheUrl(normalizedUrl)) {
      return false;
    }
    
    // Add to queue
    this.prefetchQueue.add(normalizedUrl);
    
    // Process queue if under concurrency limit
    this.processPrefetchQueue();
    
    return true;
  }

  /**
   * Prefetch multiple URLs
   */
  async prefetchMultiple(urls: string[]): Promise<void> {
    // Filter and dedupe
    const uniqueUrls = [...new Set(urls)]
      .map(url => this.normalizeUrl(url))
      .filter(url => !this.has(url) && this.shouldCacheUrl(url))
      .slice(0, 5); // Max 5 prefetches per batch
    
    console.log(`[PredictiveCache] Queueing prefetch for ${uniqueUrls.length} URLs`);
    
    for (const url of uniqueUrls) {
      this.prefetch(url);
    }
  }

  /**
   * Process the prefetch queue
   */
  private async processPrefetchQueue(): Promise<void> {
    while (
      this.prefetchQueue.size > 0 &&
      this.activePrefetches < this.config.prefetchConcurrency
    ) {
      const url = this.prefetchQueue.values().next().value;
      if (!url) break;
      
      this.prefetchQueue.delete(url);
      this.activePrefetches++;
      
      try {
        await this.fetchAndCache(url);
      } catch (error) {
        console.warn(`[PredictiveCache] Prefetch failed: ${url}`, error);
      } finally {
        this.activePrefetches--;
        // Continue processing queue
        this.processPrefetchQueue();
      }
    }
  }

  /**
   * Fetch a URL and cache its content
   */
  private async fetchAndCache(url: string): Promise<boolean> {
    try {
      console.log(`[PredictiveCache] Prefetching: ${url}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'text/html,application/xhtml+xml',
          'User-Agent': 'ACCESS-Browser/1.0 (Predictive Cache)',
        },
        signal: controller.signal,
        // Don't follow too many redirects
        redirect: 'follow',
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.warn(`[PredictiveCache] HTTP ${response.status} for ${url}`);
        return false;
      }
      
      const contentType = response.headers.get('content-type') || 'text/html';
      
      if (!this.isCacheableContentType(contentType)) {
        console.log(`[PredictiveCache] Non-HTML response: ${contentType}`);
        return false;
      }
      
      const html = await response.text();
      
      // Verify it looks like HTML
      if (!html.includes('<') || !html.includes('>')) {
        console.log(`[PredictiveCache] Response doesn't look like HTML`);
        return false;
      }
      
      return this.set(url, html, contentType);
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.warn(`[PredictiveCache] Prefetch timeout: ${url}`);
      } else {
        console.warn(`[PredictiveCache] Fetch error: ${url}`, error.message);
      }
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalPages = this.cache.size;
    const totalSizeBytes = this.getTotalSize();
    const hitCount = this.stats.hitCount;
    const missCount = this.stats.missCount;
    const totalRequests = hitCount + missCount;
    
    let oldestEntry: number | null = null;
    let newestEntry: number | null = null;
    
    this.cache.forEach(page => {
      if (oldestEntry === null || page.timestamp < oldestEntry) {
        oldestEntry = page.timestamp;
      }
      if (newestEntry === null || page.timestamp > newestEntry) {
        newestEntry = page.timestamp;
      }
    });
    
    return {
      totalPages,
      totalSizeBytes,
      hitCount,
      missCount,
      hitRate: totalRequests > 0 ? hitCount / totalRequests : 0,
      oldestEntry,
      newestEntry,
    };
  }

  /**
   * Get list of cached URLs
   */
  getCachedUrls(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
    this.insertionOrder = [];
    this.prefetchQueue.clear();
    this.stats.hitCount = 0;
    this.stats.missCount = 0;
    console.log('[PredictiveCache] Cache cleared');
  }

  /**
   * Remove a specific URL from cache
   */
  remove(url: string): boolean {
    const normalizedUrl = this.normalizeUrl(url);
    const existed = this.cache.delete(normalizedUrl);
    this.insertionOrder = this.insertionOrder.filter(u => u !== normalizedUrl);
    return existed;
  }
}

// ============================================================================
// JAVASCRIPT INJECTION FOR LINK EXTRACTION
// ============================================================================

/**
 * JavaScript to inject into WebView to extract prominent links
 * Identifies the most likely links user will click based on:
 * - Position (above the fold, center of screen)
 * - Size (larger touch targets)
 * - Type (navigation links, article links)
 */
export const linkExtractionScript = `
(function() {
  'use strict';
  
  // Already injected check
  if (window.__ACCESS_LINK_EXTRACTOR__) return;
  window.__ACCESS_LINK_EXTRACTOR__ = true;
  
  function extractProminentLinks() {
    const links = document.querySelectorAll('a[href]');
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const centerX = viewportWidth / 2;
    const centerY = viewportHeight / 2;
    
    const scoredLinks = [];
    
    links.forEach(link => {
      const href = link.href;
      
      // Skip non-http links
      if (!href || !href.startsWith('http')) return;
      
      // Skip same-page anchors
      if (href.includes('#') && href.split('#')[0] === window.location.href.split('#')[0]) return;
      
      // Skip javascript: links
      if (href.startsWith('javascript:')) return;
      
      // Skip login/auth links
      if (/login|signin|signup|auth|logout/i.test(href)) return;
      
      const rect = link.getBoundingClientRect();
      
      // Skip invisible links
      if (rect.width === 0 || rect.height === 0) return;
      
      // Skip links below the fold (unless very large)
      if (rect.top > viewportHeight * 1.5 && rect.height < 100) return;
      
      // Calculate score based on prominence
      let score = 0;
      
      // Position score (higher for above-the-fold, center of screen)
      const distanceFromCenter = Math.sqrt(
        Math.pow((rect.left + rect.width/2) - centerX, 2) +
        Math.pow((rect.top + rect.height/2) - centerY, 2)
      );
      score += Math.max(0, 500 - distanceFromCenter) / 100;
      
      // Size score (larger links are more prominent)
      score += Math.min(rect.width * rect.height / 1000, 50);
      
      // Above-the-fold bonus
      if (rect.top < viewportHeight) {
        score += 20;
      }
      
      // Navigation/menu link detection
      const isNav = link.closest('nav, header, [role="navigation"]');
      if (isNav) score += 10;
      
      // Article/content link detection
      const isContent = link.closest('article, main, [role="main"], .content, .post');
      if (isContent) score += 15;
      
      // Text content bonus (links with meaningful text)
      const text = link.textContent?.trim() || '';
      if (text.length > 3 && text.length < 100) {
        score += 5;
      }
      
      scoredLinks.push({
        url: href,
        score: score,
        text: text.substring(0, 50),
      });
    });
    
    // Sort by score and take top 5
    scoredLinks.sort((a, b) => b.score - a.score);
    const topLinks = scoredLinks.slice(0, 5).map(l => l.url);
    
    // Remove duplicates
    const uniqueLinks = [...new Set(topLinks)];
    
    return uniqueLinks;
  }
  
  // Extract and send links after page load
  function sendLinks() {
    try {
      const links = extractProminentLinks();
      if (links.length > 0 && window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'PREDICTIVE_LINKS',
          links: links,
          url: window.location.href,
        }));
      }
    } catch (e) {
      console.error('[LinkExtractor] Error:', e);
    }
  }
  
  // Run after DOM is stable
  if (document.readyState === 'complete') {
    setTimeout(sendLinks, 500);
  } else {
    window.addEventListener('load', () => setTimeout(sendLinks, 500));
  }
  
  // Also run on significant DOM changes (for SPAs)
  let debounceTimer;
  const observer = new MutationObserver(() => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(sendLinks, 1000);
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
  
  // Re-extract on scroll (user might reveal new content)
  let scrollTimer;
  window.addEventListener('scroll', () => {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(sendLinks, 500);
  }, { passive: true });
  
  console.log('[ACCESS] Link extractor initialized');
})();
true;
`;

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const predictiveCacheService = new PredictiveCacheService();

export default predictiveCacheService;
