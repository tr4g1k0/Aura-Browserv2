// Tab Summarization Service
// Uses LLM to categorize tabs and generate summaries

import { hybridAIRouter } from '../ai/HybridAIRouter';
import { Tab } from '../store/browserStore';

export interface TabCategory {
  name: string;
  color: string;
  tabs: Tab[];
}

export interface TabBrief {
  category: string;
  summary: string;
  keyPoints: string[];
  generationTimeMs: number;
  source: 'local' | 'cloud' | 'mock';
}

const CATEGORY_COLORS: Record<string, string> = {
  Shopping: '#FF6B6B',
  Research: '#4ECDC4',
  Entertainment: '#A78BFA',
  News: '#F59E0B',
  Social: '#EC4899',
  Work: '#3B82F6',
  Finance: '#10B981',
  Health: '#06B6D4',
  Travel: '#8B5CF6',
  Other: '#6B7280',
};

class TabSummarizationService {
  private categoryPromptTemplate = `You are a tab categorization assistant. Categorize the following browser tabs into logical groups.

Available categories: Shopping, Research, Entertainment, News, Social, Work, Finance, Health, Travel, Other

For each tab, respond with ONLY a JSON array in this format:
[{"id": "tab_id", "category": "Category_Name"}]

Tabs to categorize:
{TABS}

JSON Response:`;

  private summaryPromptTemplate = `You are a helpful assistant that creates concise summaries.

Create a brief summary of these browser tabs in the "{CATEGORY}" category.

Format your response as:
- A 2-3 sentence overview
- 3-5 bullet points of key information

Tabs:
{TABS}

Summary:`;

  /**
   * Categorize tabs using AI
   */
  async categorizeTabs(tabs: Tab[]): Promise<TabCategory[]> {
    if (tabs.length === 0) {
      return [];
    }

    const tabsText = tabs.map(t => 
      `- ID: ${t.id}, Title: "${t.title}", URL: ${t.url}`
    ).join('\n');

    const prompt = this.categoryPromptTemplate.replace('{TABS}', tabsText);

    try {
      const response = await hybridAIRouter.runLLM(prompt, 512);
      
      // Parse the response
      const categories = this.parseCategoryResponse(response.result.text, tabs);
      return categories;
    } catch (error) {
      console.error('[TabSummarization] Categorization failed:', error);
      
      // Fallback: simple URL-based categorization
      return this.fallbackCategorization(tabs);
    }
  }

  /**
   * Generate a brief summary for a group of tabs
   */
  async generateBrief(category: string, tabs: Tab[]): Promise<TabBrief> {
    const startTime = Date.now();

    if (tabs.length === 0) {
      return {
        category,
        summary: 'No tabs in this category.',
        keyPoints: [],
        generationTimeMs: 0,
        source: 'mock',
      };
    }

    const tabsText = tabs.map(t => 
      `- ${t.title} (${new URL(t.url).hostname})`
    ).join('\n');

    const prompt = this.summaryPromptTemplate
      .replace('{CATEGORY}', category)
      .replace('{TABS}', tabsText);

    try {
      const response = await hybridAIRouter.runLLM(prompt, 512);
      
      const { summary, keyPoints } = this.parseBriefResponse(response.result.text);

      return {
        category,
        summary,
        keyPoints,
        generationTimeMs: Date.now() - startTime,
        source: response.source,
      };
    } catch (error) {
      console.error('[TabSummarization] Brief generation failed:', error);
      
      return {
        category,
        summary: `This group contains ${tabs.length} tab(s) related to ${category.toLowerCase()}.`,
        keyPoints: tabs.slice(0, 3).map(t => t.title),
        generationTimeMs: Date.now() - startTime,
        source: 'mock',
      };
    }
  }

  /**
   * Stream brief generation for real-time UI updates
   */
  async *streamBrief(
    category: string,
    tabs: Tab[]
  ): AsyncGenerator<{ text: string; done: boolean }> {
    if (tabs.length === 0) {
      yield { text: 'No tabs in this category.', done: true };
      return;
    }

    const tabsText = tabs.map(t => 
      `- ${t.title} (${new URL(t.url).hostname})`
    ).join('\n');

    const prompt = this.summaryPromptTemplate
      .replace('{CATEGORY}', category)
      .replace('{TABS}', tabsText);

    try {
      for await (const chunk of hybridAIRouter.streamLLM(prompt, 512)) {
        yield { text: chunk.token, done: chunk.done };
      }
    } catch (error) {
      console.error('[TabSummarization] Stream failed:', error);
      yield { 
        text: `This group contains ${tabs.length} tabs related to ${category.toLowerCase()}.`,
        done: true 
      };
    }
  }

  /**
   * Parse category response from LLM
   */
  private parseCategoryResponse(response: string, tabs: Tab[]): TabCategory[] {
    const categoryMap = new Map<string, Tab[]>();

    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\[.*\]/s);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        for (const item of parsed) {
          const tab = tabs.find(t => t.id === item.id);
          if (tab) {
            const category = item.category || 'Other';
            if (!categoryMap.has(category)) {
              categoryMap.set(category, []);
            }
            categoryMap.get(category)!.push(tab);
          }
        }
      }
    } catch (e) {
      console.warn('[TabSummarization] Failed to parse category response:', e);
      return this.fallbackCategorization(tabs);
    }

    // Convert to array
    const categories: TabCategory[] = [];
    categoryMap.forEach((categoryTabs, name) => {
      categories.push({
        name,
        color: CATEGORY_COLORS[name] || CATEGORY_COLORS.Other,
        tabs: categoryTabs,
      });
    });

    // Add uncategorized tabs
    const categorizedIds = new Set(categories.flatMap(c => c.tabs.map(t => t.id)));
    const uncategorized = tabs.filter(t => !categorizedIds.has(t.id));
    if (uncategorized.length > 0) {
      categories.push({
        name: 'Other',
        color: CATEGORY_COLORS.Other,
        tabs: uncategorized,
      });
    }

    return categories;
  }

  /**
   * Parse brief response from LLM
   */
  private parseBriefResponse(response: string): { summary: string; keyPoints: string[] } {
    const lines = response.split('\n').filter(l => l.trim());
    const keyPoints: string[] = [];
    let summary = '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('-') || trimmed.startsWith('•') || trimmed.startsWith('*')) {
        keyPoints.push(trimmed.replace(/^[-•*]\s*/, ''));
      } else if (!summary && trimmed.length > 20) {
        summary = trimmed;
      }
    }

    // If no clear structure, use the whole response as summary
    if (!summary) {
      summary = response.substring(0, 200);
    }

    return { summary, keyPoints: keyPoints.slice(0, 5) };
  }

  /**
   * Fallback URL-based categorization
   */
  private fallbackCategorization(tabs: Tab[]): TabCategory[] {
    const categoryMap = new Map<string, Tab[]>();

    for (const tab of tabs) {
      const category = this.categorizeByUrl(tab.url.toLowerCase(), tab.title.toLowerCase());
      if (!categoryMap.has(category)) {
        categoryMap.set(category, []);
      }
      categoryMap.get(category)!.push(tab);
    }

    return Array.from(categoryMap.entries()).map(([name, categoryTabs]) => ({
      name,
      color: CATEGORY_COLORS[name] || CATEGORY_COLORS.Other,
      tabs: categoryTabs,
    }));
  }

  /**
   * Simple URL-based categorization
   */
  private categorizeByUrl(url: string, title: string): string {
    const combined = url + ' ' + title;

    if (/amazon|ebay|shop|store|buy|cart|checkout|product/i.test(combined)) {
      return 'Shopping';
    }
    if (/wikipedia|docs|documentation|research|scholar|academic/i.test(combined)) {
      return 'Research';
    }
    if (/youtube|netflix|twitch|spotify|game|movie|music/i.test(combined)) {
      return 'Entertainment';
    }
    if (/news|cnn|bbc|reuters|times|post|journal/i.test(combined)) {
      return 'News';
    }
    if (/twitter|facebook|instagram|linkedin|reddit|social/i.test(combined)) {
      return 'Social';
    }
    if (/github|gitlab|jira|slack|notion|trello|asana/i.test(combined)) {
      return 'Work';
    }
    if (/bank|finance|invest|stock|crypto|trading/i.test(combined)) {
      return 'Finance';
    }
    if (/health|medical|doctor|fitness|workout/i.test(combined)) {
      return 'Health';
    }
    if (/travel|flight|hotel|booking|airbnb|vacation/i.test(combined)) {
      return 'Travel';
    }

    return 'Other';
  }
}

// Singleton instance
export const tabSummarizationService = new TabSummarizationService();
