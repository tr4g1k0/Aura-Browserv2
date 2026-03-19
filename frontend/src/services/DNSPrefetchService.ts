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

const dnsCache: Map<string, { resolved: boolean; timestamp: number }> = new Map();
const DNS_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

async function prefetchDomain(domain: string): Promise<void> {
  try {
    const cached = dnsCache.get(domain);
    if (cached && Date.now() - cached.timestamp < DNS_CACHE_TTL) return;

    // Trigger DNS resolution by fetching favicon (tiny payload)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    await fetch(`https://${domain}/favicon.ico`, {
      method: 'HEAD',
      signal: controller.signal,
      mode: 'no-cors',
    }).catch(() => {});
    clearTimeout(timeout);

    dnsCache.set(domain, { resolved: true, timestamp: Date.now() });
    console.log(`[DNS Prefetch] Resolved: ${domain}`);
  } catch {
    // Non-critical, silently fail
  }
}

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

export function prefetchDomainForUrl(url: string): void {
  try {
    const domain = new URL(url).hostname;
    if (!dnsCache.has(domain)) {
      prefetchDomain(domain);
    }
  } catch {}
}
