/**
 * AI Tab Agent Service
 * 
 * Provides AI-powered tab management features:
 * - Tab grouping by user intent (Research, Shopping, Entertainment, etc.)
 * - Group summarization with bullet points
 * 
 * Currently in MOCK MODE - simulates AI responses with realistic delays.
 * Future implementation will connect to backend AI endpoints.
 */

import { Tab } from '../store/browserStore';

// ============================================================================
// TYPES
// ============================================================================

export interface TabGroup {
  id: string;
  category: string;
  icon: string;
  color: string;
  tabs: TabWithSnippet[];
  isExpanded: boolean;
  summary?: GroupSummary;
  isSummarizing?: boolean;
}

export interface TabWithSnippet extends Tab {
  snippet?: string;
  domain?: string;
}

export interface GroupSummary {
  bullets: string[];
  generatedAt: number;
  confidence: number;
}

export interface GroupingResult {
  groups: TabGroup[];
  processingTimeMs: number;
  tabCount: number;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const CATEGORY_CONFIG: Record<string, { icon: string; color: string; keywords: string[] }> = {
  Shopping: {
    icon: 'cart',
    color: '#FF6B6B',
    keywords: ['amazon', 'ebay', 'shop', 'store', 'buy', 'deal', 'product', 'price', 'cart', 'checkout', 'walmart', 'target', 'bestbuy'],
  },
  Research: {
    icon: 'school',
    color: '#4ECDC4',
    keywords: ['wikipedia', 'docs', 'documentation', 'learn', 'tutorial', 'guide', 'how to', 'stackoverflow', 'mdn', 'w3schools'],
  },
  Entertainment: {
    icon: 'play-circle',
    color: '#A78BFA',
    keywords: ['youtube', 'netflix', 'spotify', 'twitch', 'hulu', 'disney', 'video', 'music', 'stream', 'watch', 'play'],
  },
  News: {
    icon: 'newspaper',
    color: '#F59E0B',
    keywords: ['news', 'ycombinator', 'reddit', 'bbc', 'cnn', 'nytimes', 'techcrunch', 'verge', 'arstechnica', 'breaking'],
  },
  Development: {
    icon: 'code-slash',
    color: '#3B82F6',
    keywords: ['github', 'gitlab', 'dev.to', 'code', 'npm', 'package', 'api', 'framework', 'library', 'react', 'expo'],
  },
  Social: {
    icon: 'people',
    color: '#EC4899',
    keywords: ['twitter', 'facebook', 'instagram', 'linkedin', 'tiktok', 'social', 'post', 'feed', 'message'],
  },
  Communication: {
    icon: 'mail',
    color: '#10B981',
    keywords: ['gmail', 'mail', 'email', 'outlook', 'slack', 'discord', 'teams', 'chat'],
  },
  'Reading List': {
    icon: 'book',
    color: '#8B5CF6',
    keywords: ['medium', 'blog', 'article', 'read', 'story', 'post', 'writing'],
  },
  Other: {
    icon: 'folder',
    color: '#6B7280',
    keywords: [],
  },
};

// Mock summaries for different categories
const MOCK_SUMMARIES: Record<string, string[][]> = {
  Shopping: [
    ['Comparing prices for wireless earbuds across multiple retailers', 'Sony and Apple products dominating your shopping research', 'Consider checking for active coupon codes before purchasing'],
    ['Electronics comparison shopping in progress', 'Multiple premium headphone options being evaluated', 'Price points ranging from $199-$399'],
  ],
  Research: [
    ['Deep dive into artificial intelligence fundamentals', 'Machine learning concepts being explored across sources', 'Technical documentation suggests hands-on implementation next'],
    ['Academic research pattern detected', 'Cross-referencing multiple knowledge sources', 'Consider saving key findings for future reference'],
  ],
  Entertainment: [
    ['Music and video content being consumed', 'Mix of educational and entertainment YouTube content', 'Consider creating a playlist for offline viewing'],
    ['Streaming content exploration active', 'Multiple platforms being browsed', 'Popular content trending in your interests'],
  ],
  News: [
    ['Tech industry news and updates being monitored', 'Startup and VC activity on your radar', 'Breaking developments in AI and software'],
    ['Current events tracking across multiple sources', 'Community discussions providing diverse perspectives', 'Save interesting threads for later reading'],
  ],
  Development: [
    ['Active coding session with React Native focus', 'GitHub repositories being researched for best practices', 'Documentation suggests mobile-first development approach'],
    ['Open source projects under review', 'Framework comparisons in progress', 'Consider starring useful repositories'],
  ],
  Social: [
    ['Social media engagement across platforms', 'Trending topics in your network', 'Consider scheduling posts for optimal engagement'],
  ],
  Communication: [
    ['Email and messaging apps in active use', 'Multiple communication channels open', 'Consider consolidating notifications'],
  ],
  'Reading List': [
    ['Long-form articles queued for reading', 'Technical blog posts in focus', 'Consider using reader mode for distraction-free reading'],
  ],
  Other: [
    ['Miscellaneous browsing activity', 'Tabs may benefit from manual categorization', 'Consider closing unused tabs to improve performance'],
  ],
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const generateId = () => Math.random().toString(36).substring(2, 11);

/**
 * Extract domain from URL
 */
const extractDomain = (url: string): string => {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
};

/**
 * Categorize a tab based on URL and title
 */
const categorizeTab = (tab: Tab): string => {
  const urlLower = tab.url.toLowerCase();
  const titleLower = (tab.title || '').toLowerCase();
  const combined = `${urlLower} ${titleLower}`;

  for (const [category, config] of Object.entries(CATEGORY_CONFIG)) {
    if (category === 'Other') continue;
    
    for (const keyword of config.keywords) {
      if (combined.includes(keyword)) {
        return category;
      }
    }
  }

  return 'Other';
};

/**
 * Generate a mock snippet for a tab
 */
const generateMockSnippet = (tab: Tab): string => {
  const snippets: Record<string, string> = {
    amazon: 'Free delivery on orders over $25. Prime members get free shipping.',
    wikipedia: 'From Wikipedia, the free encyclopedia. This article is about...',
    youtube: 'Watch this video and subscribe for more content. Like and comment!',
    github: 'Open source project with active community. Check the README for setup.',
    google: 'Search the world\'s information, including webpages, images, and more.',
  };

  const domain = extractDomain(tab.url);
  for (const [key, snippet] of Object.entries(snippets)) {
    if (domain.includes(key)) {
      return snippet;
    }
  }

  return `Content from ${domain}. Page loaded successfully.`;
};

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Group tabs by user intent using AI categorization
 * 
 * @param tabs - Array of tabs to group
 * @returns Promise with grouped tabs and metadata
 */
export const groupTabsByIntent = async (tabs: Tab[]): Promise<GroupingResult> => {
  const startTime = Date.now();
  
  console.log(`[AITabAgent] Grouping ${tabs.length} tabs by intent...`);
  
  // MOCK MODE: Simulate AI processing delay (1.5 seconds as specified)
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // Create tabs with snippets and domains
  const tabsWithSnippets: TabWithSnippet[] = tabs.map(tab => ({
    ...tab,
    snippet: generateMockSnippet(tab),
    domain: extractDomain(tab.url),
  }));
  
  // Group tabs by category
  const categoryMap = new Map<string, TabWithSnippet[]>();
  
  tabsWithSnippets.forEach(tab => {
    const category = categorizeTab(tab);
    
    if (!categoryMap.has(category)) {
      categoryMap.set(category, []);
    }
    categoryMap.get(category)!.push(tab);
  });
  
  // Convert to TabGroup array
  const groups: TabGroup[] = [];
  
  categoryMap.forEach((groupTabs, category) => {
    const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.Other;
    groups.push({
      id: generateId(),
      category,
      icon: config.icon,
      color: config.color,
      tabs: groupTabs,
      isExpanded: true,
    });
  });
  
  // Sort by number of tabs (most first)
  groups.sort((a, b) => b.tabs.length - a.tabs.length);
  
  const processingTimeMs = Date.now() - startTime;
  
  console.log(`[AITabAgent] Grouped into ${groups.length} categories in ${processingTimeMs}ms`);
  
  return {
    groups,
    processingTimeMs,
    tabCount: tabs.length,
  };
};

/**
 * Generate a summary for a group of tabs
 * 
 * @param group - The tab group to summarize
 * @returns Promise with summary bullets
 */
export const generateGroupSummary = async (group: TabGroup): Promise<GroupSummary> => {
  console.log(`[AITabAgent] Generating summary for "${group.category}" (${group.tabs.length} tabs)...`);
  
  // MOCK MODE: Simulate AI processing delay (2 seconds as specified)
  // Simulate typing delay with incremental progress
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Get mock summaries for this category
  const categorySummaries = MOCK_SUMMARIES[group.category] || MOCK_SUMMARIES.Other;
  const summaryIndex = Math.floor(Math.random() * categorySummaries.length);
  const bullets = categorySummaries[summaryIndex];
  
  // Customize bullets based on actual tabs if possible
  const customizedBullets = bullets.map((bullet, index) => {
    // First bullet: mention specific tabs
    if (index === 0 && group.tabs.length > 0) {
      const tabTitles = group.tabs.slice(0, 2).map(t => {
        const title = t.title || t.domain || 'page';
        return title.length > 30 ? title.substring(0, 30) + '...' : title;
      });
      if (group.tabs.length > 2) {
        return `Browsing "${tabTitles[0]}" and ${group.tabs.length - 1} related pages`;
      }
    }
    return bullet;
  });
  
  const summary: GroupSummary = {
    bullets: customizedBullets,
    generatedAt: Date.now(),
    confidence: 0.85 + Math.random() * 0.15,
  };
  
  console.log(`[AITabAgent] Summary generated for "${group.category}"`);
  
  return summary;
};

/**
 * Analyze tab patterns and suggest actions
 * 
 * @param tabs - Array of tabs to analyze
 * @returns Suggestions for tab management
 */
export const analyzeTabPatterns = async (tabs: Tab[]): Promise<string[]> => {
  await new Promise(resolve => setTimeout(resolve, 500));
  
  const suggestions: string[] = [];
  
  if (tabs.length > 10) {
    suggestions.push('You have many open tabs. Consider closing unused ones.');
  }
  
  const domains = tabs.map(t => extractDomain(t.url));
  const duplicateDomains = domains.filter((d, i) => domains.indexOf(d) !== i);
  
  if (duplicateDomains.length > 0) {
    suggestions.push(`Multiple tabs from the same site detected. Consider consolidating.`);
  }
  
  return suggestions;
};

/**
 * Check if we're in mock mode
 */
export const isInMockMode = (): boolean => {
  // Currently always in mock mode
  // Future: check for backend connectivity
  return true;
};

export default {
  groupTabsByIntent,
  generateGroupSummary,
  analyzeTabPatterns,
  isInMockMode,
};
