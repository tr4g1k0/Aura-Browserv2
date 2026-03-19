import React, { useRef, useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  BackHandler,
  Share,
  Animated,
  Easing,
  KeyboardAvoidingView,
  TouchableOpacity,
  Alert,
  InteractionManager,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBrowserStore } from '../src/store/browserStore';
import { useSettings } from '../src/context/SettingsContext';
import { usePrivacy } from '../src/context/PrivacyContext';
import { useAmbientAwareness } from '../src/hooks/useAmbientAwareness';

// Extracted hooks
import { useAutoHideBar } from '../src/hooks/useAutoHideBar';
import { useReaderMode } from '../src/hooks/useReaderMode';
import { useFindInPage } from '../src/hooks/useFindInPage';
import { useDownloads } from '../src/hooks/useDownloads';
import { useAISummarize } from '../src/hooks/useAISummarize';
import { useBrowserNavigation } from '../src/hooks/useBrowserNavigation';
import { useWebViewEngine } from '../src/hooks/useWebViewEngine';

// Performance: Lazy-load heavy overlay components (not visible on initial render)
const BrowserMenu = React.lazy(() => import('../src/components/BrowserMenu').then(m => ({ default: m.BrowserMenu })));
const AISummarizerDrawer = React.lazy(() => import('../src/components/AISummarizerDrawer').then(m => ({ default: m.AISummarizerDrawer })));
const AccessibilityModal = React.lazy(() => import('../src/components/AccessibilityModal').then(m => ({ default: m.AccessibilityModal })));
const DownloadsModal = React.lazy(() => import('../src/components/DownloadsModal').then(m => ({ default: m.DownloadsModal })));
const LiveCaptionsOverlay = React.lazy(() => import('../src/components/LiveCaptionsOverlay').then(m => ({ default: m.LiveCaptionsOverlay })));
const QuickConverseView = React.lazy(() => import('../src/components/QuickConverseView').then(m => ({ default: m.QuickConverseView })));
const ImageContextMenu = React.lazy(() => import('../src/components/ImageContextMenu').then(m => ({ default: m.ImageContextMenu })));

// Direct imports for always-visible components
import { FindInPageBar } from '../src/components/FindInPageBar';
import { BotDetectionBanner } from '../src/components/BotDetectionBanner';
import { PrivacyShredderToast } from '../src/components/PrivacyShredderToast';
import { UnifiedTopBar } from '../src/components/UnifiedTopBar';
import { NewTabPage } from '../src/components/NewTabPage';
import { SwipeNavigationWrapper } from '../src/components/SwipeNavigationWrapper';
import { DownloadToast } from '../src/components/DownloadToast';
import { LibraryScreen } from './library';
import { AmbientAlerts } from '../src/components/AmbientAlerts';
import { CaptionPill } from '../src/components/CaptionPill';
import { DownloadNotificationBanner } from '../src/components/DownloadNotificationBanner';
import { AuraActionPill } from '../src/components/AuraActionPill';
import { TTSControlBar } from '../src/components/TTSControlBar';
import { ttsService, contentExtractionScript } from '../src/services/TextToSpeechService';
import { predictiveCacheService } from '../src/services/PredictiveCacheService';
import { semanticHistoryService, PageContext } from '../src/services/SemanticHistoryService';
import { ambientAwarenessService } from '../src/services/AmbientAwarenessService';
import { prefetchQuickAccessDNS } from '../src/services/DNSPrefetchService';
import { startupOptimizer } from '../src/services/StartupOptimizer';
import { tabVirtualizationService } from '../src/services/TabVirtualizationService';
import * as Haptics from 'expo-haptics';

// Conditionally import WebView only on native platforms
let WebView: any = null;
if (Platform.OS !== 'web') {
  const WebViewModule = require('react-native-webview');
  WebView = WebViewModule.WebView;
}

const DESKTOP_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const MOBILE_USER_AGENT = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

export default function BrowserScreen() {
  const router = useRouter();
  const webViewRef = useRef<any>(null);
  const insets = useSafeAreaInsets();
  const { incrementAds, incrementTrackers } = usePrivacy();
  const { settings: userSettings } = useSettings();

  const {
    tabs, ghostTabs, isGhostMode, settings,
    updateTab, setLoading, loadPersistedState, addCachedPage,
    addToHistory, updateHistoryEntry, saveTabScrollPosition,
    toggleDesktopMode, toggleQuickConverse,
  } = useBrowserStore();

  const currentTabs = isGhostMode ? ghostTabs : tabs;
  const activeTab = currentTabs.find((t) => t.isActive) || currentTabs[0];

  // ── Memoized computations ──
  const isNewTabPage = useMemo(() => !activeTab?.url || activeTab.url === 'about:blank' || activeTab.url === 'about:newtab' || activeTab.url === '', [activeTab?.url]);
  const webViewKey = useMemo(() => `webview-${activeTab?.id || 'none'}-${activeTab?.isDesktopMode ? 'desktop' : 'mobile'}-${isGhostMode ? 'ghost' : 'normal'}-${userSettings.doNotTrack ? 'dnt' : 'nodnt'}`, [activeTab?.id, activeTab?.isDesktopMode, isGhostMode, userSettings.doNotTrack]);

  // ── Modal/overlay state ──
  const [menuVisible, setMenuVisible] = useState(false);
  const [libraryVisible, setLibraryVisible] = useState(false);
  const [downloadsModalVisible, setDownloadsModalVisible] = useState(false);
  const [accessibilityModalVisible, setAccessibilityModalVisible] = useState(false);
  const [liveCaptionsVisible, setLiveCaptionsVisible] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState('');
  const [isImageMenuVisible, setIsImageMenuVisible] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [isActionPillVisible, setIsActionPillVisible] = useState(false);
  const [showBotBanner, setShowBotBanner] = useState(false);
  const [isReading, setIsReading] = useState(false);

  // ── Extracted hooks ──
  const { barTranslateY, showBar, hideBar, handleScrollDirection } = useAutoHideBar();
  const { isReaderModeActive, setIsReaderModeActive, toggleReaderMode } = useReaderMode(webViewRef);
  const { isFindModeActive, findText, setFindText, findInputRef, handleOpenFindInPage, handleFindNext, handleCloseFindInPage } = useFindInPage(webViewRef);
  const { downloadToastVisible, downloadStatus, downloadFilename, downloadProgress, checkForDownload, handleFileDownload, dismissDownloadToast, handleDownloadAllLinks } = useDownloads(webViewRef);
  const { isAiDrawerVisible, aiSummaryText, isCopied, handleCopySummary, generateAISummary, handleAISummarize, handleCloseAiDrawer } = useAISummarize(webViewRef, activeTab);

  const navigation = useBrowserNavigation({
    activeTab, updateTab, userSettings, settings, showBar,
    addToHistory, setLoading,
  });

  const webViewEngine = useWebViewEngine({
    userSettings, settings, isGhostMode, activeTab,
    cachedPageSource: navigation.cachedPageSource,
    setCachedPageSource: navigation.setCachedPageSource,
    setIsCacheHit: navigation.setIsCacheHit,
    incrementAds, incrementTrackers,
    checkForDownload, handleFileDownload, setLoading, webViewRef,
  });

  // ── Ambient awareness ──
  const { isDanger } = useAmbientAwareness();
  const ambientFlashAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isDanger && settings.ambientAwarenessEnabled) {
      Animated.sequence([
        Animated.timing(ambientFlashAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
        Animated.timing(ambientFlashAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [isDanger, settings.ambientAwarenessEnabled]);

  // ── Transition animation ──
  const transitionAnim = useRef(new Animated.Value(isNewTabPage ? 0 : 1)).current;
  useEffect(() => {
    Animated.timing(transitionAnim, {
      toValue: isNewTabPage ? 0 : 1,
      duration: isNewTabPage ? 400 : 450,
      easing: isNewTabPage ? Easing.out(Easing.ease) : Easing.out(Easing.back(1.5)),
      useNativeDriver: true,
    }).start();
  }, [isNewTabPage]);

  const homeHubOpacity = transitionAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const homeHubTranslateY = transitionAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -50] });
  const browserViewOpacity = transitionAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const browserViewTranslateY = transitionAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] });

  // ── Tab virtualization: save scroll on tab switch ──
  const currentScrollYRef = useRef<number>(0);
  const previousTabIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (activeTab?.id && previousTabIdRef.current && previousTabIdRef.current !== activeTab.id) {
      saveTabScrollPosition(previousTabIdRef.current, currentScrollYRef.current);
      currentScrollYRef.current = activeTab.scrollY || 0;
    }
    previousTabIdRef.current = activeTab?.id || null;
  }, [activeTab?.id, saveTabScrollPosition]);

  // ── Init effects ──
  useEffect(() => {
    // Run all startup optimizations in parallel (WebView pre-warm, DNS prefetch, batch storage load)
    startupOptimizer.runStartupOptimizations();
    loadPersistedState();
    webViewEngine.initVisionAISelectors();
    
    // Start tab virtualization service
    tabVirtualizationService.start();
    
    return () => {
      tabVirtualizationService.stop();
    };
  }, []);

  useEffect(() => {
    if (Platform.OS === 'android') {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        if (activeTab?.canGoBack) { webViewRef.current?.goBack(); return true; }
        return false;
      });
      return () => backHandler.remove();
    }
  }, [activeTab?.canGoBack]);

  useEffect(() => {
    if (userSettings.ambientAwarenessEnabled) {
      ambientAwarenessService.start();
    } else {
      ambientAwarenessService.stop();
    }
    return () => { if (ambientAwarenessService.getIsActive()) ambientAwarenessService.stop(); };
  }, [userSettings.ambientAwarenessEnabled]);

  // ── TTS handlers ──
  const handleReadAloud = useCallback(() => {
    if (isNewTabPage) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    webViewRef.current?.injectJavaScript(contentExtractionScript);
  }, [isNewTabPage]);

  const handleStopReading = useCallback(() => {
    ttsService.stop();
    setIsReading(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleTTSContent = useCallback((content: string) => {
    try {
      if (!content || content.trim().length === 0) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); return; }
      const MAX_TTS_LENGTH = 3500;
      let safeContent = content.trim();
      if (safeContent.length > MAX_TTS_LENGTH) {
        const truncated = safeContent.substring(0, MAX_TTS_LENGTH);
        const lastSentenceEnd = Math.max(truncated.lastIndexOf('.'), truncated.lastIndexOf('!'), truncated.lastIndexOf('?'));
        safeContent = lastSentenceEnd > MAX_TTS_LENGTH - 500
          ? truncated.substring(0, lastSentenceEnd + 1) + ' Content truncated for reading.'
          : truncated + '... Content truncated for reading.';
      }
      setIsReading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const currentRate = useBrowserStore.getState().ttsRate;
      ttsService.speak(safeContent, {
        pitch: 1.0, rate: currentRate,
        onDone: () => setIsReading(false),
        onStopped: () => setIsReading(false),
        onError: () => { setIsReading(false); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); },
      });
    } catch { setIsReading(false); }
  }, []);

  // ── Share handler ──
  const handleShare = useCallback(async () => {
    if (!activeTab?.url) return;
    try {
      await Share.share({ message: `${activeTab.title}\n${activeTab.url}`, url: activeTab.url, title: activeTab.title });
    } catch { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); }
  }, [activeTab]);

  // ── Burn This Site ──
  const handleBurnSite = useCallback(() => {
    if (!webViewRef.current || !activeTab?.url) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    webViewRef.current.injectJavaScript(`
      localStorage.clear(); sessionStorage.clear();
      document.cookie.split(';').forEach(function(c) { document.cookie = c.replace(/^ +/, '').replace(/=.*/, '=;expires=' + new Date().toUTCString() + ';path=/'); });
      window.location.reload(); true;
    `);
    Alert.alert('Site Data Incinerated', 'All cookies, localStorage, and sessionStorage have been cleared.');
  }, [activeTab?.url]);

  // ── WebView message handler (dispatcher) ──
  const handleMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === 'SCROLL_POSITION') {
        currentScrollYRef.current = data.scrollY || 0;
        if (!isNewTabPage) handleScrollDirection(data.scrollY || 0);
        return;
      }
      if (data.type === 'PAGE_CONTENT') {
        addCachedPage({ url: data.url, html: data.html.substring(0, 50000), timestamp: Date.now() });
        predictiveCacheService.set(data.url, data.html, 'text/html');
      }
      if (data.type === 'PREDICTIVE_LINKS' && data.links) {
        // Enhanced predictive prefetching with smart scoring
        // Get history URLs for cross-reference (boost visited pages)
        const historyUrls = useBrowserStore.getState().history?.map(h => h.url) || [];
        predictiveCacheService.setVisitedUrls(historyUrls);
        
        // Process extracted links with full scoring
        const enhancedLinks = data.links.map((link: any) => ({
          url: link.url,
          score: link.score || 0,
          text: link.text || '',
          isAboveFold: link.isAboveFold || false,
          isMainContent: link.isMainContent || false,
          isVisited: historyUrls.some(h => h.includes(new URL(link.url).hostname)),
        }));
        
        predictiveCacheService.prefetchPredictedLinks(enhancedLinks);
      }
      if (data.type === 'AD_BLOCK_COUNT') {
        if (data.adsBlocked > 0) incrementAds(data.adsBlocked);
        if (data.trackersBlocked > 0) incrementTrackers(data.trackersBlocked);
      }
      if (data.type === 'PAGE_CONTEXT' && !isGhostMode) {
        const pageContext: PageContext = {
          url: data.url, title: data.title, metaDescription: data.metaDescription,
          bodyText: data.bodyText, timestamp: data.timestamp,
        };
        (async () => {
          try {
            const entry = await semanticHistoryService.processPageContext(pageContext);
            const hist = useBrowserStore.getState().history;
            const match = hist.find((h) => h.url === data.url && Math.abs(h.timestamp - data.timestamp) < 10000);
            if (match) updateHistoryEntry(match.timestamp, { semanticLabel: entry.semanticLabel, metaDescription: entry.metaDescription });
          } catch {}
        })();
      }
      if (data.type === 'IMAGE_LONG_PRESS' && data.src) {
        setSelectedImageUrl(data.src);
        setIsImageMenuVisible(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      if (data.type === 'TEXT_SELECTED' && data.text?.trim().length > 0) {
        setSelectedText(data.text.trim());
        setIsActionPillVisible(true);
      }
      if (data.type === 'TEXT_CLEAR') {
        setIsActionPillVisible(false);
        setSelectedText('');
      }
      if (data.type === 'BOT_DETECTED') {
        setShowBotBanner(true);
        setTimeout(() => setShowBotBanner(false), 8000);
      }
      if (data.type === 'DOWNLOAD_ALL_LINKS') {
        const urls: string[] = data.urls || [];
        if (urls.length === 0) { Alert.alert('No Downloadable Links', 'No downloadable file links found on this page.'); }
        else {
          Alert.alert('Download All Links', `Found ${urls.length} downloadable file${urls.length > 1 ? 's' : ''}. Download all?`, [
            { text: 'Cancel', style: 'cancel' },
            { text: `Download ${urls.length}`, onPress: () => urls.forEach((url: string) => handleFileDownload(url)) },
          ]);
        }
      }
      if (data.type === 'TTS_CONTENT') {
        try { if (data.content) handleTTSContent(data.content); } catch { setIsReading(false); }
      }
      if (data.type === 'TTS_ERROR') { setIsReading(false); }
    } catch {}
  }, [addCachedPage, isGhostMode, isNewTabPage, updateHistoryEntry, incrementAds, incrementTrackers, handleScrollDirection, handleFileDownload, handleTTSContent]);

  const handleWebViewMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'EXTRACTED_TEXT') { generateAISummary(data.payload); return; }
      if (data.type === 'EXTRACTION_ERROR') { return; }
    } catch {}
    handleMessage(event);
  }, [generateAISummary, handleMessage]);

  // ── Routing helpers ──
  const openTabsManager = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push('/tabs-manager'); };
  const openAIAgent = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push('/ai-agent'); };

  // ── Layout calculations ──
  // No extra padding - the bar is absolutely positioned over the webview
  const bottomBarHeight = 90;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.container}>

        {/* Find In Page Bar */}
        {isFindModeActive && (
          <FindInPageBar
            findText={findText}
            setFindText={setFindText}
            findInputRef={findInputRef}
            onFindNext={handleFindNext}
            onClose={handleCloseFindInPage}
          />
        )}

        {/* Browser Menu */}
        <BrowserMenu
          visible={menuVisible}
          onClose={() => setMenuVisible(false)}
          currentUrl={activeTab?.url ?? ''}
          currentTitle={activeTab?.title ?? ''}
          isBookmarked={activeTab ? useBrowserStore.getState().isBookmarked(activeTab.url) : false}
          isDesktopMode={activeTab?.isDesktopMode ?? false}
          isReaderMode={isReaderModeActive}
          onToggleBookmark={() => { if (activeTab) useBrowserStore.getState().toggleBookmark(activeTab.url, activeTab.title); }}
          onToggleDesktopMode={() => { toggleDesktopMode(); setTimeout(() => webViewRef.current?.reload(), 100); }}
          onToggleReaderMode={toggleReaderMode}
          onFindInPage={handleOpenFindInPage}
          onBurnSite={handleBurnSite}
          onAISummarize={() => handleAISummarize(() => setMenuVisible(false))}
          onOpenDownloads={() => setDownloadsModalVisible(true)}
          onDownloadAllLinks={handleDownloadAllLinks}
        />

        {/* AI Summarizer Drawer */}
        <AISummarizerDrawer
          visible={isAiDrawerVisible}
          summaryText={aiSummaryText}
          isCopied={isCopied}
          bottomInset={insets.bottom}
          onClose={handleCloseAiDrawer}
          onCopy={handleCopySummary}
        />

        {/* WebView Container - fills the FULL screen */}
        <View style={styles.webviewContainer}>
          {Platform.OS === 'web' || isNewTabPage ? (
            <Animated.View 
              style={{ flex: 1, opacity: homeHubOpacity, transform: [{ translateY: homeHubTranslateY }] }}
              // Performance: Rasterize animated layer on iOS for smoother animations
              shouldRasterizeIOS={true}
              renderToHardwareTextureAndroid={true}
            >
              <NewTabPage
                onNavigate={navigation.handleNavigate}
                onSearch={navigation.handleNavigate}
                onOpenMenu={() => setMenuVisible(true)}
                onAISummarize={() => handleAISummarize(() => setMenuVisible(false))}
                onAccessibility={() => setAccessibilityModalVisible(true)}
              />
            </Animated.View>
          ) : activeTab && WebView ? (
            <SwipeNavigationWrapper
              canGoBack={activeTab?.canGoBack || false}
              canGoForward={activeTab?.canGoForward || false}
              onGoBack={() => webViewRef.current?.goBack()}
              onGoForward={() => webViewRef.current?.goForward()}
              enabled={Platform.OS === 'android'}
            >
              <WebView
                key={webViewKey}
                ref={webViewRef}
                source={
                  navigation.cachedPageSource && navigation.isCacheHit
                    ? { html: navigation.cachedPageSource.html, baseUrl: navigation.cachedPageSource.baseUrl }
                    : { uri: activeTab.url }
                }
                style={styles.webview}
                onNavigationStateChange={(navState: any) => navigation.handleNavigationStateChange(navState, webViewRef)}
                onShouldStartLoadWithRequest={webViewEngine.handleShouldStartLoad}
                onLoadStart={() => {
                  setLoading(true);
                  // Notify predictive cache to pause prefetching during active page load
                  predictiveCacheService.setPageLoading(true);
                }}
                onLoadEnd={() => {
                  webViewEngine.handleLoadEnd();
                  // Resume predictive prefetching after page load completes
                  predictiveCacheService.setPageLoading(false);
                }}
                onMessage={handleWebViewMessage}
                injectedJavaScript={webViewEngine.getInjectedScript()}
                javaScriptEnabled
                domStorageEnabled
                startInLoadingState
                allowsBackForwardNavigationGestures
                allowsInlineMediaPlayback
                mediaPlaybackRequiresUserAction={!activeTab.url.includes('youtube.com') && !activeTab.url.includes('youtu.be')}
                onFileDownload={({ nativeEvent: { downloadUrl } }: any) => handleFileDownload(downloadUrl)}
                onContentProcessDidTerminate={() => webViewRef.current?.reload()}
                setBuiltInZoomControls={userSettings.forceZoom || true}
                setDisplayZoomControls={false}
                scalesPageToFit={userSettings.forceZoom || activeTab?.isDesktopMode || userSettings.requestDesktopSite}
                textZoom={100}
                cacheEnabled={!isGhostMode && !userSettings.doNotTrack}
                incognito={isGhostMode && !activeTab?.url?.includes('youtube.com')}
                userAgent={activeTab?.isDesktopMode || userSettings.requestDesktopSite ? DESKTOP_USER_AGENT : MOBILE_USER_AGENT}
                pullToRefreshEnabled={!(activeTab?.isDesktopMode || userSettings.requestDesktopSite)}
                nestedScrollEnabled={true}
                overScrollMode="never"
                showsVerticalScrollIndicator={false}
                showsHorizontalScrollIndicator={false}
                bounces={true}
                decelerationRate={Platform.OS === 'ios' ? 'normal' : 0.998}
                // === PERFORMANCE OPTIMIZATIONS ===
                // Hardware acceleration for GPU rendering (smoother scrolling, faster compositing)
                androidHardwareAccelerationDisabled={false}
                androidLayerType="hardware"
                renderToHardwareTextureAndroid={true}
                // Cache optimization: Load from cache first, then network (instant loads for visited pages)
                cacheMode={isGhostMode ? "LOAD_NO_CACHE" : "LOAD_CACHE_ELSE_NETWORK"}
                // Avoid request blocking delays with mixed content
                mixedContentMode="always"
                // Disable multi-window popups (saves memory)
                setSupportMultipleWindows={false}
                // Enable smooth scrolling
                shouldRasterizeIOS={true}
              />
            </SwipeNavigationWrapper>
          ) : null}

          {/* Overlays */}
          {navigation.isCacheHit && (
            <View style={styles.cacheHitIndicator}>
              <Ionicons name="flash" size={14} color="#00FF88" />
              <Text style={styles.cacheHitText}>Instant Load</Text>
            </View>
          )}
          <CaptionPill visible={settings.liveCaptioningEnabled} onClose={() => useBrowserStore.getState().toggleLiveCaptioning()} />
          {settings.ambientAwarenessEnabled && <Animated.View style={[styles.ambientFlashOverlay, { opacity: ambientFlashAnim, pointerEvents: 'none' }]} />}
          <LiveCaptionsOverlay visible={liveCaptionsVisible} onClose={() => setLiveCaptionsVisible(false)} />
          <AmbientAlerts />
          <BotDetectionBanner visible={showBotBanner} onClose={() => setShowBotBanner(false)} />
          <DownloadToast visible={downloadToastVisible} status={downloadStatus} filename={downloadFilename} progress={downloadProgress} onDismiss={dismissDownloadToast} />
          <DownloadsModal visible={downloadsModalVisible} onClose={() => setDownloadsModalVisible(false)} />
          <DownloadNotificationBanner downloadsModalVisible={downloadsModalVisible} onOpenDownloads={() => setDownloadsModalVisible(true)} />
          <ImageContextMenu visible={isImageMenuVisible} imageUrl={selectedImageUrl} onClose={() => setIsImageMenuVisible(false)} onDownload={handleFileDownload} />
          <AuraActionPill visible={isActionPillVisible} selectedText={selectedText} onDismiss={() => { setIsActionPillVisible(false); setSelectedText(''); }} />
          <TTSControlBar visible={isReading} onStop={handleStopReading} isGhostMode={isGhostMode} />
          {(activeTab?.isDesktopMode || userSettings.requestDesktopSite) && !isNewTabPage && Platform.OS !== 'web' && (
            <TouchableOpacity style={styles.floatingRefreshButton} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); webViewRef.current?.reload(); }} activeOpacity={0.8}>
              <Ionicons name="refresh" size={20} color="#00FFFF" />
            </TouchableOpacity>
          )}
          <PrivacyShredderToast />

          {/* Bottom Navigation Bar - absolutely positioned, overlays webview */}
          {!isNewTabPage && (
            <Animated.View 
              style={[
                styles.bottomBarWrapper,
                { paddingBottom: insets.bottom, transform: [{ translateY: barTranslateY }] },
              ]}
              // Performance: Rasterize for smoother auto-hide animations
              shouldRasterizeIOS={true}
              renderToHardwareTextureAndroid={true}
            >
              <UnifiedTopBar
                onNavigate={navigation.handleNavigate}
                onHomePress={navigation.handleGoHome}
                onTabsPress={openTabsManager}
                onSettingsPress={() => setMenuVisible(true)}
                onAccessibilityPress={() => setAccessibilityModalVisible(true)}
                onLibraryPress={() => setLibraryVisible(true)}
                onShare={handleShare}
                currentUrl={activeTab?.url || ''}
                currentTitle={activeTab?.title || ''}
              />
            </Animated.View>
          )}
        </View>

        <AccessibilityModal visible={accessibilityModalVisible} onClose={() => setAccessibilityModalVisible(false)} />
        <QuickConverseView visible={settings.quickConverseEnabled} onClose={() => toggleQuickConverse()} />
        <LibraryScreen visible={libraryVisible} onClose={() => setLibraryVisible(false)} onNavigate={(url: string) => { setLibraryVisible(false); navigation.handleNavigate(url); }} />
      </View>
    </KeyboardAvoidingView>
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
  bottomBarWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: 'rgba(13, 13, 13, 0.97)',
  },
  cacheHitIndicator: {
    position: 'absolute',
    top: 12, right: 12,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(0, 255, 136, 0.15)',
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 16, borderWidth: 1,
    borderColor: 'rgba(0, 255, 136, 0.3)',
  },
  cacheHitText: {
    fontSize: 11, fontWeight: '600', color: '#00FF88',
    marginLeft: 4, letterSpacing: 0.5,
  },
  floatingRefreshButton: {
    position: 'absolute',
    bottom: 100, right: 16,
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(13, 13, 13, 0.95)',
    borderWidth: 1, borderColor: 'rgba(0, 255, 255, 0.3)',
    alignItems: 'center', justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
      android: { elevation: 8 },
    }),
  },
  ambientFlashOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#00FFFF',
    zIndex: 9999,
  },
});
