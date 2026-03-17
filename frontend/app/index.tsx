import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Platform,
  BackHandler,
  Text,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useBrowserStore } from '../src/store/browserStore';
import { useSettings } from '../src/context/SettingsContext';
import { BrowserStatusBar } from '../src/components/StatusBar';
import { NavigationBar } from '../src/components/NavigationBar';
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

  const activeTab = tabs.find((t) => t.isActive) || tabs[0];

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
   */
  const handleNavigate = useCallback((input: string) => {
    if (!input.trim()) return;
    
    // Parse the input using user's preferred search engine
    const parsedUrl = parseUrlInput(input, userSettings.defaultSearchEngine);
    
    if (parsedUrl && activeTab) {
      console.log(`[Browser] Navigating to: ${parsedUrl}`);
      updateTab(activeTab.id, { url: parsedUrl });
    }
  }, [activeTab, updateTab, userSettings.defaultSearchEngine]);

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
   * Also handles predictive caching
   */
  const handleLoadEnd = useCallback(() => {
    setLoading(false);
    
    // Inject Smart Shield ad-buster script if ad blocking is enabled
    // This is Layer 2: DOM-based element hiding
    if (userSettings.aggressiveAdBlocking) {
      // Generate script with any additional Vision AI selectors
      const script = visionAISelectors.length > 0 
        ? createAdBusterScript(visionAISelectors)
        : adBusterScript;
      
      webViewRef.current?.injectJavaScript(script);
    }

    // Extract page content for predictive caching
    if (settings.predictiveCachingEnabled) {
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
    }
  }, [userSettings.aggressiveAdBlocking, settings.predictiveCachingEnabled, visionAISelectors]);

  const handleMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      if (data.type === 'PAGE_CONTENT') {
        // Store for predictive caching
        addCachedPage({
          url: data.url,
          html: data.html.substring(0, 50000), // Limit size
          timestamp: Date.now(),
        });
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
      <BrowserStatusBar
        onAccessibilityPress={() => setAccessibilityModalVisible(true)}
      />

      <View style={styles.webviewContainer}>
        {Platform.OS === 'web' ? (
          // Web platform: Show iframe or fallback message
          <View style={styles.webFallback}>
            <View style={styles.webFallbackContent}>
              <Ionicons name="phone-portrait-outline" size={64} color="#00FF88" />
              <Text style={styles.webFallbackTitle}>ACCESS Browser</Text>
              <Text style={styles.webFallbackText}>
                For the full browsing experience, please open this app on your mobile device using Expo Go.
              </Text>
              <Text style={styles.webFallbackSubtext}>
                The WebView component is only available on iOS and Android.
              </Text>
              
              {/* Demo UI elements for web */}
              <View style={styles.featureList}>
                <View style={styles.featureItem}>
                  <View style={styles.featureIcon}>
                    <Ionicons name="shield-checkmark" size={22} color="#00FF88" />
                  </View>
                  <Text style={styles.featureText}>Ad Blocking & Privacy</Text>
                </View>
                <View style={styles.featureItem}>
                  <View style={styles.featureIcon}>
                    <Ionicons name="globe" size={22} color="#00AAFF" />
                  </View>
                  <Text style={styles.featureText}>VPN Protection</Text>
                </View>
                <View style={styles.featureItem}>
                  <View style={styles.featureIcon}>
                    <Ionicons name="text" size={22} color="#FFB800" />
                  </View>
                  <Text style={styles.featureText}>Live Captioning</Text>
                </View>
                <View style={styles.featureItem}>
                  <View style={styles.featureIcon}>
                    <Ionicons name="sparkles" size={22} color="#A78BFA" />
                  </View>
                  <Text style={styles.featureText}>AI Agent Assistant</Text>
                </View>
              </View>
            </View>
          </View>
        ) : activeTab && WebView ? (
          <WebView
            ref={webViewRef}
            source={{ uri: activeTab.url }}
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
        ) : null}

        {/* Floating AI Agent Button */}
        <TouchableOpacity
          style={styles.aiAgentButton}
          onPress={openAIAgent}
          activeOpacity={0.8}
        >
          <Ionicons name="sparkles" size={24} color="#0D0D0D" />
        </TouchableOpacity>

        {/* Live Captions Toggle Button */}
        <TouchableOpacity
          style={[
            styles.captionsToggleButton,
            liveCaptionsVisible && styles.captionsToggleActive,
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setLiveCaptionsVisible(!liveCaptionsVisible);
          }}
          activeOpacity={0.8}
        >
          <Ionicons 
            name="text" 
            size={20} 
            color={liveCaptionsVisible ? '#0D0D0D' : '#00FF88'} 
          />
        </TouchableOpacity>

        {/* Accessibility Overlays */}
        <LiveCaptionsOverlay
          visible={liveCaptionsVisible}
          onClose={() => setLiveCaptionsVisible(false)}
        />
        <AmbientAlerts />
      </View>

      <NavigationBar
        onNavigate={handleNavigate}
        onBack={() => webViewRef.current?.goBack()}
        onForward={() => webViewRef.current?.goForward()}
        onRefresh={() => webViewRef.current?.reload()}
        onTabsPress={openTabsManager}
        onSettingsPress={openSettings}
        currentUrl={activeTab?.url || ''}
        canGoBack={activeTab?.canGoBack || false}
        canGoForward={activeTab?.canGoForward || false}
      />

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
  webFallback: {
    flex: 1,
    backgroundColor: '#0D0D0D',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  webFallbackContent: {
    alignItems: 'center',
    maxWidth: 400,
  },
  webFallbackTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFF',
    marginTop: 20,
    marginBottom: 12,
    letterSpacing: 1,
    ...Platform.select({
      ios: {
        fontFamily: 'System',
      },
      android: {
        fontFamily: 'Roboto',
      },
      web: {
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      },
    }),
  },
  webFallbackText: {
    fontSize: 16,
    fontWeight: '400',
    color: '#AAA',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 8,
    ...Platform.select({
      ios: {
        fontFamily: 'System',
      },
      android: {
        fontFamily: 'Roboto',
      },
      web: {
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      },
    }),
  },
  webFallbackSubtext: {
    fontSize: 14,
    fontWeight: '400',
    color: '#666',
    textAlign: 'center',
    marginBottom: 36,
    ...Platform.select({
      ios: {
        fontFamily: 'System',
      },
      android: {
        fontFamily: 'Roboto',
      },
      web: {
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      },
    }),
  },
  featureList: {
    width: '100%',
    gap: 14,
    paddingHorizontal: 8,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 14,
  },
  featureIcon: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#FFF',
    marginLeft: 14,
    ...Platform.select({
      ios: {
        fontFamily: 'System',
      },
      android: {
        fontFamily: 'Roboto',
      },
      web: {
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      },
    }),
  },
  aiAgentButton: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#00FF88',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#00FF88',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
      web: {},
    }),
  },
  captionsToggleButton: {
    position: 'absolute',
    right: 16,
    bottom: 88,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1A1A1A',
    borderWidth: 2,
    borderColor: '#00FF88',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captionsToggleActive: {
    backgroundColor: '#00FF88',
    borderColor: '#00FF88',
  },
});
