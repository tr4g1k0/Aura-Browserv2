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
import { BrowserStatusBar } from '../src/components/StatusBar';
import { NavigationBar } from '../src/components/NavigationBar';
import { AmbientAlerts } from '../src/components/AmbientAlerts';
import { AccessibilityModal } from '../src/components/AccessibilityModal';
import { LiveCaptionsOverlay } from '../src/components/LiveCaptionsOverlay';
import { shouldBlockRequest, getAdBlockCSS, visionAIScannerPlaceholder } from '../src/utils/adblock';
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

  const [accessibilityModalVisible, setAccessibilityModalVisible] = useState(false);
  const [liveCaptionsVisible, setLiveCaptionsVisible] = useState(false);
  const [adBlockCSS, setAdBlockCSS] = useState('');

  const activeTab = tabs.find((t) => t.isActive) || tabs[0];

  // Load persisted state on mount
  useEffect(() => {
    loadPersistedState();
    initAdBlockCSS();
  }, []);

  const initAdBlockCSS = async () => {
    const selectors = await visionAIScannerPlaceholder('');
    setAdBlockCSS(getAdBlockCSS(selectors));
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

  const handleNavigate = useCallback((url: string) => {
    if (activeTab) {
      updateTab(activeTab.id, { url });
    }
  }, [activeTab, updateTab]);

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

  const handleShouldStartLoad = useCallback((event: any): boolean => {
    const { url } = event;
    
    // Ad blocking
    if (settings.adblockEnabled && shouldBlockRequest(url)) {
      console.log('Blocked:', url);
      return false;
    }
    
    return true;
  }, [settings.adblockEnabled]);

  const handleLoadEnd = useCallback(() => {
    setLoading(false);
    
    // Inject ad-block CSS if enabled
    if (settings.adblockEnabled && adBlockCSS) {
      webViewRef.current?.injectJavaScript(`
        (function() {
          var style = document.createElement('style');
          style.textContent = \`${adBlockCSS}\`;
          document.head.appendChild(style);
        })();
        true;
      `);
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
  }, [settings.adblockEnabled, settings.predictiveCachingEnabled, adBlockCSS]);

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

  // VPN status indicator injection (MOCK)
  const vpnScript = settings.vpnEnabled ? `
    (function() {
      console.log('[VPN] Secure connection active');
      // Placeholder: In production, this would configure proxy settings
    })();
    true;
  ` : '';

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
                  <Ionicons name="shield-checkmark" size={20} color="#00FF88" />
                  <Text style={styles.featureText}>Ad Blocking & Privacy</Text>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons name="globe" size={20} color="#00AAFF" />
                  <Text style={styles.featureText}>VPN Protection</Text>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons name="text" size={20} color="#FFB800" />
                  <Text style={styles.featureText}>Live Captioning</Text>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons name="sparkles" size={20} color="#A78BFA" />
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
            injectedJavaScript={vpnScript}
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
    fontSize: 28,
    fontWeight: '700',
    color: '#FFF',
    marginTop: 16,
    marginBottom: 12,
  },
  webFallbackText: {
    fontSize: 16,
    color: '#AAA',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 8,
  },
  webFallbackSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
  },
  featureList: {
    width: '100%',
    gap: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 12,
  },
  featureText: {
    fontSize: 14,
    color: '#FFF',
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
