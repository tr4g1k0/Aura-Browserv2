import { useState, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Tab } from '../store/browserStore';
import { parseUrlInput } from '../utils/urlParser';
import { predictiveCacheService, CachedPage } from '../services/PredictiveCacheService';

interface NavigationDeps {
  activeTab: Tab | undefined;
  updateTab: (id: string, updates: Partial<Tab>) => void;
  userSettings: { defaultSearchEngine?: string; [key: string]: any };
  settings: { predictiveCachingEnabled?: boolean; [key: string]: any };
  showBar: () => void;
  addToHistory: (url: string, title: string) => void;
  setLoading: (loading: boolean) => void;
}

export function useBrowserNavigation(deps: NavigationDeps) {
  const { activeTab, updateTab, userSettings, settings, showBar, addToHistory, setLoading } = deps;

  const [cachedPageSource, setCachedPageSource] = useState<CachedPage | null>(null);
  const [isCacheHit, setIsCacheHit] = useState(false);
  const [isReaderModeActive_nav, setIsReaderModeActive_nav] = useState(false);

  const lastNavigationTimeRef = useRef<number>(0);
  const previousUrlRef = useRef<string>('');

  const memoryCleanupScript = `
    (function() {
      try {
        document.querySelectorAll('video').forEach(v => {
          try { v.pause(); v.src = ''; v.load(); } catch(e) {}
        });
        document.querySelectorAll('source').forEach(s => s.remove());
        if (window.gc) { window.gc(); }
        console.log('[Memory Cleanup] Video buffers flushed');
      } catch(e) {}
    })();
    true;
  `;

  const handleGoHome = useCallback(() => {
    if (activeTab) {
      updateTab(activeTab.id, { url: '', title: 'New Tab' });
      showBar();
      console.log('[Browser] Navigated to home');
    }
  }, [activeTab, updateTab, showBar]);

  const handleNavigate = useCallback((input: string) => {
    if (!input.trim()) return;
    
    const now = Date.now();
    const elapsed = now - lastNavigationTimeRef.current;
    if (elapsed < 500) {
      console.log(`[Browser] Navigation throttled (${elapsed}ms < 500ms)`);
      return;
    }
    lastNavigationTimeRef.current = now;
    
    const parsedUrl = parseUrlInput(input, userSettings.defaultSearchEngine as any);
    
    if (parsedUrl && activeTab) {
      console.log(`[Browser] Navigating to: ${parsedUrl}`);
      
      if (settings.predictiveCachingEnabled) {
        const cached = predictiveCacheService.get(parsedUrl);
        
        if (cached) {
          console.log(`[Zero-Load] CACHE HIT! Instant loading: ${parsedUrl}`);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          
          setCachedPageSource(cached);
          setIsCacheHit(true);
          
          updateTab(activeTab.id, { 
            url: parsedUrl,
            title: 'Loading...',
          });
          return;
        } else {
          console.log(`[Zero-Load] Cache miss, fetching: ${parsedUrl}`);
        }
      }
      
      setCachedPageSource(null);
      setIsCacheHit(false);
      
      updateTab(activeTab.id, { url: parsedUrl });
    }
  }, [activeTab, updateTab, userSettings.defaultSearchEngine, settings.predictiveCachingEnabled]);

  const handleNavigationStateChange = useCallback((navState: any, webViewRef: any) => {
    if (activeTab) {
      const prevUrl = previousUrlRef.current;
      const isLeavingVideoPage = prevUrl && (
        prevUrl.includes('youtube.com/shorts') ||
        prevUrl.includes('youtube.com/watch') ||
        prevUrl.includes('tiktok.com') ||
        prevUrl.includes('/reels') ||
        prevUrl.includes('/shorts')
      );
      
      const isEnteringVideoPage = navState.url && (
        navState.url.includes('youtube.com/shorts') ||
        navState.url.includes('youtube.com/watch') ||
        navState.url.includes('tiktok.com') ||
        navState.url.includes('/reels') ||
        navState.url.includes('/shorts')
      );
      
      if (isLeavingVideoPage && !isEnteringVideoPage && !navState.loading) {
        console.log('[Memory Cleanup] Leaving video page, flushing buffers...');
        webViewRef.current?.injectJavaScript(memoryCleanupScript);
      }
      
      previousUrlRef.current = navState.url || '';
      
      updateTab(activeTab.id, {
        url: navState.url,
        title: navState.title || 'Loading...',
        canGoBack: navState.canGoBack,
        canGoForward: navState.canGoForward,
      });
      
      if (!navState.loading && navState.url && navState.title) {
        addToHistory(navState.url, navState.title);
      }
    }
    setLoading(navState.loading || false);
  }, [activeTab, updateTab, addToHistory, setLoading, memoryCleanupScript]);

  return {
    cachedPageSource,
    setCachedPageSource,
    isCacheHit,
    setIsCacheHit,
    handleGoHome,
    handleNavigate,
    handleNavigationStateChange,
  };
}
