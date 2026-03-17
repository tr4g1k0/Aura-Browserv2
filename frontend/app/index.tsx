import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Platform,
  BackHandler,
  Text,
  ScrollView,
  RefreshControl,
  Share,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
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
import * as Haptics from 'expo-haptics';

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

export default function BrowserScreen() {
  const router = useRouter();
  const webViewRef = useRef<WebView>(null);
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
  const [isRefreshing, setIsRefreshing] = useState(false);
  
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

  const handleNavigationStateChange = useCallback((navState: WebViewNavigation) => {
    if (activeTab) {
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
    if (settings.predictiveCachingEnabled) {
      // Cache current page content
      webViewRef.current?.injectJavaScript(`
        (function() {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'PAGE_CONTENT',
            html: document.documentElement.outerHTML,
            url: window.location.href
          }));
        })();
        true;
      `);
      
      // Extract prominent links for predictive prefetching
      webViewRef.current?.injectJavaScript(linkExtractionScript);
    }
  }, [userSettings.aggressiveAdBlocking, settings.predictiveCachingEnabled, visionAISelectors, cachedPageSource, activeTab?.scrollY]);

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
      
      // Handle TTS content extraction response
      if (data.type === 'TTS_CONTENT' && data.content) {
        console.log(`[TTS] Received content from ${data.source}: ${data.length} chars`);
        handleTTSContent(data.content);
      }
      
      // Handle TTS extraction error
      if (data.type === 'TTS_ERROR') {
        console.error('[TTS] Content extraction error:', data.error);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (e) {
      // Ignore non-JSON messages
    }
  }, [addCachedPage]);

  /**
   * Handle TTS content - speak the extracted text
   * Uses the ttsRate from the store for pace control
   */
  const handleTTSContent = useCallback((content: string) => {
    if (!content || content.trim().length === 0) {
      console.log('[TTS] No content to read');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    setIsReading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Get current TTS rate from store
    const currentRate = useBrowserStore.getState().ttsRate;
    console.log(`[TTS] Starting with rate: ${currentRate}x`);

    ttsService.speak(content, {
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
   * Share current page
   */
  const handleShare = useCallback(async () => {
    if (!activeTab?.url) return;
    
    try {
      await Share.share({
        message: `${activeTab.title}\n${activeTab.url}`,
        url: activeTab.url,
        title: activeTab.title,
      });
    } catch (error) {
      console.error('[Share] Error:', error);
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

  // Pull-to-refresh handler with haptic feedback
  const handleRefresh = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsRefreshing(true);
    webViewRef.current?.reload();
    // The refresh spinner will be hidden when onLoadEnd is called
  }, []);

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
   * Includes Smart Shield ad-buster (Layer 2), VPN indicator, and Performance Optimization (Layer 3)
   * 
   * ARCHITECTURE NOTE: This is the injection pipeline that will be extended
   * when ONNX Vision VLM is integrated. The Vision model will dynamically
   * identify coordinates of sponsored content and add custom selectors here.
   * 
   * Performance Optimization includes:
   * - Lazy loading all images and iframes
   * - Killing auto-play on all videos
   * - MutationObserver for dynamically loaded content
   */
  const getInjectedScript = useCallback(() => {
    let scripts = '';
    
    // Add Smart Shield ad-buster script if enabled
    if (userSettings.aggressiveAdBlocking) {
      scripts += visionAISelectors.length > 0 
        ? createAdBusterScript(visionAISelectors)
        : adBusterScript;
    }
    
    // Always add performance optimization script (lazy loading, auto-play killing)
    // This is beneficial for all users regardless of ad blocking setting
    scripts += performanceOptimizationScript;
    
    // Add VPN indicator script
    scripts += vpnScript;
    
    return scripts || 'true;';
  }, [userSettings.aggressiveAdBlocking, visionAISelectors, vpnScript]);

  return (
    <View style={[
      styles.container, 
      // Address Bar Position: Use column-reverse when position is 'bottom'
      userSettings.addressBarPosition === 'bottom' && styles.containerBottomBar
    ]}>
      {/* Unified Top Bar - Single sleek row with all controls */}
      <UnifiedTopBar
        onNavigate={handleNavigate}
        onTabsPress={openTabsManager}
        onSettingsPress={() => setMenuVisible(true)}
        onAccessibilityPress={() => setAccessibilityModalVisible(true)}
        onLibraryPress={() => setLibraryVisible(true)}
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
        isReading={isReading}
        isGhostMode={isGhostMode}
        isDesktopMode={activeTab?.isDesktopMode ?? false}
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
            <ScrollView
              style={styles.webviewScrollView}
              contentContainerStyle={styles.webviewScrollContent}
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={handleRefresh}
                  tintColor="#00FF88"                    // iOS spinner color (Neon Green)
                  colors={['#00FF88', '#00E5FF']}        // Android spinner colors
                  progressBackgroundColor="#1A1A1A"      // Android spinner background
                  title="Refreshing..."                  // iOS refresh text
                  titleColor="#00FF88"                   // iOS refresh text color
                />
              }
            >
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
                onLoadEnd={(event) => {
                  handleLoadEnd(event);
                  setIsRefreshing(false); // Stop refresh spinner
                }}
                onMessage={handleMessage}
                injectedJavaScript={getInjectedScript()}
                javaScriptEnabled
                domStorageEnabled
                startInLoadingState
                allowsBackForwardNavigationGestures
                allowsInlineMediaPlayback
                // MEDIA PLAYBACK POLICY: Require user action to prevent background video preloading
                // This stops the browser from "thinking" about multiple videos at once
                mediaPlaybackRequiresUserAction={true}
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
                // Clean UI settings
                setBuiltInZoomControls={false}   // Hide Android zoom controls
                setDisplayZoomControls={false}   // Ensure zoom controls are hidden
                scalesPageToFit={true}
                // SETTINGS-DRIVEN PROPS (observed from global settings)
                cacheEnabled={!isGhostMode && !userSettings.doNotTrack}
                incognito={isGhostMode || userSettings.alwaysOnVPN}
                // Desktop Mode: Use desktop user agent if enabled (per-tab or global default)
                userAgent={activeTab?.isDesktopMode || userSettings.requestDesktopSite ? DESKTOP_USER_AGENT : undefined}
                // HARDWARE ACCELERATION - Force GPU rendering for video frames
                // Critical for smooth YouTube Shorts / TikTok-style scrolling
                androidHardwareAccelerationDisabled={false}
                androidLayerType="hardware"
                // iOS: Native smooth scrolling deceleration
                decelerationRate={Platform.OS === 'ios' ? 'normal' : 0.998}
                // iOS: Bounces at scroll edges for native feel
                bounces={true}
                // Optimize rendering performance
                renderToHardwareTextureAndroid={true}
                // Reduce memory usage by removing offscreen views
                removeClippedSubviews={true}
                // Allow mixed content for better compatibility
                mixedContentMode="compatibility"
                // Reduce memory footprint
                cacheMode="LOAD_DEFAULT"
                // Ensure smooth scrolling
                overScrollMode="never"
              />
            </ScrollView>
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
  },
  webview: {
    flex: 1,
    backgroundColor: '#0D0D0D',
  },
  webviewScrollView: {
    flex: 1,
  },
  webviewScrollContent: {
    flex: 1,
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
});
