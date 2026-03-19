/**
 * Kids Mode Content Filter
 * 
 * Provides content filtering for Kids Mode:
 * - Adult content blocklist
 * - SafeSearch enforcement
 * - Age-appropriate safe sites allowlist
 */

import { AgeGroup } from '../store/useKidsModeStore';

// ============================================================================
// BLOCKLISTS
// ============================================================================

/**
 * Domains blocked for all age groups (adult content, violence, etc.)
 * This is a representative sample - in production use a comprehensive list
 */
const BLOCKED_DOMAINS = [
  // Adult content
  'pornhub.com', 'xvideos.com', 'xnxx.com', 'redtube.com', 'youporn.com',
  'xhamster.com', 'tube8.com', 'spankbang.com', 'beeg.com', 'porn.com',
  'brazzers.com', 'chaturbate.com', 'onlyfans.com', 'fansly.com',
  
  // Gambling
  'bet365.com', 'draftkings.com', 'fanduel.com', 'pokerstars.com',
  'bovada.com', 'betway.com', 'unibet.com', '888casino.com',
  'casinoroom.com', 'slotocash.com',
  
  // Violence/Gore
  'liveleak.com', 'bestgore.com', 'documentingreality.com',
  'theync.com', 'crazyshit.com',
  
  // Drugs
  'erowid.org', 'leafly.com', 'weedmaps.com',
  
  // Hate/Extremism
  '4chan.org', '8kun.top', 'stormfront.org',
  
  // Dating
  'tinder.com', 'bumble.com', 'match.com', 'okcupid.com',
  'pof.com', 'hinge.com', 'grindr.com',
];

/**
 * Keywords that indicate blocked content in URLs
 */
const BLOCKED_KEYWORDS = [
  'porn', 'xxx', 'adult', 'sex', 'nude', 'naked',
  'casino', 'gambling', 'betting', 'slots',
  'gore', 'violence', 'death',
  'drugs', 'marijuana', 'cocaine', 'heroin',
  'dating', 'hookup',
];

// ============================================================================
// SAFE SITES FOR LITTLE KIDS (4-7)
// ============================================================================

const LITTLE_KIDS_ALLOWLIST = [
  // YouTube Kids only
  'kids.youtube.com',
  'www.youtubekids.com',
  
  // Educational
  'pbskids.org',
  'www.nickjr.com',
  'www.funbrain.com',
  'www.starfall.com',
  'www.abcya.com',
  'www.coolmathgames.com',
  'www.sesamestreet.org',
  'kids.nationalgeographic.com',
  'spaceplace.nasa.gov',
  
  // Games
  'www.disney.com',
  'www.cartoonnetwork.com',
  
  // Learning
  'www.khanacademy.org',
  'www.brainpop.com',
  'kids.britannica.com',
  
  // Search
  'www.kiddle.co',
  'www.kidzsearch.com',
];

// ============================================================================
// SAFE SITES FOR KIDS (8-12)
// ============================================================================

const KIDS_ALLOWLIST = [
  ...LITTLE_KIDS_ALLOWLIST,
  
  // YouTube (full, with SafeSearch)
  'www.youtube.com',
  'youtube.com',
  'm.youtube.com',
  
  // Wikipedia
  'en.wikipedia.org',
  'simple.wikipedia.org',
  'www.wikipedia.org',
  
  // Educational
  'www.ducksters.com',
  'www.kidsnews.com',
  'www.timeforkids.com',
  'newsela.com',
  'www.tweentribune.com',
  
  // Science
  'www.nasa.gov',
  'www.sciencekids.co.nz',
  'www.howstuffworks.com',
  
  // Creative
  'scratch.mit.edu',
  'www.canva.com',
  
  // Games
  'www.roblox.com',
  'www.minecraft.net',
  'www.poki.com',
  
  // Reference
  'www.google.com',
  'www.bing.com',
  'duckduckgo.com',
];

// ============================================================================
// SAFESEARCH ENFORCEMENT
// ============================================================================

/**
 * SafeSearch parameters for different search engines
 */
const SAFESEARCH_PARAMS: Record<string, string> = {
  'google.com': '&safe=strict',
  'www.google.com': '&safe=strict',
  'duckduckgo.com': '&kp=1',
  'www.bing.com': '&adlt=strict',
  'bing.com': '&adlt=strict',
  'search.yahoo.com': '&vm=r',
};

// ============================================================================
// CONTENT FILTER SERVICE
// ============================================================================

class KidsContentFilter {
  private customBlockedSites: Set<string> = new Set();
  private customAllowedSites: Set<string> = new Set();

  /**
   * Update custom site lists
   */
  setCustomSites(blocked: string[], allowed: string[]): void {
    this.customBlockedSites = new Set(blocked.map(s => s.toLowerCase()));
    this.customAllowedSites = new Set(allowed.map(s => s.toLowerCase()));
  }

  /**
   * Extract hostname from URL
   */
  private getHostname(url: string): string {
    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
      return urlObj.hostname.toLowerCase();
    } catch {
      return url.toLowerCase();
    }
  }

  /**
   * Check if a URL is blocked
   */
  isBlocked(url: string, ageGroup: AgeGroup): boolean {
    const hostname = this.getHostname(url);
    const lowerUrl = url.toLowerCase();

    // Check custom blocked sites first
    if (this.customBlockedSites.has(hostname)) {
      return true;
    }

    // Check if in allowlist (custom allowed overrides blocklist)
    if (this.customAllowedSites.has(hostname)) {
      return false;
    }

    // Check blocked domains
    for (const domain of BLOCKED_DOMAINS) {
      if (hostname.includes(domain) || hostname.endsWith('.' + domain)) {
        return true;
      }
    }

    // Check blocked keywords in URL
    for (const keyword of BLOCKED_KEYWORDS) {
      if (lowerUrl.includes(keyword)) {
        return true;
      }
    }

    // For Little Kids mode, check allowlist (whitelist mode)
    if (ageGroup === 'little-kids') {
      const isAllowed = LITTLE_KIDS_ALLOWLIST.some(site => 
        hostname === site.toLowerCase() || hostname.endsWith('.' + site.toLowerCase())
      );
      return !isAllowed; // Block if NOT in allowlist
    }

    return false;
  }

  /**
   * Check if a site is in the safe allowlist
   */
  isInAllowlist(url: string, ageGroup: AgeGroup): boolean {
    const hostname = this.getHostname(url);

    // Check custom allowed sites
    if (this.customAllowedSites.has(hostname)) {
      return true;
    }

    const allowlist = ageGroup === 'little-kids' ? LITTLE_KIDS_ALLOWLIST : KIDS_ALLOWLIST;
    return allowlist.some(site => 
      hostname === site.toLowerCase() || hostname.endsWith('.' + site.toLowerCase())
    );
  }

  /**
   * Enforce SafeSearch on search URLs
   */
  enforceSearchSafety(url: string): string {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();

      // Check if this is a search engine
      for (const [domain, param] of Object.entries(SAFESEARCH_PARAMS)) {
        if (hostname.includes(domain)) {
          // Check if it's actually a search URL
          const isSearch = urlObj.pathname.includes('/search') ||
                          urlObj.searchParams.has('q') ||
                          urlObj.searchParams.has('query');

          if (isSearch) {
            // Add SafeSearch parameter if not already present
            const paramKey = param.split('=')[0].replace('&', '');
            if (!urlObj.searchParams.has(paramKey)) {
              return url + (url.includes('?') ? param : param.replace(/^&/, '?'));
            }
          }
          break;
        }
      }
    } catch {
      // Invalid URL, return as-is
    }

    return url;
  }

  /**
   * Get blocked page HTML
   */
  getBlockedPageHtml(url: string, childName?: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>This site is blocked</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      text-align: center;
      color: white;
      max-width: 400px;
    }
    .shield {
      font-size: 80px;
      margin-bottom: 20px;
      animation: bounce 2s infinite;
    }
    @keyframes bounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-10px); }
    }
    h1 {
      font-size: 28px;
      margin-bottom: 16px;
    }
    p {
      font-size: 18px;
      opacity: 0.9;
      margin-bottom: 24px;
      line-height: 1.5;
    }
    .btn {
      display: inline-block;
      background: white;
      color: #667eea;
      padding: 14px 32px;
      border-radius: 30px;
      font-size: 16px;
      font-weight: 600;
      text-decoration: none;
      transition: transform 0.2s;
    }
    .btn:hover { transform: scale(1.05); }
    .stars {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      overflow: hidden;
      pointer-events: none;
      z-index: -1;
    }
    .star {
      position: absolute;
      width: 10px;
      height: 10px;
      background: rgba(255,255,255,0.3);
      border-radius: 50%;
      animation: twinkle 3s infinite;
    }
    @keyframes twinkle {
      0%, 100% { opacity: 0.3; }
      50% { opacity: 0.8; }
    }
  </style>
</head>
<body>
  <div class="stars">
    ${Array.from({length: 20}, (_, i) => 
      `<div class="star" style="top:${Math.random()*100}%;left:${Math.random()*100}%;animation-delay:${Math.random()*3}s"></div>`
    ).join('')}
  </div>
  <div class="container">
    <div class="shield">🛡️</div>
    <h1>Oops! This Site is Blocked</h1>
    <p>
      ${childName ? `Hey ${childName}! ` : ''}This website isn't available in Kids Mode.
      Let's go back and find something fun and safe to explore!
    </p>
    <a href="javascript:history.back()" class="btn">Go Back</a>
  </div>
</body>
</html>
`;
  }

  /**
   * Get time limit reached HTML
   */
  getTimeLimitHtml(childName?: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Time's Up!</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      text-align: center;
      color: white;
      max-width: 400px;
    }
    .clock {
      font-size: 80px;
      margin-bottom: 20px;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.1); }
    }
    h1 {
      font-size: 32px;
      margin-bottom: 16px;
    }
    p {
      font-size: 18px;
      opacity: 0.9;
      margin-bottom: 24px;
      line-height: 1.5;
    }
    .message {
      background: rgba(255,255,255,0.2);
      padding: 20px;
      border-radius: 16px;
      margin-top: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="clock">⏰</div>
    <h1>Time's Up!</h1>
    <p>
      ${childName ? `Great job today, ${childName}! ` : ''}
      Your screen time for today is finished. 
      Time to do something fun offline!
    </p>
    <div class="message">
      <p>📚 Read a book</p>
      <p>🎨 Draw a picture</p>
      <p>🏃 Play outside</p>
      <p>👨‍👩‍👧 Spend time with family</p>
    </div>
  </div>
</body>
</html>
`;
  }

  /**
   * Get safe sites list for display
   */
  getSafeSites(ageGroup: AgeGroup): { name: string; url: string; icon: string }[] {
    const sites = [
      { name: 'YouTube Kids', url: 'https://kids.youtube.com', icon: '🎬' },
      { name: 'PBS Kids', url: 'https://pbskids.org', icon: '📺' },
      { name: 'Khan Academy', url: 'https://www.khanacademy.org', icon: '📚' },
      { name: 'National Geographic Kids', url: 'https://kids.nationalgeographic.com', icon: '🌍' },
      { name: 'NASA Space Place', url: 'https://spaceplace.nasa.gov', icon: '🚀' },
      { name: 'Scratch', url: 'https://scratch.mit.edu', icon: '💻' },
    ];

    if (ageGroup !== 'little-kids') {
      sites.push(
        { name: 'Wikipedia', url: 'https://en.wikipedia.org', icon: '📖' },
        { name: 'YouTube', url: 'https://www.youtube.com', icon: '📹' },
      );
    }

    return sites;
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const kidsContentFilter = new KidsContentFilter();

export default kidsContentFilter;
