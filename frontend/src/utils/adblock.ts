// Ad blocking utility with EasyList-compatible blocklist

// Common ad domains and patterns
const BLOCKED_DOMAINS = [
  'doubleclick.net',
  'googlesyndication.com',
  'googleadservices.com',
  'google-analytics.com',
  'facebook.com/tr',
  'ads.twitter.com',
  'ads.yahoo.com',
  'advertising.com',
  'adnxs.com',
  'adsrvr.org',
  'adform.net',
  'criteo.com',
  'outbrain.com',
  'taboola.com',
  'moatads.com',
  'amazon-adsystem.com',
  'pubmatic.com',
  'rubiconproject.com',
  'openx.net',
  'casalemedia.com',
  'scorecardresearch.com',
  'quantserve.com',
  'bluekai.com',
  'exelator.com',
  'krxd.net',
  'demdex.net',
  'bidswitch.net',
  'mathtag.com',
  'rlcdn.com',
  'chartbeat.com',
  'newrelic.com',
  'hotjar.com',
  'mixpanel.com',
  'segment.io',
  'amplitude.com',
  'branch.io',
  'appsflyer.com',
  'adjust.com',
  'kochava.com',
];

// URL patterns to block
const BLOCKED_PATTERNS = [
  /\/ads\//i,
  /\/ad\//i,
  /\/banner\//i,
  /\/popup\//i,
  /\/tracking\//i,
  /\/analytics\//i,
  /\?ad_/i,
  /&ad_/i,
  /\/pixel\//i,
  /\.gif\?.*track/i,
  /\/beacon\//i,
  /\/telemetry\//i,
];

export const shouldBlockRequest = (url: string): boolean => {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    
    // Check blocked domains
    for (const domain of BLOCKED_DOMAINS) {
      if (hostname.includes(domain)) {
        return true;
      }
    }
    
    // Check blocked patterns
    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(url)) {
        return true;
      }
    }
    
    return false;
  } catch {
    return false;
  }
};

// Placeholder for Vision-AI scanner integration
// This function will analyze DOM elements visually to detect sponsored content
export const visionAIScannerPlaceholder = async (pageContent: string): Promise<string[]> => {
  // TODO: Integrate with Vision AI model to:
  // 1. Analyze page screenshots
  // 2. Identify visually similar ad patterns
  // 3. Return CSS selectors of elements to hide
  
  // For now, return common ad element selectors
  return [
    '[class*="ad-"]',
    '[class*="-ad"]',
    '[id*="ad-"]',
    '[class*="sponsored"]',
    '[class*="advertisement"]',
    '[data-ad]',
    '.adsbygoogle',
    '#google_ads',
    '.fb-ad',
  ];
};

// CSS injection to hide ad elements
export const getAdBlockCSS = (selectors: string[]): string => {
  return selectors.map(s => `${s} { display: none !important; }`).join('\n');
};
