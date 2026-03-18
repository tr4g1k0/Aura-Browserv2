import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Platform,
  BackHandler,
  Text,
  Share,
  Animated,
  KeyboardAvoidingView,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBrowserStore, Tab } from '../src/store/browserStore';
import { useSettings } from '../src/context/SettingsContext';
import { UnifiedTopBar } from '../src/components/UnifiedTopBar';
import { NewTabPage } from '../src/components/NewTabPage';
import { SwipeNavigationWrapper } from '../src/components/SwipeNavigationWrapper';
import { DownloadToast, DownloadStatus } from '../src/components/DownloadToast';
import { BrowserMenu } from '../src/components/BrowserMenu';
import { LibraryScreen } from './library';
import { AmbientAlerts } from '../src/components/AmbientAlerts';
import { AccessibilityModal } from '../src/components/AccessibilityModal';
import { LiveCaptionsOverlay } from '../src/components/LiveCaptionsOverlay';
import { downloadManager } from '../src/services/FileDownloadManager';
import { ttsService, contentExtractionScript } from '../src/services/TextToSpeechService';
import { TTSControlBar } from '../src/components/TTSControlBar';
import { 
  isAdOrTracker, 
  adBusterScript, 
  createAdBusterScript,
  gpuLayerSquashingScript,
  performanceOptimizationScript,
  createFullOptimizationScript,
  recordBlockedRequest,
  getBlockStats,
  visionAIScannerPlaceholder 
} from '../src/utils/adblock';
import { parseUrlInput, getDisplayHostname } from '../src/utils/urlParser';
import { 
  predictiveCacheService, 
  linkExtractionScript,
  CachedPage 
} from '../src/services/PredictiveCacheService';
import { 
  pageContextExtractionScript,
  semanticHistoryService,
  PageContext 
} from '../src/services/SemanticHistoryService';
import * as Haptics from 'expo-haptics';
import { ambientAwarenessService } from '../src/services/AmbientAwarenessService';

// Conditionally import WebView only on native platforms
let WebView: any = null;
let WebViewNavigation: any = null;
if (Platform.OS !== 'web') {
  const WebViewModule = require('react-native-webview');
  WebView = WebViewModule.WebView;
  WebViewNavigation = WebViewModule.WebViewNavigation;
}

const EXPO_PUBLIC_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

// Desktop User Agent for requesting desktop sites
const DESKTOP_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Privacy Shredder Toast - Shows confirmation after data deletion
 * "Privacy Shredded. You are on a clean slate."
 */
const PrivacyShredderToast = () => {
  const { toastMessage, hideToast } = useBrowserStore();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  React.useEffect(() => {
    if (toastMessage) {
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.delay(2400),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => hideToast());
    }
  }, [toastMessage]);

  if (!toastMessage) return null;

  return (
    <Animated.View
      style={{
        position: 'absolute',
        bottom: insets.bottom + 100,
        left: 20,
        right: 20,
        backgroundColor: 'rgba(20, 20, 20, 0.95)',
        borderRadius: 16,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        opacity: fadeAnim,
        transform: [{
          translateY: fadeAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [20, 0],
          }),
        }],
        borderWidth: 1,
        borderColor: 'rgba(0, 255, 136, 0.3)',
        ...Platform.select({
          ios: {
            shadowColor: '#00FF88',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
          },
          android: {
            elevation: 8,
          },
        }),
      }}
    >
      <View style={{
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(0, 255, 136, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Ionicons name="checkmark-circle" size={24} color="#00FF88" />
      </View>
      <Text style={{
        flex: 1,
        color: '#FFF',
        fontSize: 14,
        fontWeight: '600',
        ...Platform.select({
          ios: { fontFamily: 'System' },
          android: { fontFamily: 'Roboto' },
          web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
        }),
      }}>
        {toastMessage}
      </Text>
    </Animated.View>
  );
};

export default function BrowserScreen() {
  const router = useRouter();
  const webViewRef = useRef<WebView>(null);
  
  // Safe Area Insets - ensures buttons don't overlap with system UI (status bar, home indicator)
  const insets = useSafeAreaInsets();
  
  const {
    tabs,
    ghostTabs,
    isGhostMode,
    settings,
    updateTab,
    setLoading,
    loadPersistedState,
    addCachedPage,
    addToHistory,
    updateHistoryEntry,
    saveTabScrollPosition,
    ttsRate,
    toggleDesktopMode,
    getActiveTabDesktopMode,
  } = useBrowserStore();

  // Access user settings for search engine preference and other settings
  const { settings: userSettings } = useSettings();

  // Get active tabs based on Ghost Mode
  const currentTabs = isGhostMode ? ghostTabs : tabs;

  const [accessibilityModalVisible, setAccessibilityModalVisible] = useState(false);
  const [liveCaptionsVisible, setLiveCaptionsVisible] = useState(false);
  const [visionAISelectors, setVisionAISelectors] = useState<string[]>([]);
  const [adsBlocked, setAdsBlocked] = useState(0);
  
  // Download Manager state
  const [downloadToastVisible, setDownloadToastVisible] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState<DownloadStatus>(null);
  const [downloadFilename, setDownloadFilename] = useState('');
  const [downloadProgress, setDownloadProgress] = useState(0);
  
  // Library (History & Bookmarks) modal state
  const [libraryVisible, setLibraryVisible] = useState(false);
  
  // Browser Menu (3-dot menu) state
  const [menuVisible, setMenuVisible] = useState(false);
  
  // TTS (Text-to-Speech) state
  const [isReading, setIsReading] = useState(false);
  
  // Zero-Load Predictive Caching state
  const [cachedPageSource, setCachedPageSource] = useState<CachedPage | null>(null);
  const [isCacheHit, setIsCacheHit] = useState(false);
  
  // Tab Virtualization: Track current scroll position and previous tab
  const currentScrollYRef = useRef<number>(0);
  const previousTabIdRef = useRef<string | null>(null);

  const activeTab = currentTabs.find((t) => t.isActive) || currentTabs[0];

  // Generate a unique key for the WebView to force remount when critical settings change
  // This ensures incognito mode and desktop mode take effect immediately
  const webViewKey = `webview-${activeTab?.id || 'none'}-${activeTab?.isDesktopMode ? 'desktop' : 'mobile'}-${isGhostMode ? 'ghost' : 'normal'}-${userSettings.doNotTrack ? 'dnt' : 'nodnt'}`;

  // Check if we should show the New Tab Page
  const isNewTabPage = !activeTab?.url || 
                       activeTab.url === 'about:blank' || 
                       activeTab.url === 'about:newtab' ||
                       activeTab.url === '' ||
                       activeTab.url === 'https://www.google.com';

  // Tab Virtualization: Save scroll position when switching tabs
  useEffect(() => {
    if (activeTab?.id && previousTabIdRef.current && previousTabIdRef.current !== activeTab.id) {
      // Tab has changed - save the previous tab's scroll position
      console.log(`[Tab Virtualization] Switching from ${previousTabIdRef.current} to ${activeTab.id}`);
      console.log(`[Tab Virtualization] Saving scroll position ${currentScrollYRef.current} for tab ${previousTabIdRef.current}`);
      saveTabScrollPosition(previousTabIdRef.current, currentScrollYRef.current);
      // Reset scroll ref for the new tab
      currentScrollYRef.current = activeTab.scrollY || 0;
    }
    previousTabIdRef.current = activeTab?.id || null;
  }, [activeTab?.id, saveTabScrollPosition]);

  // Load persisted state on mount
  useEffect(() => {
    loadPersistedState();
    initVisionAISelectors();
  }, []);

  // Initialize Vision AI selectors for future dynamic ad detection
  const initVisionAISelectors = async () => {
    // Placeholder for Vision AI integration
    // When ONNX model is available, this will fetch dynamic selectors
    const selectors = await visionAIScannerPlaceholder('');
    setVisionAISelectors(selectors);
  };

  // Handle Android back button
  useEffect(() => {
    if (Platform.OS === 'android') {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        if (activeTab?.canGoBack) {
          webViewRef.current?.goBack();
          return true;
        }
        return false;
      });
      return () => backHandler.remove();
    }
  }, [activeTab?.canGoBack]);

  // ============================================================================
  // AMBIENT AWARENESS ENGINE WIRING
  // Start/stop microphone listener based on user setting
  // This ensures battery is saved when the feature is disabled
  // ============================================================================
  useEffect(() => {
    if (userSettings.ambientAwarenessEnabled) {
      console.log('[Engine] Ambient Awareness ENABLED - starting microphone listener');
      ambientAwarenessService.start().then((success) => {
        if (success) {
          console.log('[Engine] Ambient Awareness service started successfully');
        } else {
          console.warn('[Engine] Ambient Awareness service failed to start (permission denied?)');
        }
      });
    } else {
      console.log('[Engine] Ambient Awareness DISABLED - stopping microphone listener');
      ambientAwarenessService.stop();
    }

    // Cleanup on unmount or setting change
    return () => {
      if (ambientAwarenessService.getIsActive()) {
        console.log('[Engine] Ambient Awareness cleanup - stopping service');
        ambientAwarenessService.stop();
      }
    };
  }, [userSettings.ambientAwarenessEnabled]);

  /**
   * Handle navigation - parse user input and navigate to URL
   * Uses the user's preferred search engine from settings
   * Implements Zero-Load instant navigation from predictive cache
   */
  const handleNavigate = useCallback((input: string) => {
    if (!input.trim()) return;
    
    // Parse the input using user's preferred search engine
    const parsedUrl = parseUrlInput(input, userSettings.defaultSearchEngine);
    
    if (parsedUrl && activeTab) {
      console.log(`[Browser] Navigating to: ${parsedUrl}`);
      
      // Zero-Load: Check if page is in predictive cache
      if (settings.predictiveCachingEnabled) {
        const cached = predictiveCacheService.get(parsedUrl);
        
        if (cached) {
          console.log(`[Zero-Load] CACHE HIT! Instant loading: ${parsedUrl}`);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          
          // Set cached page source for instant rendering
          setCachedPageSource(cached);
          setIsCacheHit(true);
          
          // Update tab with the cached URL
          updateTab(activeTab.id, { 
            url: parsedUrl,
            title: 'Loading...',
          });
          return;
        } else {
          console.log(`[Zero-Load] Cache miss, fetching: ${parsedUrl}`);
        }
      }
      
      // Clear any cached source before normal navigation
      setCachedPageSource(null);
      setIsCacheHit(false);
      
      // Normal navigation
      updateTab(activeTab.id, { url: parsedUrl });
    }
  }, [activeTab, updateTab, userSettings.defaultSearchEngine, settings.predictiveCachingEnabled]);

  // Track previous URL for memory cleanup on navigation
  const previousUrlRef = useRef<string>('');

  /**
   * Memory cleanup script for heavy video pages
   * Forces WebView to flush video buffers from memory
   */
  const memoryCleanupScript = `
    (function() {
      try {
        // Pause all videos
        document.querySelectorAll('video').forEach(v => {
          try { v.pause(); v.src = ''; v.load(); } catch(e) {}
        });
        
        // Remove video source elements
        document.querySelectorAll('source').forEach(s => s.remove());
        
        // Try to trigger garbage collection if exposed
        if (window.gc) { window.gc(); }
        
        console.log('[Memory Cleanup] Video buffers flushed');
      } catch(e) {}
    })();
    true;
  `;

  const handleNavigationStateChange = useCallback((navState: WebViewNavigation) => {
    if (activeTab) {
      // Check if navigating AWAY from a heavy video page (YouTube, TikTok, etc.)
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
      
      // Memory cleanup when leaving video pages (but not going to another video page)
      if (isLeavingVideoPage && !isEnteringVideoPage && !navState.loading) {
        console.log('[Memory Cleanup] Leaving video page, flushing buffers...');
        webViewRef.current?.injectJavaScript(memoryCleanupScript);
      }
      
      // Update previous URL reference
      previousUrlRef.current = navState.url || '';
      
      updateTab(activeTab.id, {
        url: navState.url,
        title: navState.title || 'Loading...',
        canGoBack: navState.canGoBack,
        canGoForward: navState.canGoForward,
      });
      
      // Auto-log to history when navigation completes (not loading)
      if (!navState.loading && navState.url && navState.title) {
        addToHistory(navState.url, navState.title);
      }
    }
    setLoading(navState.loading || false);
  }, [activeTab, updateTab, setLoading, addToHistory]);

  /**
   * Check if URL should trigger a download (for Android interception)
   */
  const checkForDownload = useCallback((url: string): boolean => {
    return downloadManager.isDownloadableUrl(url);
  }, []);

  /**
   * File Download Handler
   * Intercepts download URLs and uses FileDownloadManager to save and share files
   */
  const handleFileDownload = useCallback(async (downloadUrl: string) => {
    console.log('[Browser] Download intercepted:', downloadUrl);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Only proceed on native platforms (file system not available on web)
    if (Platform.OS === 'web') {
      console.log('[Browser] Downloads not supported on web');
      return false;
    }

    // Show download toast
    setDownloadToastVisible(true);
    setDownloadStatus('downloading');
    setDownloadProgress(0);

    // Download and share the file
    await downloadManager.downloadAndShare(downloadUrl, (status, progress, filename, error) => {
      if (filename) {
        setDownloadFilename(filename);
      }
      
      switch (status) {
        case 'starting':
          setDownloadStatus('downloading');
          setDownloadProgress(0);
          break;
        case 'downloading':
          setDownloadStatus('downloading');
          setDownloadProgress(progress || 0);
          break;
        case 'complete':
          setDownloadStatus('complete');
          setDownloadProgress(100);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          break;
        case 'error':
          setDownloadStatus('error');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          console.error('[Browser] Download error:', error);
          break;
      }
    });

    return true;
  }, []);

  /**
   * Dismiss download toast
   */
  const dismissDownloadToast = useCallback(() => {
    setDownloadToastVisible(false);
    // Reset state after animation
    setTimeout(() => {
      setDownloadStatus(null);
      setDownloadFilename('');
      setDownloadProgress(0);
    }, 300);
  }, []);

  /**
   * Layer 1: Network Interception
   * Blocks ad/tracker requests at the network level before content loads
   * Respects the 'Aggressive Ad & Tracker Blocking' setting from useBrowserSettings
   * Also intercepts download URLs on Android
   */
  const handleShouldStartLoad = useCallback((event: any): boolean => {
    const { url } = event;
    
    // Check for downloadable files (Android interception)
    if (Platform.OS === 'android' && checkForDownload(url)) {
      console.log('[Smart Shield] Download intercepted:', url);
      handleFileDownload(url);
      return false; // Prevent WebView from navigating
    }
    
    // Check if Aggressive Ad Blocking is enabled in user settings
    if (userSettings.aggressiveAdBlocking && isAdOrTracker(url)) {
      console.log('[Smart Shield] Blocked:', url);
      recordBlockedRequest(url);
      setAdsBlocked(prev => prev + 1);
      return false;
    }
    
    return true;
  }, [userSettings.aggressiveAdBlocking, checkForDownload, handleFileDownload]);

  /**
   * Layer 2: DOM Injection
   * Injects the adBusterScript to hide ad elements via CSS
   * Also handles predictive caching, link extraction, and scroll restoration
   */
  const handleLoadEnd = useCallback(() => {
    setLoading(false);
    
    // Clear any cached page source after loading completes
    if (cachedPageSource) {
      setCachedPageSource(null);
      setIsCacheHit(false);
    }
    
    // Inject Smart Shield ad-buster script if ad blocking is enabled
    // This is Layer 2: DOM-based element hiding
    if (userSettings.aggressiveAdBlocking) {
      // Generate script with any additional Vision AI selectors
      const script = visionAISelectors.length > 0 
        ? createAdBusterScript(visionAISelectors)
        : adBusterScript;
      
      webViewRef.current?.injectJavaScript(script);
    }

    // Tab Virtualization: Inject scroll tracking script
    const scrollTrackingScript = `
      (function() {
        // Report scroll position on scroll events (debounced)
        let scrollTimeout;
        const reportScroll = () => {
          clearTimeout(scrollTimeout);
          scrollTimeout = setTimeout(() => {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'SCROLL_POSITION',
              scrollY: window.scrollY || window.pageYOffset || 0
            }));
          }, 100);
        };
        
        // Listen for scroll events
        window.addEventListener('scroll', reportScroll, { passive: true });
        
        // Report initial scroll position
        reportScroll();
      })();
      true;
    `;
    webViewRef.current?.injectJavaScript(scrollTrackingScript);

    // Tab Virtualization: Restore scroll position for this tab
    const savedScrollY = activeTab?.scrollY || 0;
    if (savedScrollY > 0) {
      console.log('[Tab Virtualization] Restoring scroll position:', savedScrollY);
      const scrollRestoreScript = `
        (function() {
          // Wait for content to be ready, then scroll
          setTimeout(() => {
            window.scrollTo(0, ${savedScrollY});
            console.log('[Tab Virtualization] Scrolled to:', ${savedScrollY});
          }, 100);
        })();
        true;
      `;
      webViewRef.current?.injectJavaScript(scrollRestoreScript);
    }

    // Extract page content for predictive caching and prefetch prominent links
    // PERFORMANCE: Only run once per unique URL to avoid duplicate work
    if (settings.predictiveCachingEnabled && activeTab?.url) {
      const currentUrl = activeTab.url;
      
      // Skip if we've already processed this URL recently
      const lastProcessedUrl = (window as any).__lastProcessedUrl;
      if (lastProcessedUrl !== currentUrl) {
        (window as any).__lastProcessedUrl = currentUrl;
        
        // Extract prominent links for predictive prefetching (lightweight)
        webViewRef.current?.injectJavaScript(linkExtractionScript);
      }
    }

    /**
     * SEMANTIC TIME-MACHINE: capturePageContext
     * Wait 3 seconds (to ensure the user is staying on the page),
     * then inject JS to grab the page context for AI summarization.
     * 
     * PRIVACY GUARD: All AI History processing happens 100% locally.
     * No page content ever leaves this device.
     * 
     * PERFORMANCE: Debounced to prevent multiple timers stacking
     */
    if (!isGhostMode && userSettings.aiHistoryEnabled !== false && activeTab?.url) {
      console.log('[Engine] AI History ENABLED - scheduling page context extraction');
      
      // Clear any existing timer to prevent stacking
      if ((window as any).__semanticHistoryTimer) {
        clearTimeout((window as any).__semanticHistoryTimer);
      }
      
      // Wait 3 seconds before capturing page context
      (window as any).__semanticHistoryTimer = setTimeout(() => {
        console.log('[Semantic History] Capturing page context after 3s delay...');
        webViewRef.current?.injectJavaScript(pageContextExtractionScript);
      }, 3000);
    } else if (!isGhostMode && userSettings.aiHistoryEnabled === false) {
      console.log('[Engine] AI History DISABLED - skipping page context extraction');
    }
  }, [userSettings.aggressiveAdBlocking, userSettings.aiHistoryEnabled, settings.predictiveCachingEnabled, visionAISelectors, cachedPageSource, activeTab?.scrollY, activeTab?.url, isGhostMode]);

  const handleMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      // Tab Virtualization: Track scroll position
      if (data.type === 'SCROLL_POSITION') {
        currentScrollYRef.current = data.scrollY || 0;
        return;
      }
      
      if (data.type === 'PAGE_CONTENT') {
        // Store in browser store for legacy caching
        addCachedPage({
          url: data.url,
          html: data.html.substring(0, 50000), // Limit size
          timestamp: Date.now(),
        });
        
        // Also store in predictive cache service
        predictiveCacheService.set(data.url, data.html, 'text/html');
      }
      
      if (data.type === 'PREDICTIVE_LINKS') {
        // Prefetch the prominent links in the background
        console.log('[Zero-Load] Prefetching links:', data.links);
        predictiveCacheService.prefetchMultiple(data.links);
      }
      
      /**
       * SEMANTIC TIME-MACHINE: Handle Page Context Extraction
       * PRIVACY GUARD: All processing happens 100% locally on-device
       * No page content or semantic labels ever leave this device
       */
      if (data.type === 'PAGE_CONTEXT') {
        console.log('[Semantic History] Received page context for:', data.url);
        
        // Skip in Ghost Mode - no history tracking
        if (!isGhostMode) {
          const pageContext: PageContext = {
            url: data.url,
            title: data.title,
            metaDescription: data.metaDescription,
            bodyText: data.bodyText,
            timestamp: data.timestamp,
          };
          
          // Process in background - don't block UI
          (async () => {
            try {
              // Generate semantic label using local AI
              const semanticEntry = await semanticHistoryService.processPageContext(pageContext);
              
              console.log('[Semantic History] Generated label:', semanticEntry.semanticLabel);
              
              // Find and update the history entry with this timestamp
              const historyEntries = useBrowserStore.getState().history;
              const matchingEntry = historyEntries.find(
                (h) => h.url === data.url && Math.abs(h.timestamp - data.timestamp) < 10000
              );
              
              if (matchingEntry) {
                updateHistoryEntry(matchingEntry.timestamp, {
                  semanticLabel: semanticEntry.semanticLabel,
                  metaDescription: semanticEntry.metaDescription,
                });
              }
            } catch (error) {
              console.error('[Semantic History] Processing error:', error);
            }
          })();
        }
      }
      
      if (data.type === 'PAGE_CONTEXT_ERROR') {
        console.error('[Semantic History] Extraction error:', data.error);
      }
      
      // Handle TTS content extraction response
      // STABILITY FIX: Wrapped in try/catch to prevent crashes
      if (data.type === 'TTS_CONTENT') {
        try {
          if (data.truncated) {
            console.log(`[TTS] Content was truncated: ${data.originalLength} -> ${data.length} chars`);
          }
          console.log(`[TTS] Received content from ${data.source}: ${data.length} chars`);
          if (data.content) {
            handleTTSContent(data.content);
          } else {
            console.warn('[TTS] Received empty content');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          }
        } catch (ttsError) {
          console.error('[TTS] Error handling content:', ttsError);
          setIsReading(false);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      }
      
      // Handle TTS extraction error
      if (data.type === 'TTS_ERROR') {
        console.error('[TTS] Content extraction error:', data.error);
        setIsReading(false);  // Reset UI state
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (e) {
      // Ignore non-JSON messages
    }
  }, [addCachedPage, isGhostMode, updateHistoryEntry]);

  /**
   * Handle TTS content - speak the extracted text
   * Uses the ttsRate from the store for pace control
   * 
   * STABILITY FIX: Wrapped in try/catch to prevent crashes on large pages.
   * Text is also pre-truncated to 3500 chars as a safety measure.
   */
  const handleTTSContent = useCallback((content: string) => {
    try {
      if (!content || content.trim().length === 0) {
        console.log('[TTS] No content to read');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        return;
      }

      // STABILITY FIX: Truncate content to 3500 chars max to prevent speech engine crashes
      const MAX_TTS_LENGTH = 3500;
      let safeContent = content.trim();
      if (safeContent.length > MAX_TTS_LENGTH) {
        console.log(`[TTS] Truncating content from ${safeContent.length} to ${MAX_TTS_LENGTH} chars`);
        // Try to break at a sentence boundary
        const truncated = safeContent.substring(0, MAX_TTS_LENGTH);
        const lastSentenceEnd = Math.max(
          truncated.lastIndexOf('.'),
          truncated.lastIndexOf('!'),
          truncated.lastIndexOf('?')
        );
        if (lastSentenceEnd > MAX_TTS_LENGTH - 500) {
          safeContent = truncated.substring(0, lastSentenceEnd + 1) + ' Content truncated for reading.';
        } else {
          safeContent = truncated + '... Content truncated for reading.';
        }
      }

      setIsReading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Get current TTS rate from store
      const currentRate = useBrowserStore.getState().ttsRate;
      console.log(`[TTS] Starting with rate: ${currentRate}x, content length: ${safeContent.length}`);

      ttsService.speak(safeContent, {
        pitch: 1.0,
        rate: currentRate,  // Use rate from store
        onStart: () => {
          console.log('[TTS] Started reading');
        },
        onDone: () => {
          console.log('[TTS] Finished reading');
          setIsReading(false);
        },
        onStopped: () => {
          console.log('[TTS] Reading stopped');
          setIsReading(false);
        },
        onError: (error) => {
          console.error('[TTS] Error:', error);
          setIsReading(false);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        },
      });
    } catch (error) {
      // STABILITY FIX: Catch any unexpected errors to prevent app crash
      console.error('[TTS] Unexpected error in handleTTSContent:', error);
      setIsReading(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, []);

  /**
   * Trigger Read Page Aloud - inject content extraction script
   */
  const handleReadAloud = useCallback(() => {
    if (isNewTabPage) {
      console.log('[TTS] Cannot read New Tab page');
      return;
    }
    
    console.log('[TTS] Injecting content extraction script');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    webViewRef.current?.injectJavaScript(contentExtractionScript);
  }, [isNewTabPage]);

  /**
   * Stop TTS reading
   */
  const handleStopReading = useCallback(() => {
    console.log('[TTS] Stopping reading');
    ttsService.stop();
    setIsReading(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  /**
   * Share current page - Native share sheet with haptic feedback
   */
  const handleShare = useCallback(async () => {
    if (!activeTab?.url) return;
    
    try {
      const result = await Share.share({
        message: `${activeTab.title}\n${activeTab.url}`,
        url: activeTab.url,
        title: activeTab.title,
      });
      
      // Haptic feedback on successful share sheet open
      if (result.action === Share.sharedAction) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        console.log('[Share] Content shared successfully');
      } else if (result.action === Share.dismissedAction) {
        // Share sheet was dismissed
        console.log('[Share] Share sheet dismissed');
      }
    } catch (error) {
      console.error('[Share] Error:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [activeTab]);

  const openTabsManager = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/tabs-manager');
  };

  const openAIAgent = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/ai-agent');
  };

  const openSettings = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/settings');
  };

  // VPN status indicator injection (MOCK)
  const vpnScript = settings.vpnEnabled ? `
    (function() {
      console.log('[VPN] Secure connection active');
      // Placeholder: In production, this would configure proxy settings
    })();
    true;
  ` : '';

  /**
   * Combined injection script for WebView
   * CRITICAL ORDER: GPU Layer Squashing MUST run first!
   * 
   * Includes:
   * 1. GPU Layer Squashing (runs immediately for video perf)
   * 2. Smart Shield ad-buster (Layer 2)
   * 3. Performance Optimization (Layer 3)
   * 4. VPN indicator
   * 5. Force Enable Zoom (Chrome-like accessibility override)
   * 6. Do Not Track (DNT) header signal to JavaScript
   */
  const getInjectedScript = useCallback(() => {
    let scripts = '';
    
    // FIRST: GPU Layer Squashing - MUST run before anything else
    // Forces video elements into Compositor Layers for GPU rendering
    scripts += gpuLayerSquashingScript;
    
    // ============================================================================
    // AD-BLOCKING ENGINE WIRING
    // Only inject ad-buster script if aggressive ad-blocking is enabled
    // ============================================================================
    if (userSettings.aggressiveAdBlocking) {
      console.log('[Engine] Ad-Blocking ENABLED - injecting ad-buster script');
      scripts += visionAISelectors.length > 0 
        ? createAdBusterScript(visionAISelectors)
        : adBusterScript;
    } else {
      console.log('[Engine] Ad-Blocking DISABLED - skipping ad-buster script');
    }
    
    // Always add performance optimization script (lazy loading, auto-play killing)
    // This is beneficial for all users regardless of ad blocking setting
    scripts += performanceOptimizationScript;
    
    // Add VPN indicator script
    scripts += vpnScript;
    
    // ============================================================================
    // DO NOT TRACK (DNT) ENGINE WIRING
    // Set navigator.doNotTrack to "1" when DNT is enabled
    // This signals to JavaScript on the page that the user prefers not to be tracked
    // ============================================================================
    if (userSettings.doNotTrack) {
      console.log('[Engine] Do Not Track ENABLED - injecting DNT signal');
      scripts += `
        (function() {
          try {
            // Override navigator.doNotTrack to return "1"
            Object.defineProperty(navigator, 'doNotTrack', {
              get: function() { return '1'; },
              configurable: true
            });
            // Also set globalPrivacyControl for modern sites
            Object.defineProperty(navigator, 'globalPrivacyControl', {
              get: function() { return true; },
              configurable: true
            });
            console.log('[DNT] Do Not Track signal injected');
          } catch(e) {
            console.log('[DNT] Error setting DNT:', e);
          }
        })();
      `;
    } else {
      console.log('[Engine] Do Not Track DISABLED');
    }
    
    // FORCE ENABLE ZOOM: Chrome-like accessibility override
    // Only inject if forceZoom setting is enabled
    // Many mobile sites block pinch-to-zoom via viewport meta tag
    // This script overrides those restrictions for native zoom experience
    if (userSettings.forceZoom) {
      console.log('[Engine] Force Zoom ENABLED - injecting viewport override');
      scripts += `
        (function() {
          try {
            var meta = document.querySelector('meta[name="viewport"]');
            if (meta) {
              meta.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=10.0, user-scalable=yes');
            } else {
              // Create viewport meta if it doesn't exist
              meta = document.createElement('meta');
              meta.name = 'viewport';
              meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=10.0, user-scalable=yes';
              document.head.appendChild(meta);
            }
            console.log('[Zoom] Force enabled pinch-to-zoom');
          } catch(e) {
            console.log('[Zoom] Error enabling zoom:', e);
          }
        })();
      `;
    } else {
      console.log('[Engine] Force Zoom DISABLED');
    }
    
    return scripts || 'true;';
  }, [userSettings.aggressiveAdBlocking, userSettings.doNotTrack, userSettings.forceZoom, visionAISelectors, vpnScript]);

  // Calculate bottom padding for home indicator
  // When address bar is at bottom, we need more space for the navigation bar
  const bottomPadding = userSettings.addressBarPosition === 'bottom' 
    ? insets.bottom 
    : Math.max(insets.bottom, 8);

  // Calculate top padding for status bar
  // When address bar is at bottom, WebView appears at top and needs status bar padding
  const topPadding = userSettings.addressBarPosition === 'bottom'
    ? insets.top
    : 0;  // When bar is at top, UnifiedTopBar handles its own safe area

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <View style={[
        styles.container, 
        // Address Bar Position: Use column-reverse when position is 'bottom'
        userSettings.addressBarPosition === 'bottom' && styles.containerBottomBar,
        // Apply safe area padding to avoid system UI overlap
        { paddingBottom: bottomPadding, paddingTop: topPadding }
      ]}>
      {/* Unified Top Bar - Single sleek row with all controls */}
      <UnifiedTopBar
        onNavigate={handleNavigate}
        onTabsPress={openTabsManager}
        onSettingsPress={() => setMenuVisible(true)}
        onAccessibilityPress={() => setAccessibilityModalVisible(true)}
        onLibraryPress={() => setLibraryVisible(true)}
        onShare={handleShare}
        currentUrl={activeTab?.url || ''}
        currentTitle={activeTab?.title || ''}
      />

      {/* Browser Menu (3-dot menu) */}
      <BrowserMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        onReadAloud={handleReadAloud}
        onStopReading={handleStopReading}
        onSettings={openSettings}
        onRefresh={() => webViewRef.current?.reload()}
        onNewTab={() => {
          useBrowserStore.getState().addTab();
          setMenuVisible(false);
        }}
        onShare={handleShare}
        onToggleGhostMode={() => {
          useBrowserStore.getState().toggleGhostMode();
        }}
        onToggleDesktopMode={() => {
          toggleDesktopMode();
          // Reload page to fetch with new user agent
          setTimeout(() => {
            webViewRef.current?.reload();
          }, 100);
        }}
        onToggleBookmark={() => {
          if (activeTab) {
            useBrowserStore.getState().toggleBookmark(activeTab.url, activeTab.title);
          }
        }}
        onToggleAdblock={() => {
          useBrowserStore.getState().toggleAdblock();
        }}
        isReading={isReading}
        isGhostMode={isGhostMode}
        isDesktopMode={activeTab?.isDesktopMode ?? false}
        isBookmarked={activeTab ? useBrowserStore.getState().isBookmarked(activeTab.url) : false}
        isAdblockEnabled={useBrowserStore.getState().settings.adblockEnabled}
        adsBlocked={adsBlocked}
        currentUrl={activeTab?.url ?? ''}
        currentTitle={activeTab?.title ?? ''}
      />

      <View style={styles.webviewContainer}>
        {Platform.OS === 'web' ? (
          // Web platform: Show New Tab Page
          <NewTabPage
            onNavigate={handleNavigate}
            onSearch={handleNavigate}
          />
        ) : isNewTabPage ? (
          // Native: Show New Tab Page for blank/new tabs
          <NewTabPage
            onNavigate={handleNavigate}
            onSearch={handleNavigate}
          />
        ) : activeTab && WebView ? (
          <SwipeNavigationWrapper
            canGoBack={activeTab?.canGoBack || false}
            canGoForward={activeTab?.canGoForward || false}
            onGoBack={() => webViewRef.current?.goBack()}
            onGoForward={() => webViewRef.current?.goForward()}
            enabled={Platform.OS === 'android'}
          >
            {/* 
              NATIVE SCROLL FIX: WebView is now a direct child of View (no ScrollView wrapper)
              This preserves native scroll physics on Android/iOS.
              Pull-to-refresh is handled by the native WebView via pullToRefreshEnabled prop.
            */}
            <WebView
              key={webViewKey}
              ref={webViewRef}
              source={
                // Zero-Load: Use cached HTML if available, otherwise use URI
                cachedPageSource && isCacheHit
                  ? { html: cachedPageSource.html, baseUrl: cachedPageSource.baseUrl }
                  : { uri: activeTab.url }
              }
              style={styles.webview}
              onNavigationStateChange={handleNavigationStateChange}
              onShouldStartLoadWithRequest={handleShouldStartLoad}
              onLoadStart={() => setLoading(true)}
              onLoadEnd={handleLoadEnd}
              onMessage={handleMessage}
              injectedJavaScript={getInjectedScript()}
              javaScriptEnabled
              domStorageEnabled
              startInLoadingState
              allowsBackForwardNavigationGestures
              allowsInlineMediaPlayback
              // MEDIA PLAYBACK POLICY: 
              // - YouTube URLs: Allow auto-play for Shorts to work properly
              // - Other sites: Require user action to prevent background video preloading
              mediaPlaybackRequiresUserAction={
                !activeTab.url.includes('youtube.com') && 
                !activeTab.url.includes('youtu.be')
              }
              // iOS File Download Handler
              onFileDownload={({ nativeEvent: { downloadUrl } }) => {
                handleFileDownload(downloadUrl);
              }}
              // MEMORY LEAK PROTECTION: Auto-reload if content process crashes
              // Clears "sludge" from heavy video feeds like YouTube Shorts
              onContentProcessDidTerminate={(syntheticEvent) => {
                const { nativeEvent } = syntheticEvent;
                console.warn('[WebView] Content process terminated, reloading...', nativeEvent);
                webViewRef.current?.reload();
              }}
              // ============================================================
              // NATIVE PINCH-TO-ZOOM - Chrome-like zoom experience
              // Combined with Force Enable Zoom script for full accessibility
              // USES forceZoom SETTING FROM GLOBAL CONTEXT
              // ============================================================
              setBuiltInZoomControls={userSettings.forceZoom || true}  // Force on if forceZoom enabled
              setDisplayZoomControls={false}   // Hide the +/- zoom UI buttons
              // SMART SCALING: Scale for desktop mode OR if forceZoom is enabled
              // When forceZoom is true, we scale regardless of mode for accessibility
              scalesPageToFit={userSettings.forceZoom || activeTab?.isDesktopMode || userSettings.requestDesktopSite}
              textZoom={100}                   // Default text zoom level (100%)
              // SETTINGS-DRIVEN PROPS (observed from global settings)
              cacheEnabled={!isGhostMode && !userSettings.doNotTrack}
              // YOUTUBE FIX: Don't use strict incognito mode for YouTube
              // YouTube's video player can break in strict incognito mode
              incognito={isGhostMode && !activeTab?.url?.includes('youtube.com')}
              // Desktop Mode: Use desktop user agent if enabled (per-tab or global default)
              userAgent={activeTab?.isDesktopMode || userSettings.requestDesktopSite ? DESKTOP_USER_AGENT : undefined}
              // ============================================================
              // NATIVE SCROLL PHYSICS - No JS bridge overhead
              // WebView handles all scrolling and refresh natively
              // ============================================================
              
              // SMART PULL-TO-REFRESH: Disabled in Desktop Mode
              // Desktop DOMs swallow the gesture; use floating refresh button instead
              pullToRefreshEnabled={!(activeTab?.isDesktopMode || userSettings.requestDesktopSite)}
              
              // CRITICAL: Enable nested scrolling for smooth Android scrolling
              // Prevents parent views from stealing scroll gestures
              nestedScrollEnabled={true}
              
              // Stops Android's visual stretch effect which drops frames
              overScrollMode="never"
              
              // Hide scroll indicators for cleaner UI
              showsVerticalScrollIndicator={false}
              showsHorizontalScrollIndicator={false}
              
              // iOS: Bounces at scroll edges for native feel
              bounces={true}
              
              // iOS: Native smooth scrolling deceleration
              decelerationRate={Platform.OS === 'ios' ? 'normal' : 0.998}
              
              // HARDWARE ACCELERATION - Keep enabled but don't force hardware layer
              androidHardwareAccelerationDisabled={false}
              
              // Prevents background popups from eating RAM
              setSupportMultipleWindows={false}
              
              // Mixed content mode for video compatibility
              mixedContentMode="always"
              // Standard cache mode
              cacheMode="LOAD_DEFAULT"
            />
          </SwipeNavigationWrapper>
        ) : null}

        {/* Cache Hit Indicator - shows when page loaded from cache */}
        {isCacheHit && (
          <View style={styles.cacheHitIndicator}>
            <Ionicons name="flash" size={14} color="#00FF88" />
            <Text style={styles.cacheHitText}>Instant Load</Text>
          </View>
        )}

        {/* Accessibility Overlays */}
        <LiveCaptionsOverlay
          visible={liveCaptionsVisible}
          onClose={() => setLiveCaptionsVisible(false)}
        />
        <AmbientAlerts />

        {/* Download Toast Notification */}
        <DownloadToast
          visible={downloadToastVisible}
          status={downloadStatus}
          filename={downloadFilename}
          progress={downloadProgress}
          onDismiss={dismissDownloadToast}
        />

        {/* TTS Floating Control Bar */}
        <TTSControlBar
          visible={isReading}
          onStop={handleStopReading}
          isGhostMode={isGhostMode}
        />

        {/* Floating Refresh Button - Smart Refresh Failsafe */}
        {/* Appears when pull-to-refresh is disabled (Desktop Mode) */}
        {(activeTab?.isDesktopMode || userSettings.requestDesktopSite) && !isNewTabPage && Platform.OS !== 'web' && (
          <TouchableOpacity
            style={styles.floatingRefreshButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              webViewRef.current?.reload();
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="refresh" size={20} color="#00FFFF" />
          </TouchableOpacity>
        )}

        {/* Privacy Shredder Toast Confirmation */}
        <PrivacyShredderToast />
      </View>

      {/* Chrome-style Navigation Bar - position based on settings */}
      <AccessibilityModal
        visible={accessibilityModalVisible}
        onClose={() => setAccessibilityModalVisible(false)}
      />

      {/* Library Screen (Bookmarks & History) */}
      <LibraryScreen
        visible={libraryVisible}
        onClose={() => setLibraryVisible(false)}
        onNavigate={(url) => {
          setLibraryVisible(false);
          handleNavigate(url);
        }}
      />
    </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0D',
    flexDirection: 'column',
  },
  containerBottomBar: {
    flexDirection: 'column-reverse',
  },
  webviewContainer: {
    flex: 1,
    position: 'relative',
    // VIEWPORT SANITIZATION: Clip overflow to prevent layer stacking
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
    backgroundColor: '#0D0D0D',
  },
  // Zero-Load Cache Hit Indicator
  cacheHitIndicator: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 255, 136, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 136, 0.3)',
  },
  cacheHitText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#00FF88',
    marginLeft: 4,
    letterSpacing: 0.5,
  },
  // Floating Refresh Button - Smart Refresh Failsafe
  // Appears when pull-to-refresh is disabled (Desktop Mode)
  floatingRefreshButton: {
    position: 'absolute',
    bottom: 100,  // Above the navigation bar
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(13, 13, 13, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
});
