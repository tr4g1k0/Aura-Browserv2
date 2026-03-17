// Zero-Load Predictive Caching Module
// Analyzes links on the current page and pre-fetches likely next clicks

import { CachedPage } from '../store/browserStore';

// Extract all links from HTML content
export const extractLinks = (html: string, baseUrl: string): string[] => {
  const linkRegex = /<a[^>]+href=["']([^"']+)["']/gi;
  const links: string[] = [];
  let match;
  
  while ((match = linkRegex.exec(html)) !== null) {
    try {
      const href = match[1];
      if (href.startsWith('http')) {
        links.push(href);
      } else if (href.startsWith('/')) {
        const url = new URL(baseUrl);
        links.push(`${url.origin}${href}`);
      }
    } catch {
      // Invalid URL, skip
    }
  }
  
  return [...new Set(links)]; // Remove duplicates
};

// Score links by likelihood of being clicked
export const scoreLinks = (links: string[], currentUrl: string): { url: string; score: number }[] => {
  const currentDomain = new URL(currentUrl).hostname;
  
  return links
    .map((url) => {
      let score = 0;
      
      try {
        const linkDomain = new URL(url).hostname;
        
        // Same domain gets higher score
        if (linkDomain === currentDomain) score += 50;
        
        // Common navigation patterns get higher scores
        if (url.includes('/article')) score += 20;
        if (url.includes('/post')) score += 20;
        if (url.includes('/news')) score += 15;
        if (url.includes('/product')) score += 15;
        if (url.includes('/detail')) score += 15;
        
        // Avoid utility pages
        if (url.includes('/login')) score -= 30;
        if (url.includes('/signup')) score -= 30;
        if (url.includes('/cart')) score -= 20;
        if (url.includes('/checkout')) score -= 40;
        if (url.includes('/admin')) score -= 50;
        
        // Shorter paths often more important
        const pathLength = new URL(url).pathname.split('/').filter(Boolean).length;
        score += Math.max(0, 10 - pathLength * 2);
        
      } catch {
        score = -100; // Invalid URL
      }
      
      return { url, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3); // Top 3 candidates
};

// Prefetch a URL (lightweight fetch to get HTML)
export const prefetchPage = async (url: string): Promise<CachedPage | null> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout
    
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Accept': 'text/html',
        'User-Agent': 'Mozilla/5.0 (compatible; MobileBrowser/1.0)',
      },
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) return null;
    
    const html = await response.text();
    
    return {
      url,
      html,
      timestamp: Date.now(),
    };
  } catch {
    return null;
  }
};

// Main predictive caching function
export const runPredictiveCache = async (
  currentUrl: string,
  pageHtml: string,
  onCachePage: (page: CachedPage) => void
): Promise<void> => {
  const links = extractLinks(pageHtml, currentUrl);
  const scoredLinks = scoreLinks(links, currentUrl);
  
  // Prefetch top candidates in parallel
  const prefetchPromises = scoredLinks.map(async ({ url }) => {
    const cached = await prefetchPage(url);
    if (cached) {
      onCachePage(cached);
    }
  });
  
  await Promise.allSettled(prefetchPromises);
};
