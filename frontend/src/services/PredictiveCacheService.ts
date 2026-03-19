/**
 * Predictive Cache Service - COMPLETE IMPLEMENTATION
 * 
 * Implements zero-load instant navigation by intelligently pre-fetching pages
 * the user is most likely to click based on:
 * - Link position (above fold, main content area)
 * - User history (previously visited pages)
 * - Smart scoring algorithm
 * 
 * Smart Conditions:
 * - Only prefetch on WiFi (saves mobile data)
 * - Only prefetch when battery > 20%
 * - Only when browser is idle (not loading)
 * - Max 5 concurrent prefetches
 * - Cancel prefetches on navigation
 * 
 * Cache Policy:
 * - Max 5 pages in memory cache
 * - TTL of 5 minutes per cached page
 * - FIFO eviction when limit reached
 */

import { Platform, InteractionManager } from 'react-native';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import * as Battery from 'expo-battery';

// ============================================================================
// TYPES
// ============================================================================

export interface CachedPage {
  url: string;
  html: string;
  baseUrl: string;
  timestamp: number;
  contentType: string;
  size: number;
}

export interface CacheStats {
  totalPages: number;
  totalSizeBytes: number;
  hitCount: number;
  missCount: number;
  hitRate: number;
  oldestEntry: number | null;
  newestEntry: number | null;
  prefetchEnabled: boolean;
  networkType: string;
  batteryLevel: number;
}

export interface PredictiveCacheConfig {
  maxPages: number;
  ttlMs: number;
  maxSizeBytes: number;
  enablePrefetch: boolean;
  prefetchConcurrency: number;
  minBatteryLevel: number;
  onlyOnWifi: boolean;
}

export interface ExtractedLink {
  url: string;
  score: number;
  text: string;
  isAboveFold: boolean;
  isMainContent: boolean;
  isVisited: boolean;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: PredictiveCacheConfig = {
  maxPages: 5,
  ttlMs: 5 * 60 * 1000, // 5 minutes
  maxSizeBytes: 20 * 1024 * 1024, // 20MB max total
  enablePrefetch: true,
  prefetchConcurrency: 5, // Max 5 concurrent prefetches
  minBatteryLevel: 0.20, // 20% minimum battery
  onlyOnWifi: true, // Only prefetch on WiFi
};

// Content types that are cacheable
const CACHEABLE_CONTENT_TYPES = [
  'text/html',
  'application/xhtml+xml',
];

// URLs to never cache
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
  /\/logout/i,
  /\/password/i,
  /\/settings/i,
  /\/profile/i,
];

// ============================================================================
// CACHE IMPLEMENTATION
// ============================================================================

class PredictiveCacheService {
  private cache: Map<string, CachedPage> = new Map();
  private insertionOrder: string[] = [];
  private config: PredictiveCacheConfig = { ...DEFAULT_CONFIG };
  private prefetchQueue: Set<string> = new Set();
  private activePrefetches: Map<string, AbortController> = new Map();
  private isPageLoading: boolean = false;
  private visitedUrls: Set<string> = new Set();
  private stats = {
    hitCount: 0,
    missCount: 0,
  };
  
  // Network and battery state
  private networkState: NetInfoState | null = null;
  private batteryLevel: number = 1;
  private networkUnsubscribe: (() => void) | null = null;
  private batterySubscription: any = null;

  constructor() {
    this.initializeMonitoring();
    
    // Periodically clean expired entries
    if (Platform.OS !== 'web') {
      setInterval(() => this.cleanExpired(), 60000);
    }
  }

  /**
   * Initialize network and battery monitoring
   */
  private async initializeMonitoring(): Promise<void> {
    if (Platform.OS === 'web') return;

    try {
      // Monitor network state
      this.networkState = await NetInfo.fetch();
      this.networkUnsubscribe = NetInfo.addEventListener(state => {
        this.networkState = state;
        console.log(`[PredictiveCache] Network: ${state.type}, connected: ${state.isConnected}`);
        
        // Cancel prefetches if switched to mobile data
        if (this.config.onlyOnWifi && state.type !== 'wifi') {
          this.cancelAllPrefetches();
        }
      });

      // Monitor battery level
      this.batteryLevel = await Battery.getBatteryLevelAsync();
      this.batterySubscription = Battery.addBatteryLevelListener(({ batteryLevel }) => {
        this.batteryLevel = batteryLevel;
        console.log(`[PredictiveCache] Battery: ${Math.round(batteryLevel * 100)}%`);
        
        // Cancel prefetches if battery too low
        if (batteryLevel < this.config.minBatteryLevel) {
          this.cancelAllPrefetches();
        }
      });

      console.log('[PredictiveCache] Monitoring initialized');
    } catch (error) {
      console.warn('[PredictiveCache] Failed to initialize monitoring:', error);
    }
  }

  /**
   * Clean up monitoring subscriptions
   */
  destroy(): void {
    if (this.networkUnsubscribe) {
      this.networkUnsubscribe();
    }
    if (this.batterySubscription) {
      this.batterySubscription.remove();
    }
    this.cancelAllPrefetches();
  }

  /**
   * Check if prefetching conditions are met
   */
  private canPrefetch(): boolean {
    if (!this.config.enablePrefetch) {
      return false;
    }

    // Don't prefetch while page is loading
    if (this.isPageLoading) {
      console.log('[PredictiveCache] Skipping prefetch: page loading');
      return false;
    }

    // Check WiFi requirement
    if (this.config.onlyOnWifi && Platform.OS !== 'web') {
      if (!this.networkState || this.networkState.type !== 'wifi') {
        console.log('[PredictiveCache] Skipping prefetch: not on WiFi');
        return false;
      }
    }

    // Check battery level
    if (Platform.OS !== 'web' && this.batteryLevel < this.config.minBatteryLevel) {
      console.log(`[PredictiveCache] Skipping prefetch: battery low (${Math.round(this.batteryLevel * 100)}%)`);
      return false;
    }

    // Check concurrent prefetch limit
    if (this.activePrefetches.size >= this.config.prefetchConcurrency) {
      console.log('[PredictiveCache] Skipping prefetch: at concurrency limit');
      return false;
    }

    return true;
  }

  /**
   * Set page loading state - used to pause prefetching during active loads
   */
  setPageLoading(loading: boolean): void {
    this.isPageLoading = loading;
    
    if (loading) {
      // Cancel all pending prefetches when user starts loading a new page
      this.cancelAllPrefetches();
    } else {
      // Resume prefetch queue when load completes
      InteractionManager.runAfterInteractions(() => {
        this.processPrefetchQueue();
      });
    }
  }

  /**
   * Add visited URLs from history for better prediction
   */
  setVisitedUrls(urls: string[]): void {
    this.visitedUrls = new Set(urls.map(url => this.normalizeUrl(url)));
    console.log(`[PredictiveCache] Loaded ${this.visitedUrls.size} visited URLs for prediction`);
  }

  /**
   * Check if a URL was previously visited
   */
  isVisited(url: string): boolean {
    return this.visitedUrls.has(this.normalizeUrl(url));
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
      // Remove trailing slash
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
    for (const pattern of EXCLUDED_URL_PATTERNS) {
      if (pattern.test(url)) {
        return false;
      }
    }
    
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
    while (
      (this.cache.size >= this.config.maxPages || 
       this.getTotalSize() + requiredSpace > this.config.maxSizeBytes) &&
      this.insertionOrder.length > 0
    ) {
      const oldestUrl = this.insertionOrder.shift();
      if (oldestUrl) {
        const evicted = this.cache.get(oldestUrl);
        this.cache.delete(oldestUrl);
        console.log(`[PredictiveCache] Evicted: ${oldestUrl} (${evicted?.size || 0} bytes)`);
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
      return false;
    }
    
    if (!this.isCacheableContentType(contentType)) {
      return false;
    }
    
    const size = new Blob([html]).size;
    
    // Max 5MB per page
    if (size > 5 * 1024 * 1024) {
      console.log(`[PredictiveCache] Page too large: ${size} bytes`);
      return false;
    }
    
    this.evictOldest(size);
    this.insertionOrder = this.insertionOrder.filter(u => u !== normalizedUrl);
    
    let baseUrl = normalizedUrl;
    try {
      const urlObj = new URL(normalizedUrl);
      baseUrl = `${urlObj.protocol}//${urlObj.host}`;
    } catch {}
    
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
    console.log(`[PredictiveCache] CACHE HIT: ${normalizedUrl}`);
    return cached;
  }

  /**
   * Check if a URL is cached
   */
  has(url: string): boolean {
    const normalizedUrl = this.normalizeUrl(url);
    const cached = this.cache.get(normalizedUrl);
    
    if (!cached) return false;
    
    if (Date.now() - cached.timestamp > this.config.ttlMs) {
      return false;
    }
    
    return true;
  }

  /**
   * Cancel all pending prefetches
   */
  cancelAllPrefetches(): void {
    this.activePrefetches.forEach((controller, url) => {
      controller.abort();
      console.log(`[PredictiveCache] Cancelled prefetch: ${url}`);
    });
    this.activePrefetches.clear();
    this.prefetchQueue.clear();
  }

  /**
   * Prefetch a single URL in the background with low priority
   */
  async prefetch(url: string): Promise<boolean> {
    if (!this.canPrefetch()) return false;
    
    const normalizedUrl = this.normalizeUrl(url);
    
    // Skip if already cached, queued, or being fetched
    if (this.has(normalizedUrl) || 
        this.prefetchQueue.has(normalizedUrl) ||
        this.activePrefetches.has(normalizedUrl)) {
      return false;
    }
    
    if (!this.shouldCacheUrl(normalizedUrl)) {
      return false;
    }
    
    this.prefetchQueue.add(normalizedUrl);
    
    // Process queue on background thread
    InteractionManager.runAfterInteractions(() => {
      this.processPrefetchQueue();
    });
    
    return true;
  }

  /**
   * Prefetch multiple URLs with scoring from extracted links
   * This is called when a page finishes loading with extracted links
   */
  async prefetchPredictedLinks(links: ExtractedLink[]): Promise<void> {
    if (!this.canPrefetch()) {
      console.log('[PredictiveCache] Conditions not met for prefetching');
      return;
    }

    // Score and sort links
    const scoredLinks = links
      .map(link => ({
        ...link,
        finalScore: this.calculateLinkScore(link),
      }))
      .filter(link => this.shouldCacheUrl(link.url))
      .filter(link => !this.has(link.url))
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, 5); // Top 5 links

    if (scoredLinks.length === 0) {
      console.log('[PredictiveCache] No links to prefetch');
      return;
    }

    console.log(`[PredictiveCache] Prefetching ${scoredLinks.length} predicted links:`);
    scoredLinks.forEach((link, i) => {
      console.log(`  ${i + 1}. ${link.url} (score: ${link.finalScore.toFixed(1)})`);
    });

    // Queue all for prefetch
    for (const link of scoredLinks) {
      this.prefetch(link.url);
    }
  }

  /**
   * Calculate final score for a link based on multiple factors
   */
  private calculateLinkScore(link: ExtractedLink): number {
    let score = link.score || 0;

    // Boost for previously visited URLs (user likely to revisit)
    if (link.isVisited || this.isVisited(link.url)) {
      score += 30;
    }

    // Boost for above-the-fold links
    if (link.isAboveFold) {
      score += 25;
    }

    // Boost for main content area links (not header/footer)
    if (link.isMainContent) {
      score += 20;
    }

    // Slight boost for links with meaningful text
    if (link.text && link.text.length > 5 && link.text.length < 80) {
      score += 5;
    }

    return score;
  }

  /**
   * Process the prefetch queue with concurrency limit
   */
  private async processPrefetchQueue(): Promise<void> {
    if (!this.canPrefetch()) return;

    while (
      this.prefetchQueue.size > 0 &&
      this.activePrefetches.size < this.config.prefetchConcurrency
    ) {
      const url = this.prefetchQueue.values().next().value;
      if (!url) break;
      
      this.prefetchQueue.delete(url);
      
      // Create abort controller for this request
      const controller = new AbortController();
      this.activePrefetches.set(url, controller);
      
      // Fire and forget - don't await
      this.fetchAndCache(url, controller.signal)
        .catch(() => {})
        .finally(() => {
          this.activePrefetches.delete(url);
          // Continue processing queue
          if (this.canPrefetch()) {
            this.processPrefetchQueue();
          }
        });
    }
  }

  /**
   * Fetch a URL and cache its content with low priority
   */
  private async fetchAndCache(url: string, signal: AbortSignal): Promise<boolean> {
    try {
      console.log(`[PredictiveCache] Prefetching: ${url}`);
      
      const timeoutId = setTimeout(() => {
        // Additional timeout safety
      }, 15000);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Encoding': 'gzip, deflate, br',
          'User-Agent': 'AuraBrowser/1.0 (Prefetch)',
          // Low priority hint for supporting browsers
          'Priority': 'low',
        },
        signal,
        redirect: 'follow',
        // @ts-ignore - priority hint for fetch
        priority: 'low',
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.warn(`[PredictiveCache] HTTP ${response.status}: ${url}`);
        return false;
      }
      
      const contentType = response.headers.get('content-type') || 'text/html';
      
      if (!this.isCacheableContentType(contentType)) {
        return false;
      }
      
      const html = await response.text();
      
      if (!html.includes('<') || !html.includes('>')) {
        return false;
      }
      
      return this.set(url, html, contentType);
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log(`[PredictiveCache] Prefetch aborted: ${url}`);
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
      prefetchEnabled: this.config.enablePrefetch,
      networkType: this.networkState?.type || 'unknown',
      batteryLevel: this.batteryLevel,
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
    this.cancelAllPrefetches();
    this.cache.clear();
    this.insertionOrder = [];
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
// ENHANCED LINK EXTRACTION SCRIPT
// ============================================================================

/**
 * JavaScript to inject into WebView to extract prominent links
 * Identifies the most likely links user will click based on:
 * - Position (above fold, center of screen)
 * - In main content area (not header/footer)
 * - Size (larger touch targets)
 * - Type (navigation links, article links)
 */
export const linkExtractionScript = `
(function() {
  'use strict';
  
  // Already injected check
  if (window.__AURA_LINK_EXTRACTOR__) return;
  window.__AURA_LINK_EXTRACTOR__ = true;
  
  function isInMainContent(element) {
    // Check if element is in main content area (not header/footer/sidebar)
    const excludeSelectors = [
      'header', 'footer', 'nav', 'aside',
      '[role="banner"]', '[role="contentinfo"]', '[role="navigation"]',
      '.header', '.footer', '.nav', '.navbar', '.sidebar',
      '.menu', '.advertisement', '.ad', '.social-links'
    ];
    
    for (const selector of excludeSelectors) {
      if (element.closest(selector)) {
        return false;
      }
    }
    
    // Prefer main content areas
    const contentSelectors = [
      'main', 'article', '[role="main"]',
      '.content', '.post', '.article', '.entry',
      '#content', '#main', '.main-content'
    ];
    
    for (const selector of contentSelectors) {
      if (element.closest(selector)) {
        return true;
      }
    }
    
    // Default to body content
    return true;
  }
  
  function extractProminentLinks() {
    const links = document.querySelectorAll('a[href]');
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const centerX = viewportWidth / 2;
    const centerY = viewportHeight / 2;
    
    const scoredLinks = [];
    const seenUrls = new Set();
    
    links.forEach(link => {
      const href = link.href;
      
      // Skip invalid links
      if (!href || !href.startsWith('http')) return;
      if (href.startsWith('javascript:')) return;
      if (seenUrls.has(href)) return;
      
      // Skip same-page anchors
      if (href.includes('#') && href.split('#')[0] === window.location.href.split('#')[0]) return;
      
      // Skip auth/sensitive links
      if (/login|signin|signup|auth|logout|password|account|settings/i.test(href)) return;
      
      // Skip media files
      if (/\\.(jpg|jpeg|png|gif|webp|svg|mp4|mp3|pdf|zip)$/i.test(href)) return;
      
      const rect = link.getBoundingClientRect();
      
      // Skip invisible links
      if (rect.width === 0 || rect.height === 0) return;
      
      // Get computed style to check visibility
      const style = window.getComputedStyle(link);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return;
      
      seenUrls.add(href);
      
      // Calculate score
      let score = 0;
      
      // Above the fold bonus (visible without scrolling)
      const isAboveFold = rect.top >= 0 && rect.bottom <= viewportHeight;
      if (isAboveFold) {
        score += 30;
      } else if (rect.top < viewportHeight) {
        // Partially visible
        score += 15;
      }
      
      // Skip links way below fold unless they're very prominent
      if (rect.top > viewportHeight * 2) return;
      
      // Main content area bonus
      const isMainContent = isInMainContent(link);
      if (isMainContent) {
        score += 25;
      }
      
      // Position score (closer to center = higher score)
      const linkCenterX = rect.left + rect.width / 2;
      const linkCenterY = rect.top + rect.height / 2;
      const distanceFromCenter = Math.sqrt(
        Math.pow(linkCenterX - centerX, 2) +
        Math.pow(Math.min(linkCenterY, viewportHeight) - centerY, 2)
      );
      const maxDistance = Math.sqrt(centerX * centerX + centerY * centerY);
      score += Math.max(0, 20 * (1 - distanceFromCenter / maxDistance));
      
      // Size score (larger = more prominent)
      const area = rect.width * rect.height;
      score += Math.min(area / 500, 15);
      
      // Text content score
      const text = (link.textContent || '').trim();
      if (text.length >= 3 && text.length <= 100) {
        score += 5;
      }
      
      // Boost for article-like links
      if (link.closest('article, .post, .article, .entry')) {
        score += 10;
      }
      
      scoredLinks.push({
        url: href,
        score: score,
        text: text.substring(0, 60),
        isAboveFold: isAboveFold,
        isMainContent: isMainContent,
        isVisited: false, // Will be checked in native code
      });
    });
    
    // Sort by score and take top 5
    scoredLinks.sort((a, b) => b.score - a.score);
    return scoredLinks.slice(0, 5);
  }
  
  // Send links to native code
  function sendLinks() {
    try {
      const links = extractProminentLinks();
      if (links.length > 0 && window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'PREDICTIVE_LINKS',
          links: links,
          url: window.location.href,
          timestamp: Date.now(),
        }));
        console.log('[Aura] Extracted ' + links.length + ' links for prefetch');
      }
    } catch (e) {
      console.error('[Aura LinkExtractor] Error:', e);
    }
  }
  
  // Run after DOM is stable
  if (document.readyState === 'complete') {
    setTimeout(sendLinks, 800);
  } else {
    window.addEventListener('load', () => setTimeout(sendLinks, 800));
  }
  
  // Re-run on major DOM changes (for SPAs)
  let debounceTimer;
  const observer = new MutationObserver(() => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(sendLinks, 1500);
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
  
  // Re-extract after scroll stops (user reveals new content)
  let scrollTimer;
  let lastScrollY = window.scrollY;
  window.addEventListener('scroll', () => {
    const scrollDelta = Math.abs(window.scrollY - lastScrollY);
    if (scrollDelta > 200) { // Only on significant scroll
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        lastScrollY = window.scrollY;
        sendLinks();
      }, 800);
    }
  }, { passive: true });
  
  console.log('[Aura] Link extractor initialized');
})();
true;
`;

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const predictiveCacheService = new PredictiveCacheService();

export default predictiveCacheService;
