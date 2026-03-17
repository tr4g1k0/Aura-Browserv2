/**
 * Semantic History Service
 * Transforms browser history from simple URLs into AI-powered semantic memory
 * 
 * PRIVACY GUARD:
 * All AI History processing happens 100% locally on-device.
 * No page content, URLs, or semantic labels ever leave this device.
 * The AI model runs completely offline using ONNX Runtime.
 * 
 * This service extracts page context (title, description, body text) and
 * generates semantic labels that describe the user's browsing intent.
 */

import { hybridAIRouter } from '../ai/HybridAIRouter';

export interface PageContext {
  url: string;
  title: string;
  metaDescription: string;
  bodyText: string;  // First 1000 chars of main content
  timestamp: number;
}

export interface SemanticHistoryEntry {
  url: string;
  title: string;
  timestamp: number;
  favicon?: string;
  // Semantic Time-Machine fields
  semanticLabel?: string;      // AI-generated 10-15 word intent description
  metaDescription?: string;    // Page meta description
  thumbnailUri?: string;       // Page thumbnail (future feature)
}

/**
 * JavaScript to inject into WebView for extracting page context
 * Extracts: title, meta description, and first 1000 chars of body text
 */
export const pageContextExtractionScript = `
(function() {
  'use strict';
  
  /* Semantic Time-Machine: Page Context Extractor */
  /* PRIVACY: This data is processed 100% locally - never sent to any server */
  
  try {
    // Get page title
    var title = document.title || '';
    
    // Get meta description
    var metaDescription = '';
    var metaTag = document.querySelector('meta[name="description"]') ||
                  document.querySelector('meta[property="og:description"]') ||
                  document.querySelector('meta[name="twitter:description"]');
    if (metaTag) {
      metaDescription = metaTag.getAttribute('content') || '';
    }
    
    // Get main body text (prioritize article content)
    var bodyText = '';
    
    // Try to find article content first
    var articleSelectors = [
      'article',
      '[role="main"]',
      'main',
      '.article-content',
      '.post-content',
      '.entry-content',
      '.content',
      '#content',
      '.story-body',
      '.article-body'
    ];
    
    var mainContent = null;
    for (var i = 0; i < articleSelectors.length; i++) {
      mainContent = document.querySelector(articleSelectors[i]);
      if (mainContent) break;
    }
    
    // Fall back to body if no article found
    var textSource = mainContent || document.body;
    
    if (textSource) {
      // Get text content, clean up whitespace
      bodyText = textSource.innerText || textSource.textContent || '';
      bodyText = bodyText.replace(/\\s+/g, ' ').trim();
      // Limit to first 1000 characters
      bodyText = bodyText.substring(0, 1000);
    }
    
    // Send context back to React Native
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'PAGE_CONTEXT',
      url: window.location.href,
      title: title,
      metaDescription: metaDescription,
      bodyText: bodyText,
      timestamp: Date.now()
    }));
    
    console.log('[Semantic History] Page context extracted');
  } catch (e) {
    console.error('[Semantic History] Extraction error:', e);
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'PAGE_CONTEXT_ERROR',
      error: e.message
    }));
  }
})();
true;`;

/**
 * Semantic Label Generator
 * Uses local AI to generate a 10-15 word description of page intent
 */
class SemanticHistoryService {
  private isProcessing: boolean = false;
  private processingQueue: PageContext[] = [];

  /**
   * PRIVACY GUARD: Generate semantic label 100% locally
   * No page content ever leaves this device
   */
  async generateSemanticLabel(context: PageContext): Promise<string> {
    // Build a concise prompt for the LLM
    const promptContent = this.buildPromptContent(context);
    
    const prompt = `You are a browser history assistant. Generate a concise 10-15 word description of what the user was looking for on this page. Focus on their intent and the key topic.

Page Title: ${context.title}
Description: ${context.metaDescription || 'N/A'}
Content Preview: ${promptContent}

Semantic Label (10-15 words):`;

    try {
      console.log('[SemanticHistory] Generating label for:', context.url);
      
      const response = await hybridAIRouter.runLLM(prompt, 64);
      
      // Extract and clean the label
      let label = response.result.text.trim();
      
      // Remove any quotes or extra formatting
      label = label.replace(/^["']+|["']+$/g, '').trim();
      
      // Ensure it's not too long (max ~20 words as buffer)
      const words = label.split(/\s+/);
      if (words.length > 20) {
        label = words.slice(0, 15).join(' ') + '...';
      }
      
      console.log(`[SemanticHistory] Generated label (${response.source}): ${label}`);
      
      return label;
    } catch (error) {
      console.error('[SemanticHistory] Label generation failed:', error);
      // Fallback: Create a simple label from title
      return this.createFallbackLabel(context);
    }
  }

  /**
   * Build prompt content from page context
   */
  private buildPromptContent(context: PageContext): string {
    // Combine meta description and body text
    let content = '';
    
    if (context.metaDescription) {
      content += context.metaDescription + ' ';
    }
    
    if (context.bodyText) {
      // Use first 500 chars of body to keep prompt reasonable
      content += context.bodyText.substring(0, 500);
    }
    
    // Clean up and truncate
    content = content.replace(/\s+/g, ' ').trim();
    return content.substring(0, 600) || 'No content available';
  }

  /**
   * Create a fallback label when AI is unavailable
   */
  private createFallbackLabel(context: PageContext): string {
    // Use title and try to extract key info
    let label = context.title || 'Visited page';
    
    // Clean up common title patterns
    label = label
      .replace(/\s*[-|–]\s*.*$/, '')  // Remove site name after dash
      .replace(/\s*\|\s*.*$/, '')      // Remove site name after pipe
      .trim();
    
    // Limit length
    const words = label.split(/\s+/);
    if (words.length > 12) {
      label = words.slice(0, 10).join(' ') + '...';
    }
    
    return label;
  }

  /**
   * Process page context and return enhanced history entry
   */
  async processPageContext(context: PageContext): Promise<SemanticHistoryEntry> {
    const semanticLabel = await this.generateSemanticLabel(context);
    
    return {
      url: context.url,
      title: context.title,
      timestamp: context.timestamp,
      semanticLabel,
      metaDescription: context.metaDescription,
    };
  }

  /**
   * Fuzzy search implementation for semantic history
   * Searches against both title and semanticLabel
   */
  fuzzySearch(query: string, entries: SemanticHistoryEntry[]): SemanticHistoryEntry[] {
    if (!query.trim()) return entries;
    
    const searchTerms = query.toLowerCase().split(/\s+/);
    
    return entries.filter(entry => {
      const searchableText = [
        entry.title || '',
        entry.semanticLabel || '',
        entry.metaDescription || '',
        entry.url || ''
      ].join(' ').toLowerCase();
      
      // Check if all search terms are found (fuzzy AND matching)
      return searchTerms.every(term => {
        // Exact match
        if (searchableText.includes(term)) return true;
        
        // Fuzzy match: allow 1-2 character differences for terms > 4 chars
        if (term.length > 4) {
          const words = searchableText.split(/\s+/);
          return words.some(word => this.fuzzyMatch(term, word, 2));
        }
        
        return false;
      });
    }).sort((a, b) => {
      // Sort by relevance: prefer matches in semanticLabel, then title
      const aScore = this.calculateRelevanceScore(query, a);
      const bScore = this.calculateRelevanceScore(query, b);
      return bScore - aScore;
    });
  }

  /**
   * Simple fuzzy matching with max edit distance
   */
  private fuzzyMatch(term: string, word: string, maxDistance: number): boolean {
    if (Math.abs(term.length - word.length) > maxDistance) return false;
    
    // Quick check: if word contains term or vice versa
    if (word.includes(term) || term.includes(word)) return true;
    
    // Levenshtein distance (simplified for performance)
    let distance = 0;
    const minLen = Math.min(term.length, word.length);
    
    for (let i = 0; i < minLen; i++) {
      if (term[i] !== word[i]) distance++;
      if (distance > maxDistance) return false;
    }
    
    distance += Math.abs(term.length - word.length);
    return distance <= maxDistance;
  }

  /**
   * Calculate relevance score for sorting
   */
  private calculateRelevanceScore(query: string, entry: SemanticHistoryEntry): number {
    const queryLower = query.toLowerCase();
    let score = 0;
    
    // Higher score for semantic label matches
    if (entry.semanticLabel?.toLowerCase().includes(queryLower)) {
      score += 10;
    }
    
    // Medium score for title matches
    if (entry.title?.toLowerCase().includes(queryLower)) {
      score += 5;
    }
    
    // Lower score for URL matches
    if (entry.url?.toLowerCase().includes(queryLower)) {
      score += 2;
    }
    
    // Boost recent entries
    const ageInDays = (Date.now() - entry.timestamp) / (1000 * 60 * 60 * 24);
    score += Math.max(0, 5 - ageInDays); // Bonus for entries within 5 days
    
    return score;
  }
}

// Singleton export
export const semanticHistoryService = new SemanticHistoryService();
