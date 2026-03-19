/**
 * Startup Optimizer Service
 * Batches all AsyncStorage reads into a single operation on app launch
 * Reduces startup time by minimizing storage I/O operations
 */

import { Platform, InteractionManager } from 'react-native';
import { prefetchQuickAccessDNS, prefetchDomainForUrl } from './DNSPrefetchService';
import { webViewPrewarmer } from './WebViewPrewarmer';

// Safe AsyncStorage import
let AsyncStorage: any = null;
try {
  AsyncStorage = require('@react-native-async-storage/async-storage').default;
} catch (e) {
  console.log('AsyncStorage not available for StartupOptimizer');
}

// All storage keys that need to be loaded on startup
const STARTUP_STORAGE_KEYS = [
  'browser-state',
  '@access_browser_settings',
  '@aura_ads_blocked_count',
  '@aura_trackers_blocked_count',
  '@aura_downloads_list',
] as const;

export interface StartupData {
  browserState: any | null;
  settings: any | null;
  adsBlockedCount: number;
  trackersBlockedCount: number;
  downloadsList: any[] | null;
}

class StartupOptimizerService {
  private startupData: StartupData | null = null;
  private isLoading = false;
  private loadPromise: Promise<StartupData> | null = null;

  /**
   * Batch load all startup data in a single operation
   * This is much faster than multiple individual reads
   */
  async loadAllStartupData(): Promise<StartupData> {
    // Return cached data if already loaded
    if (this.startupData) {
      return this.startupData;
    }

    // Return existing promise if already loading
    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.isLoading = true;
    const startTime = Date.now();

    this.loadPromise = (async () => {
      try {
        console.log('[StartupOptimizer] Batch loading startup data...');

        let results: [string | null, string | null, string | null, string | null, string | null] = [null, null, null, null, null];

        if (AsyncStorage) {
          // Use multiGet for batch read - much faster than individual reads
          const pairs = await AsyncStorage.multiGet(STARTUP_STORAGE_KEYS);
          results = pairs.map((pair: [string, string | null]) => pair[1]);
        }

        // Parse all data
        const data: StartupData = {
          browserState: results[0] ? JSON.parse(results[0]) : null,
          settings: results[1] ? JSON.parse(results[1]) : null,
          adsBlockedCount: results[2] ? parseInt(results[2], 10) || 0 : 0,
          trackersBlockedCount: results[3] ? parseInt(results[3], 10) || 0 : 0,
          downloadsList: results[4] ? JSON.parse(results[4]) : null,
        };

        this.startupData = data;
        this.isLoading = false;

        console.log(`[StartupOptimizer] Batch load complete in ${Date.now() - startTime}ms`);
        return data;
      } catch (error) {
        console.log('[StartupOptimizer] Batch load failed:', error);
        this.isLoading = false;
        
        // Return empty defaults on error
        const defaults: StartupData = {
          browserState: null,
          settings: null,
          adsBlockedCount: 0,
          trackersBlockedCount: 0,
          downloadsList: null,
        };
        this.startupData = defaults;
        return defaults;
      }
    })();

    return this.loadPromise;
  }

  /**
   * Run all startup optimizations in parallel
   * This is called once on app launch
   */
  async runStartupOptimizations(): Promise<void> {
    try {
      const startTime = Date.now();
      console.log('[StartupOptimizer] Running startup optimizations...');

      // Run all optimizations in parallel
      await Promise.all([
        // 1. Pre-warm WebView engine
        webViewPrewarmer.prewarm().catch(e => console.warn('[StartupOptimizer] Prewarm failed:', e)),
        
        // 2. Batch load all startup data
        this.loadAllStartupData(),
        
        // 3. DNS prefetch for Quick Access sites
        new Promise<void>((resolve) => {
          try { prefetchQuickAccessDNS(); } catch (e) { console.warn('[StartupOptimizer] DNS prefetch failed:', e); }
          resolve();
        }),
      ]);

      console.log(`[StartupOptimizer] All optimizations complete in ${Date.now() - startTime}ms`);
    } catch (error) {
      console.error('[StartupOptimizer] Startup optimizations error:', error);
    }
  }

  /**
   * Get cached startup data (non-async)
   */
  getCachedData(): StartupData | null {
    return this.startupData;
  }

  /**
   * Check if startup data is loaded
   */
  isDataLoaded(): boolean {
    return this.startupData !== null;
  }
}

export const startupOptimizer = new StartupOptimizerService();
