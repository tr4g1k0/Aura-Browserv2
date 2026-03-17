import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Platform,
  BackHandler,
  Text,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useBrowserStore } from '../src/store/browserStore';
import { useSettings } from '../src/context/SettingsContext';
import { UnifiedTopBar } from '../src/components/UnifiedTopBar';
import { NewTabPage } from '../src/components/NewTabPage';
import { SwipeNavigationWrapper } from '../src/components/SwipeNavigationWrapper';
import { AmbientAlerts } from '../src/components/AmbientAlerts';
import { AccessibilityModal } from '../src/components/AccessibilityModal';
import { LiveCaptionsOverlay } from '../src/components/LiveCaptionsOverlay';
import { 
  isAdOrTracker, 
  adBusterScript, 
  createAdBusterScript,
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

export default function BrowserScreen() {
  const router = useRouter();
  const webViewRef = useRef<WebView>(null);
  const {
    tabs,
    settings,
    updateTab,
    setLoading,
    loadPersistedState,
    addCachedPage,
  } = useBrowserStore();

  // Access user settings for search engine preference
  const { settings: userSettings } = useSettings();

  const [accessibilityModalVisible, setAccessibilityModalVisible] = useState(false);
  const [liveCaptionsVisible, setLiveCaptionsVisible] = useState(false);
  const [visionAISelectors, setVisionAISelectors] = useState<string[]>([]);
  const [adsBlocked, setAdsBlocked] = useState(0);
  
  // Zero-Load Predictive Caching state
  const [cachedPageSource, setCachedPageSource] = useState<CachedPage | null>(null);
  const [isCacheHit, setIsCacheHit] = useState(false);

  const activeTab = tabs.find((t) => t.isActive) || tabs[0];

  // Check if we should show the New Tab Page
  const isNewTabPage = !activeTab?.url || 
                       activeTab.url === 'about:blank' || 
                       activeTab.url === 'about:newtab' ||
                       activeTab.url === '' ||
                       activeTab.url === 'https://www.google.com';

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
    }
    setLoading(navState.loading || false);
  }, [activeTab, updateTab, setLoading]);

  /**
   * Layer 1: Network Interception
   * Blocks ad/tracker requests at the network level before content loads
   * Respects the 'Aggressive Ad & Tracker Blocking' setting from useBrowserSettings
   */
  const handleShouldStartLoad = useCallback((event: any): boolean => {
    const { url } = event;
    
    // Check if Aggressive Ad Blocking is enabled in user settings
    if (userSettings.aggressiveAdBlocking && isAdOrTracker(url)) {
      console.log('[Smart Shield] Blocked:', url);
      recordBlockedRequest(url);
      setAdsBlocked(prev => prev + 1);
      return false;
    }
    
    return true;
  }, [userSettings.aggressiveAdBlocking]);

  /**
   * Layer 2: DOM Injection
   * Injects the adBusterScript to hide ad elements via CSS
   * Also handles predictive caching and link extraction
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
  }, [userSettings.aggressiveAdBlocking, settings.predictiveCachingEnabled, visionAISelectors, cachedPageSource]);

  const handleMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
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
    } catch (e) {
      // Ignore non-JSON messages
    }
  }, [addCachedPage]);

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
   * Includes Smart Shield ad-buster (Layer 2) and VPN indicator
   * 
   * ARCHITECTURE NOTE: This is the injection pipeline that will be extended
   * when ONNX Vision VLM is integrated. The Vision model will dynamically
   * identify coordinates of sponsored content and add custom selectors here.
   */
  const getInjectedScript = useCallback(() => {
    let scripts = '';
    
    // Add Smart Shield ad-buster script if enabled
    if (userSettings.aggressiveAdBlocking) {
      scripts += visionAISelectors.length > 0 
        ? createAdBusterScript(visionAISelectors)
        : adBusterScript;
    }
    
    // Add VPN indicator script
    scripts += vpnScript;
    
    return scripts || 'true;';
  }, [userSettings.aggressiveAdBlocking, visionAISelectors, vpnScript]);

  return (
    <View style={styles.container}>
      {/* Unified Top Bar - Single sleek row with all controls */}
      <UnifiedTopBar
        onNavigate={handleNavigate}
        onTabsPress={openTabsManager}
        onSettingsPress={openSettings}
        onAccessibilityPress={() => setAccessibilityModalVisible(true)}
        currentUrl={activeTab?.url || ''}
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
            <WebView
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
              mediaPlaybackRequiresUserAction={false}
              pullToRefreshEnabled
              cacheEnabled
              incognito={settings.vpnEnabled} // Enhanced privacy when VPN is on
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
      </View>

      {/* Chrome-style Navigation Bar - position based on settings */}
      <AccessibilityModal
        visible={accessibilityModalVisible}
        onClose={() => setAccessibilityModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0D',
  },
  webviewContainer: {
    flex: 1,
    position: 'relative',
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
});
