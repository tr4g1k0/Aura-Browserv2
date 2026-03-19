/**
 * Smart Shield Ad Blocking Utility
 * Two-layer protection system for blocking ads and trackers
 * 
 * Layer 1: Network Interception - blocks requests at the network level
 * Layer 2: DOM Injection - hides ad elements that slip through via CSS injection
 * 
 * Architecture Note: The DOM injection pipeline (adBusterScript) is designed to be
 * extended later with ONNX Vision VLM integration. The Vision model will dynamically
 * identify coordinates of sponsored content on the page and generate custom CSS
 * selectors to hide those elements in real-time.
 */

// ============================================================================
// LAYER 1: NETWORK INTERCEPTION
// ============================================================================

/**
 * Comprehensive list of known ad/tracker domains
 * These are blocked at the network request level before any content loads
 */
const BLOCKED_AD_DOMAINS = [
  // Google Advertising
  'doubleclick.net',
  'googlesyndication.com',
  'googleadservices.com',
  'pagead2.googlesyndication.com',
  'adservice.google.com',
  'adsense.com',
  
  // Google Analytics & Tracking
  'google-analytics.com',
  'googletagmanager.com',
  'googletagservices.com',
  
  // Facebook/Meta Tracking
  'facebook.com/tr',
  'connect.facebook.net',
  'pixel.facebook.com',
  'an.facebook.com',
  
  // Twitter/X Ads
  'ads.twitter.com',
  'analytics.twitter.com',
  't.co/i/adsct',
  
  // Microsoft/Bing
  'ads.yahoo.com',
  'bat.bing.com',
  'ads.microsoft.com',
  
  // Major Ad Networks
  'advertising.com',
  'adnxs.com',           // AppNexus
  'adsrvr.org',          // The Trade Desk
  'adform.net',
  'criteo.com',
  'criteo.net',
  'outbrain.com',
  'taboola.com',
  'mgid.com',
  'revcontent.com',
  'content.ad',
  
  // Ad Verification & Measurement
  'moatads.com',
  'doubleverify.com',
  'adsafeprotected.com',
  'integralads.com',
  
  // Programmatic Ad Exchanges
  'amazon-adsystem.com',
  'pubmatic.com',
  'rubiconproject.com',
  'openx.net',
  'casalemedia.com',
  'bidswitch.net',
  'mathtag.com',
  'indexww.com',
  'spotxchange.com',
  'smartadserver.com',
  
  // Analytics & User Tracking
  'scorecardresearch.com',
  'quantserve.com',
  'bluekai.com',
  'exelator.com',
  'krxd.net',
  'demdex.net',
  'rlcdn.com',
  'chartbeat.com',
  'newrelic.com',
  'hotjar.com',
  'mixpanel.com',
  'segment.io',
  'segment.com',
  'amplitude.com',
  'heapanalytics.com',
  'fullstory.com',
  'clarity.ms',
  
  // Mobile Attribution
  'branch.io',
  'appsflyer.com',
  'adjust.com',
  'kochava.com',
  'singular.net',
  
  // Video Ads
  'spotx.tv',
  'springserve.com',
  'teads.tv',
  
  // Social Widgets (often tracking)
  'addthis.com',
  'sharethis.com',
  'po.st',
  
  // Fingerprinting & Device ID
  'fingerprintjs.com',
  'deviceatlas.com',
];

/**
 * URL patterns that indicate ad/tracking content
 * These regex patterns catch ad requests even from domains not in the blocklist
 */
const BLOCKED_URL_PATTERNS = [
  // Common ad paths
  /\/ads\//i,
  /\/ad\//i,
  /\/advert\//i,
  /\/banner\//i,
  /\/banners\//i,
  /\/popup\//i,
  /\/popunder\//i,
  /\/sponsored\//i,
  
  // Tracking paths
  /\/tracking\//i,
  /\/tracker\//i,
  /\/analytics\//i,
  /\/telemetry\//i,
  /\/beacon\//i,
  /\/pixel\//i,
  /\/collect\//i,
  /\/event\//i,
  /\/impression\//i,
  
  // Query parameters indicating ads
  /[?&]ad_/i,
  /[?&]ad=/i,
  /[?&]ads=/i,
  /[?&]adid=/i,
  /[?&]campaign=/i,
  /[?&]utm_/i,
  /[?&]fbclid=/i,
  /[?&]gclid=/i,
  /[?&]msclkid=/i,
  
  // Tracking pixels
  /\.gif\?.*track/i,
  /\.gif\?.*pixel/i,
  /\.png\?.*track/i,
  /1x1\.gif/i,
  /pixel\.gif/i,
  
  // Common ad script patterns
  /pagead\/js/i,
  /adsbygoogle/i,
  /show_ads/i,
  /adserver/i,
  /adview/i,
];

/**
 * Check if a URL should be blocked as an ad or tracker
 * This is the main function for Layer 1 (Network Interception)
 * 
 * @param url - The URL to check
 * @returns true if the URL should be blocked, false otherwise
 */
export const isAdOrTracker = (url: string): boolean => {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    const fullUrl = url.toLowerCase();
    
    // Check against blocked domains
    for (const domain of BLOCKED_AD_DOMAINS) {
      if (hostname.includes(domain) || hostname.endsWith(domain)) {
        return true;
      }
    }
    
    // Check against blocked URL patterns
    for (const pattern of BLOCKED_URL_PATTERNS) {
      if (pattern.test(fullUrl)) {
        return true;
      }
    }
    
    return false;
  } catch {
    // If URL parsing fails, don't block (safe default)
    return false;
  }
};

// Alias for backwards compatibility
export const shouldBlockRequest = isAdOrTracker;

// ============================================================================
// LAYER 2: DOM INJECTION
// ============================================================================

/**
 * CSS selectors targeting common ad containers and elements
 * These are applied via style injection to hide ads that bypass network blocking
 */
const AD_CSS_SELECTORS = [
  // Generic ad classes
  '.ad',
  '.ads',
  '.ad-container',
  '.ad-wrapper',
  '.ad-banner',
  '.ad-unit',
  '.ad-slot',
  '.ad-block',
  '.ad-box',
  '.ad-frame',
  '.ad-leaderboard',
  '.ad-sidebar',
  '.ad-content',
  '.ad-placement',
  
  // ID-based selectors
  '#ad',
  '#ads',
  '#ad-container',
  '#ad-wrapper',
  '#ad-banner',
  '#sponsor-banner',
  '#sponsored-content',
  '#advertisement',
  
  // Class variations with prefix/suffix
  '[class*="ad-container"]',
  '[class*="ad-wrapper"]',
  '[class*="ad-banner"]',
  '[class*="advertisement"]',
  '[class*="sponsored"]',
  '[class*="-ad-"]',
  '[class*="_ad_"]',
  '[class$="-ad"]',
  '[class$="_ad"]',
  
  // ID variations
  '[id*="ad-container"]',
  '[id*="ad-wrapper"]',
  '[id*="advertisement"]',
  '[id*="sponsored"]',
  
  // Data attributes
  '[data-ad]',
  '[data-ad-slot]',
  '[data-ad-unit]',
  '[data-adid]',
  '[data-ad-client]',
  '[data-google-query-id]',
  
  // Google Ads specific
  '.adsbygoogle',
  '.google-ad',
  '.google-ads',
  '#google_ads_iframe',
  'ins.adsbygoogle',
  '[id^="google_ads_"]',
  '[id^="div-gpt-ad"]',
  
  // Facebook Ads
  '.fb-ad',
  '.fb_ad',
  '[data-testid="fbfeed_story_sponsored"]',
  
  // Content recommendation widgets
  '.taboola-widget',
  '.taboola',
  '#taboola-below-article',
  '.outbrain',
  '.OUTBRAIN',
  '#outbrain_widget',
  '.mgid',
  '.revcontent',
  
  // Sponsored content markers
  '.sponsored',
  '.sponsored-post',
  '.sponsored-content',
  '.promoted',
  '.promoted-content',
  '.native-ad',
  '.partner-content',
  '.paid-content',
  
  // Popup and overlay ads
  '.popup-ad',
  '.overlay-ad',
  '.interstitial-ad',
  '.modal-ad',
  '.lightbox-ad',
  
  // Video ads
  '.video-ad',
  '.preroll-ad',
  '.midroll-ad',
  '.postroll-ad',
  
  // Common ad network containers
  '[class*="taboola"]',
  '[class*="outbrain"]',
  '[class*="mgid"]',
  '[class*="revcontent"]',
  '[id*="taboola"]',
  '[id*="outbrain"]',
];

/**
 * Generate the ad-busting JavaScript payload for DOM injection
 * This script injects a <style> tag to hide ad elements
 * 
 * ARCHITECTURE NOTE:
 * This is the exact injection pipeline we will use later when our ONNX Vision VLM
 * dynamically identifies coordinates of sponsored content. The Vision model will:
 * 1. Capture a screenshot of the current viewport
 * 2. Run inference to detect ad-like visual patterns
 * 3. Map detected regions back to DOM elements
 * 4. Generate dynamic CSS selectors for those elements
 * 5. Inject them using this same pipeline
 * 
 * The function accepts optional additional selectors for Vision AI integration.
 * 
 * @param additionalSelectors - Optional array of selectors from Vision AI
 * @returns Minified JavaScript string for injection
 */
export const createAdBusterScript = (additionalSelectors: string[] = []): string => {
  // Combine base selectors with any Vision AI-detected selectors
  const allSelectors = [...AD_CSS_SELECTORS, ...additionalSelectors];
  
  // Create the CSS rules
  const cssRules = allSelectors
    .map(selector => `${selector}{display:none!important;visibility:hidden!important;height:0!important;width:0!important;overflow:hidden!important;}`)
    .join('');
  
  // Minified JavaScript payload
  // This self-executing function:
  // 1. Creates a <style> element
  // 2. Adds our ad-hiding CSS rules
  // 3. Appends to <head> with high priority
  // 4. Sets up a MutationObserver to handle dynamically loaded ads
  const script = `
(function(){
  'use strict';
  
  /* Smart Shield Ad Buster v2.0 */
  /* Layer 2: DOM-based ad element hiding + counting */
  
  var css='${cssRules}';
  var _shieldAds = 0;
  var _shieldTrackers = 0;
  
  function reportCounts(){
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'AD_BLOCK_COUNT',
        adsBlocked: _shieldAds,
        trackersBlocked: _shieldTrackers
      }));
    } catch(e) {}
  }
  
  function injectStyles(){
    var existing=document.getElementById('smart-shield-styles');
    if(existing)return;
    var style=document.createElement('style');
    style.id='smart-shield-styles';
    style.type='text/css';
    style.textContent=css;
    (document.head||document.documentElement).appendChild(style);
  }
  
  function removeAdFrames(){
    var iframes=document.querySelectorAll('iframe[src*="ad"],iframe[src*="doubleclick"],iframe[src*="googlesyndication"],iframe[id*="google_ads"],iframe[src*="facebook.com/tr"],iframe[src*="taboola"],iframe[src*="outbrain"]');
    var count = 0;
    iframes.forEach(function(f){ f.remove(); count++; });
    if (count > 0) { _shieldAds += count; reportCounts(); }
  }
  
  function hideAdElements(){
    var selectors='${allSelectors.slice(0, 30).join(',')}';
    try{
      var ads=document.querySelectorAll(selectors);
      var hidden = 0;
      ads.forEach(function(el){
        if (el.offsetParent !== null || el.style.display !== 'none') {
          el.style.setProperty('display','none','important');
          hidden++;
        }
      });
      if (hidden > 0) { _shieldAds += hidden; reportCounts(); }
    }catch(e){}
  }
  
  function countTrackerScripts(){
    var trackerDomains = ['google-analytics.com','googletagmanager.com','facebook.net','hotjar.com','clarity.ms','segment.com','mixpanel.com','amplitude.com','heapanalytics.com','fullstory.com','newrelic.com','chartbeat.com','scorecardresearch.com','quantserve.com','doubleclick.net','googlesyndication.com','adservice.google.com'];
    var scripts = document.querySelectorAll('script[src]');
    var counted = 0;
    scripts.forEach(function(s){
      var src = (s.getAttribute('src') || '').toLowerCase();
      for (var i = 0; i < trackerDomains.length; i++) {
        if (src.indexOf(trackerDomains[i]) !== -1) {
          counted++;
          break;
        }
      }
    });
    if (counted > 0) { _shieldTrackers += counted; reportCounts(); }
  }
  
  injectStyles();
  
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',function(){
      removeAdFrames();
      hideAdElements();
      countTrackerScripts();
    });
  }else{
    removeAdFrames();
    hideAdElements();
    countTrackerScripts();
  }
  
  var observer=new MutationObserver(function(mutations){
    var shouldCheck=mutations.some(function(m){
      return m.addedNodes.length>0;
    });
    if(shouldCheck){
      removeAdFrames();
      hideAdElements();
    }
  });
  
  observer.observe(document.documentElement,{
    childList:true,
    subtree:true
  });
  
  console.log('[Smart Shield] Ad blocking active - counting enabled');
})();
true;`;
  
  return script;
};

/**
 * Pre-built ad buster script with default selectors
 * Use this for immediate injection via WebView's injectedJavaScript prop
 */
export const adBusterScript = createAdBusterScript();

// ============================================================================
// LAYER 3: SCRIPT ROUTER - URL-BASED INJECTION
// ============================================================================

/**
 * Script Router - Checks URL before injecting any scripts
 * 
 * CRITICAL: This prevents heavy YouTube fixes from leaking to standard websites
 * 
 * - YouTube: Full video optimizations (display:none for inactive, translateZ, etc)
 * - Other sites: Minimal CSS only (smooth scrolling, no GPU hacks)
 */
export const scriptRouterScript = `
(function(){
  'use strict';
  
  var currentHost = window.location.hostname;
  
  if (currentHost.includes('youtube.com')) {
    /* ================================================ */
    /* YOUTUBE-SPECIFIC OPTIMIZATIONS                   */
    /* Only injected when on YouTube domains            */
    /* ================================================ */
    
    var ytStyle = document.createElement('style');
    ytStyle.id = 'youtube-optimization';
    ytStyle.innerHTML = [
      /* Smooth touch scrolling */
      'html, body {',
      '  -webkit-overflow-scrolling: touch !important;',
      '  overscroll-behavior-y: none !important;',
      '}',
      
      /* GPU acceleration for video elements only */
      'video, .html5-video-player {',
      '  transform: translateZ(0);',
      '  backface-visibility: hidden;',
      '}',
      
      /* YouTube Shorts specific */
      'ytd-shorts, #shorts-player {',
      '  -webkit-overflow-scrolling: touch;',
      '}'
    ].join('\\n');
    
    if (document.head) {
      document.head.appendChild(ytStyle);
    }
    
    console.log('[Script Router] YouTube optimizations applied');
    
  } else {
    /* ================================================ */
    /* STANDARD WEB FIXES - All other sites             */
    /* Minimal CSS only - no GPU hacks, no intervals    */
    /* ================================================ */
    
    var style = document.createElement('style');
    style.id = 'standard-web-fix';
    style.innerHTML = [
      'html, body {',
      '  -webkit-overflow-scrolling: touch !important;',
      '  overscroll-behavior-y: none !important;',
      '}',
      
      /* Disable tap highlight on interactive elements */
      'a, button, input, [role="button"] {',
      '  -webkit-tap-highlight-color: transparent;',
      '}'
    ].join('\\n');
    
    if (document.head) {
      document.head.appendChild(style);
    }
    
    console.log('[Script Router] Standard web fixes applied');
  }
})();
true;`;

/**
 * Legacy exports for backwards compatibility
 * These now just return the script router
 */
export const gpuLayerSquashingScript = scriptRouterScript;
export const performanceOptimizationScript = scriptRouterScript;

/**
 * Creates a combined optimization script
 * Now uses the Script Router for URL-based injection
 */
export const createFullOptimizationScript = (additionalSelectors: string[] = []): string => {
  return scriptRouterScript;
};

// ============================================================================
// VISION AI INTEGRATION (PLACEHOLDER)
// ============================================================================

/**
 * Placeholder for Vision AI scanner integration
 * This function will analyze DOM elements visually to detect sponsored content
 * 
 * Future implementation will:
 * 1. Capture viewport screenshot via WebView
 * 2. Send to ONNX Vision model for ad pattern detection
 * 3. Return bounding boxes of detected ad regions
 * 4. Map regions to DOM elements using elementFromPoint
 * 5. Generate CSS selectors for those elements
 * 
 * @param pageContent - HTML content or screenshot data
 * @returns Array of CSS selectors targeting detected ad elements
 */
export const visionAIScannerPlaceholder = async (pageContent: string): Promise<string[]> => {
  // TODO: Integrate with ONNX Vision model when available
  // The pipeline will be:
  // 1. await captureScreenshot()
  // 2. const regions = await onnxModel.detectAds(screenshot)
  // 3. const elements = await mapRegionsToElements(regions)
  // 4. return generateSelectorsFromElements(elements)
  
  // For now, return an empty array (base selectors are sufficient)
  return [];
};

/**
 * Generate CSS from an array of selectors
 * Utility function for creating injectable CSS
 * 
 * @param selectors - Array of CSS selectors
 * @returns CSS string with display:none rules
 */
export const getAdBlockCSS = (selectors: string[]): string => {
  if (selectors.length === 0) {
    return AD_CSS_SELECTORS
      .map(s => `${s} { display: none !important; }`)
      .join('\n');
  }
  return selectors
    .map(s => `${s} { display: none !important; }`)
    .join('\n');
};

// ============================================================================
// STATISTICS & REPORTING
// ============================================================================

/**
 * Track blocked request statistics
 * Used for UI display of "X ads blocked this session"
 */
export interface BlockStats {
  totalBlocked: number;
  domainsBlocked: Map<string, number>;
  sessionStart: number;
}

let blockStats: BlockStats = {
  totalBlocked: 0,
  domainsBlocked: new Map(),
  sessionStart: Date.now(),
};

/**
 * Record a blocked request for statistics
 * @param url - The blocked URL
 */
export const recordBlockedRequest = (url: string): void => {
  blockStats.totalBlocked++;
  try {
    const domain = new URL(url).hostname;
    const current = blockStats.domainsBlocked.get(domain) || 0;
    blockStats.domainsBlocked.set(domain, current + 1);
  } catch {
    // Ignore invalid URLs
  }
};

/**
 * Get current blocking statistics
 */
export const getBlockStats = (): BlockStats => ({ ...blockStats });

/**
 * Reset blocking statistics (e.g., on new session)
 */
export const resetBlockStats = (): void => {
  blockStats = {
    totalBlocked: 0,
    domainsBlocked: new Map(),
    sessionStart: Date.now(),
  };
};
