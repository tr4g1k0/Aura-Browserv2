// Vision Shield Service
// Uses VLM to detect and hide ads, trackers, and annoying elements

import { Platform } from 'react-native';
import { hybridAIRouter } from '../ai/HybridAIRouter';
import { VLMResult } from '../ai/types';

export interface DetectedElement {
  type: 'ad' | 'sponsored' | 'cookie_banner' | 'popup' | 'tracker';
  selector: string;
  confidence: number;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface ShieldResult {
  elementsDetected: number;
  elementsHidden: number;
  executionTimeMs: number;
  source: 'local' | 'cloud' | 'mock';
}

export type ShieldCallback = (result: ShieldResult) => void;

class VisionShieldService {
  private isEnabled: boolean = true;
  private callbacks: Set<ShieldCallback> = new Set();
  private lastScanTimestamp: number = 0;
  private scanCooldownMs: number = 5000; // Scan at most every 5 seconds

  // Common ad selectors (fallback when VLM is not available)
  private readonly COMMON_AD_SELECTORS = [
    // Ad networks
    '.adsbygoogle',
    '[id^="google_ads"]',
    '[class*="ad-container"]',
    '[class*="ad-wrapper"]',
    '[class*="advertisement"]',
    '[data-ad-unit]',
    '[data-ad-slot]',
    'iframe[src*="doubleclick"]',
    'iframe[src*="googlesyndication"]',
    
    // Sponsored content
    '[class*="sponsored"]',
    '[class*="promoted"]',
    '[data-sponsored]',
    
    // Cookie banners
    '[class*="cookie-banner"]',
    '[class*="cookie-consent"]',
    '[id*="cookie"]',
    '#onetrust-consent-sdk',
    '.cc-banner',
    
    // Popups
    '[class*="newsletter-popup"]',
    '[class*="modal-overlay"]',
    '[class*="subscribe-popup"]',
    
    // Trackers
    'img[src*="pixel"]',
    'img[src*="beacon"]',
    'img[width="1"][height="1"]',
  ];

  /**
   * Enable/disable the shield
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  /**
   * Check if shield is enabled
   */
  getIsEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Subscribe to shield results
   */
  onResult(callback: ShieldCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  /**
   * Scan the page for ads and trackers
   * @param webViewRef - Reference to inject JavaScript
   * @param screenshotBase64 - Optional screenshot for VLM analysis
   */
  async scanPage(
    injectScript: (script: string) => void,
    screenshotBase64?: string
  ): Promise<ShieldResult> {
    if (!this.isEnabled) {
      return {
        elementsDetected: 0,
        elementsHidden: 0,
        executionTimeMs: 0,
        source: 'mock',
      };
    }

    // Check cooldown
    const now = Date.now();
    if (now - this.lastScanTimestamp < this.scanCooldownMs) {
      return {
        elementsDetected: 0,
        elementsHidden: 0,
        executionTimeMs: 0,
        source: 'mock',
      };
    }
    this.lastScanTimestamp = now;

    const startTime = Date.now();
    let detectedElements: DetectedElement[] = [];
    let source: 'local' | 'cloud' | 'mock' = 'mock';

    try {
      // If screenshot is provided, use VLM for intelligent detection
      if (screenshotBase64) {
        const vlmResponse = await hybridAIRouter.runVLM(screenshotBase64);
        detectedElements = vlmResponse.result.detectedElements;
        source = vlmResponse.source;
      }

      // Combine VLM results with common selectors
      const allSelectors = this.combineSelectors(detectedElements);

      // Inject hiding script
      const hiddenCount = await this.hideElements(injectScript, allSelectors);

      const result: ShieldResult = {
        elementsDetected: allSelectors.length,
        elementsHidden: hiddenCount,
        executionTimeMs: Date.now() - startTime,
        source,
      };

      // Notify listeners
      this.callbacks.forEach(cb => cb(result));

      return result;
    } catch (error) {
      console.error('[VisionShield] Scan failed:', error);
      
      // Fallback to common selectors only
      const hiddenCount = await this.hideElements(injectScript, this.COMMON_AD_SELECTORS);
      
      return {
        elementsDetected: this.COMMON_AD_SELECTORS.length,
        elementsHidden: hiddenCount,
        executionTimeMs: Date.now() - startTime,
        source: 'mock',
      };
    }
  }

  /**
   * Combine VLM-detected selectors with common selectors
   */
  private combineSelectors(vlmElements: DetectedElement[]): string[] {
    const selectors = new Set<string>(this.COMMON_AD_SELECTORS);
    
    for (const element of vlmElements) {
      if (element.selector && element.confidence > 0.7) {
        selectors.add(element.selector);
      }
    }
    
    return Array.from(selectors);
  }

  /**
   * Inject JavaScript to hide elements
   */
  private async hideElements(
    injectScript: (script: string) => void,
    selectors: string[]
  ): Promise<number> {
    const script = `
      (function() {
        const selectors = ${JSON.stringify(selectors)};
        let hiddenCount = 0;
        
        selectors.forEach(function(selector) {
          try {
            const elements = document.querySelectorAll(selector);
            elements.forEach(function(el) {
              if (el && el.style.display !== 'none') {
                el.style.setProperty('display', 'none', 'important');
                el.style.setProperty('visibility', 'hidden', 'important');
                el.style.setProperty('opacity', '0', 'important');
                el.style.setProperty('pointer-events', 'none', 'important');
                el.setAttribute('data-access-hidden', 'true');
                hiddenCount++;
              }
            });
          } catch (e) {
            // Invalid selector, skip
          }
        });
        
        // Also hide elements with aria-label containing ad-related text
        const adLabels = ['advertisement', 'sponsored', 'ad content', 'promoted'];
        adLabels.forEach(function(label) {
          try {
            const elements = document.querySelectorAll('[aria-label*="' + label + '"]');
            elements.forEach(function(el) {
              if (el && el.style.display !== 'none') {
                el.style.setProperty('display', 'none', 'important');
                hiddenCount++;
              }
            });
          } catch (e) {}
        });
        
        window.ReactNativeWebView?.postMessage(JSON.stringify({
          type: 'SHIELD_RESULT',
          hiddenCount: hiddenCount
        }));
        
        return hiddenCount;
      })();
      true;
    `;

    injectScript(script);
    
    // Return estimated count (actual count comes via message)
    return selectors.length;
  }

  /**
   * Get JavaScript to block specific element by coordinates
   */
  getBlockByCoordinatesScript(x: number, y: number): string {
    return `
      (function() {
        const element = document.elementFromPoint(${x}, ${y});
        if (element) {
          element.style.setProperty('display', 'none', 'important');
          element.setAttribute('data-access-hidden', 'true');
          window.ReactNativeWebView?.postMessage(JSON.stringify({
            type: 'ELEMENT_BLOCKED',
            tagName: element.tagName,
            className: element.className
          }));
        }
      })();
      true;
    `;
  }

  /**
   * Restore all hidden elements
   */
  getRestoreScript(): string {
    return `
      (function() {
        const elements = document.querySelectorAll('[data-access-hidden="true"]');
        elements.forEach(function(el) {
          el.style.removeProperty('display');
          el.style.removeProperty('visibility');
          el.style.removeProperty('opacity');
          el.style.removeProperty('pointer-events');
          el.removeAttribute('data-access-hidden');
        });
        window.ReactNativeWebView?.postMessage(JSON.stringify({
          type: 'SHIELD_RESTORED',
          count: elements.length
        }));
      })();
      true;
    `;
  }
}

// Singleton instance
export const visionShieldService = new VisionShieldService();
