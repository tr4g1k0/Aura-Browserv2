import { Platform, InteractionManager } from 'react-native';

const QUICK_ACCESS_DOMAINS = [
  'www.google.com',
  'www.youtube.com',
  'en.wikipedia.org',
  'duckduckgo.com',
  'search.brave.com',
  'www.bing.com',
  'www.reddit.com',
  'github.com',
];

// Local DNS cache with TTL
interface DNSCacheEntry {
  resolved: boolean;
  timestamp: number;
  faviconCached: boolean;
}

const dnsCache: Map<string, DNSCacheEntry> = new Map();
const DNS_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// Favicon URLs cache for instant display
const faviconCache: Map<string, string> = new Map();

/**
 * Get cached favicon URL for a domain
 */
export function getCachedFavicon(domain: string): string | null {
  return faviconCache.get(domain) || null;
}

/**
 * Pre-fetch DNS and favicon for a domain
 */
async function prefetchDomain(domain: string): Promise<void> {
  try {
    const cached = dnsCache.get(domain);
    if (cached && Date.now() - cached.timestamp < DNS_CACHE_TTL) return;

    // Trigger DNS resolution by fetching favicon (tiny payload)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    
    // Try to fetch favicon - this resolves DNS and caches the favicon
    const faviconUrl = `https://${domain}/favicon.ico`;
    const response = await fetch(faviconUrl, {
      method: 'HEAD',
      signal: controller.signal,
      mode: 'no-cors',
    }).catch(() => null);
    
    clearTimeout(timeout);

    // Cache the favicon URL if successful
    if (response) {
      faviconCache.set(domain, faviconUrl);
    }

    dnsCache.set(domain, { 
      resolved: true, 
      timestamp: Date.now(),
      faviconCached: !!response,
    });
    console.log(`[DNS Prefetch] Resolved: ${domain}`);
  } catch {
    // Non-critical, silently fail but still cache the attempt
    dnsCache.set(domain, { 
      resolved: false, 
      timestamp: Date.now(),
      faviconCached: false,
    });
  }
}

/**
 * Pre-fetch DNS for all Quick Access domains on app startup
 * Also preloads favicons for instant display
 */
export function prefetchQuickAccessDNS(): void {
  if (Platform.OS === 'web') return; // Web handles DNS natively

  InteractionManager.runAfterInteractions(() => {
    console.log('[DNS Prefetch] Starting prefetch for Quick Access domains...');
    // Stagger requests to avoid flooding
    QUICK_ACCESS_DOMAINS.forEach((domain, i) => {
      setTimeout(() => prefetchDomain(domain), i * 200);
    });
  });
}

/**
 * Pre-fetch DNS for a specific URL (called when user hovers/focuses on a link)
 */
export function prefetchDomainForUrl(url: string): void {
  try {
    const domain = new URL(url).hostname;
    if (!dnsCache.has(domain)) {
      prefetchDomain(domain);
    }
  } catch {}
}

/**
 * Check if a domain's DNS is already cached
 */
export function isDNSCached(domain: string): boolean {
  const cached = dnsCache.get(domain);
  return cached ? (Date.now() - cached.timestamp < DNS_CACHE_TTL) : false;
}

/**
 * Get DNS cache stats for debugging
 */
export function getDNSCacheStats(): { total: number; resolved: number; withFavicons: number } {
  let resolved = 0;
  let withFavicons = 0;
  
  dnsCache.forEach((entry) => {
    if (entry.resolved) resolved++;
    if (entry.faviconCached) withFavicons++;
  });

  return {
    total: dnsCache.size,
    resolved,
    withFavicons,
  };
}
