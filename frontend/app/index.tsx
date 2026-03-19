import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Platform,
  BackHandler,
  Text,
  Share,
  Animated,
  Easing,
  KeyboardAvoidingView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  ScrollView,
  Pressable,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
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
import { CaptionPill } from '../src/components/CaptionPill';
import { QuickConverseView } from '../src/components/QuickConverseView';
import { DownloadsModal, addDownloadToList } from '../src/components/DownloadsModal';
import { DownloadNotificationBanner } from '../src/components/DownloadNotificationBanner';
import { ImageContextMenu } from '../src/components/ImageContextMenu';
import { TextSelectionMenu } from '../src/components/TextSelectionMenu';
import { useDownloadsStore } from '../src/store/useDownloadsStore';
import { useAmbientAwareness } from '../src/hooks/useAmbientAwareness';
import { usePrivacy } from '../src/context/PrivacyContext';
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
  
  // Privacy Context - for real-time ad/tracker blocking counts
  const { incrementAds, incrementTrackers } = usePrivacy();
  
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
    toggleQuickConverse,
  } = useBrowserStore();

  // Access user settings for search engine preference and other settings
  const { settings: userSettings } = useSettings();

  // Get active tabs based on Ghost Mode
  const currentTabs = isGhostMode ? ghostTabs : tabs;

  const [accessibilityModalVisible, setAccessibilityModalVisible] = useState(false);
  const [liveCaptionsVisible, setLiveCaptionsVisible] = useState(false);
  const [visionAISelectors, setVisionAISelectors] = useState<string[]>([]);
  const [adsBlocked, setAdsBlocked] = useState(0);
  
  // Reader Mode State
  const [isReaderModeActive, setIsReaderModeActive] = useState(false);
  
  // ============================================================
  // READER MODE JAVASCRIPT INJECTION SCRIPTS
  // ============================================================
  
  // Inject this to activate Reader Mode - clean, distraction-free reading
  const READER_MODE_JS = `
    (function() {
      // Check if already active
      if (document.getElementById('aura-reader-style')) {
        return true;
      }
      
      const readerModeCSS = \`
        /* Aura Reader Mode - Clean Reading Experience */
        * {
          transition: none !important;
          animation: none !important;
        }
        
        body {
          background-color: #0A0A0F !important;
          color: #E2E8F0 !important;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
          font-size: 20px !important;
          line-height: 1.8 !important;
          padding: 24px !important;
          max-width: 720px !important;
          margin: 0 auto !important;
          min-height: 100vh !important;
        }
        
        /* Typography improvements */
        h1, h2, h3, h4, h5, h6 {
          color: #FFFFFF !important;
          line-height: 1.3 !important;
          margin-top: 1.5em !important;
          margin-bottom: 0.5em !important;
        }
        
        h1 { font-size: 2em !important; }
        h2 { font-size: 1.6em !important; }
        h3 { font-size: 1.3em !important; }
        
        p {
          margin-bottom: 1.2em !important;
          color: #CBD5E1 !important;
        }
        
        a {
          color: #00F2FF !important;
          text-decoration: none !important;
        }
        
        a:hover {
          text-decoration: underline !important;
        }
        
        /* Clean up images */
        img {
          max-width: 100% !important;
          height: auto !important;
          border-radius: 12px !important;
          margin: 1em 0 !important;
        }
        
        /* Code blocks */
        pre, code {
          background-color: #1E1E2E !important;
          color: #A6E3A1 !important;
          border-radius: 8px !important;
          padding: 0.2em 0.4em !important;
          font-size: 0.9em !important;
        }
        
        pre {
          padding: 1em !important;
          overflow-x: auto !important;
        }
        
        /* Lists */
        ul, ol {
          padding-left: 1.5em !important;
          color: #CBD5E1 !important;
        }
        
        li {
          margin-bottom: 0.5em !important;
        }
        
        /* Blockquotes */
        blockquote {
          border-left: 4px solid #00F2FF !important;
          margin: 1em 0 !important;
          padding-left: 1em !important;
          color: #94A3B8 !important;
          font-style: italic !important;
        }
        
        /* Hide all the noise */
        nav, footer, aside, iframe, 
        .ad, .ads, .advertisement, .banner,
        .sidebar, .side-bar, .menu, .navigation,
        .popup, .modal, .overlay, .cookie-banner, .cookie-notice,
        .social-share, .share-buttons, .comments, .comment-section,
        .related-posts, .recommended, .newsletter,
        header:not(article header), .header,
        .sticky, .fixed, [class*="sticky"], [class*="fixed"],
        [class*="popup"], [class*="modal"], [class*="banner"],
        [class*="cookie"], [class*="gdpr"], [class*="consent"],
        [id*="cookie"], [id*="gdpr"], [id*="consent"],
        video, audio, embed, object,
        .video-player, .audio-player {
          display: none !important;
          visibility: hidden !important;
        }
        
        /* Show main content */
        article, main, .article, .post, .content, .entry-content,
        .post-content, .article-content, .story-body {
          display: block !important;
          width: 100% !important;
          max-width: 720px !important;
          margin: 0 auto !important;
          padding: 0 !important;
        }
        
        /* Tables */
        table {
          border-collapse: collapse !important;
          width: 100% !important;
          margin: 1em 0 !important;
        }
        
        th, td {
          border: 1px solid #374151 !important;
          padding: 0.75em !important;
          text-align: left !important;
        }
        
        th {
          background-color: #1E1E2E !important;
          color: #FFFFFF !important;
        }
      \`;
      
      const styleNode = document.createElement('style');
      styleNode.innerHTML = readerModeCSS;
      styleNode.id = 'aura-reader-style';
      document.head.appendChild(styleNode);
      
      // Scroll to top for fresh reading experience
      window.scrollTo(0, 0);
      
      // Send message back to React Native
      window.ReactNativeWebView?.postMessage(JSON.stringify({
        type: 'READER_MODE_ACTIVATED'
      }));
      
      true;
    })();
  `;
  
  // Inject this to deactivate Reader Mode - restore original page
  const UNDO_READER_MODE_JS = `
    (function() {
      const styleNode = document.getElementById('aura-reader-style');
      if (styleNode) {
        styleNode.remove();
      }
      
      // Send message back to React Native
      window.ReactNativeWebView?.postMessage(JSON.stringify({
        type: 'READER_MODE_DEACTIVATED'
      }));
      
      true;
    })();
  `;
  
  /**
   * Toggle Reader Mode on the current page
   */
  const toggleReaderMode = useCallback(() => {
    if (!webViewRef.current || Platform.OS === 'web') {
      Alert.alert('Reader Mode', 'Reader Mode requires native mobile app');
      return;
    }
    
    const newState = !isReaderModeActive;
    setIsReaderModeActive(newState);
    
    // Inject the appropriate script
    const script = newState ? READER_MODE_JS : UNDO_READER_MODE_JS;
    webViewRef.current.injectJavaScript(script);
    
    console.log('[Reader Mode]', newState ? 'Activated' : 'Deactivated');
  }, [isReaderModeActive, READER_MODE_JS, UNDO_READER_MODE_JS]);

  // Ambient Awareness - sound detection hook
  const { isDanger, isWarning, currentLevel } = useAmbientAwareness();
  
  // Ambient flash effect state
  const [ambientFlash, setAmbientFlash] = useState(false);
  const ambientFlashAnim = useRef(new Animated.Value(0)).current;
  
  // Trigger ambient flash when danger detected
  useEffect(() => {
    if (isDanger && settings.ambientAwarenessEnabled) {
      setAmbientFlash(true);
      Animated.sequence([
        Animated.timing(ambientFlashAnim, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(ambientFlashAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => setAmbientFlash(false));
    }
  }, [isDanger, settings.ambientAwarenessEnabled]);
  
  // Download Manager state
  const [downloadToastVisible, setDownloadToastVisible] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState<DownloadStatus>(null);
  const [downloadFilename, setDownloadFilename] = useState('');
  const [downloadProgress, setDownloadProgress] = useState(0);
  
  // Library (History & Bookmarks) modal state
  const [libraryVisible, setLibraryVisible] = useState(false);
  
  // Browser Menu (3-dot menu) state
  const [menuVisible, setMenuVisible] = useState(false);

  // Downloads Modal state
  const [downloadsModalVisible, setDownloadsModalVisible] = useState(false);

  // Image Context Menu state
  const [selectedImageUrl, setSelectedImageUrl] = useState('');
  const [isImageMenuVisible, setIsImageMenuVisible] = useState(false);

  // Text Selection Menu state
  const [selectedText, setSelectedText] = useState('');
  const [isTextMenuVisible, setIsTextMenuVisible] = useState(false);
  
  // Find in Page state
  const [isFindModeActive, setIsFindModeActive] = useState(false);
  const [findText, setFindText] = useState('');
  const findInputRef = useRef<TextInput>(null);
  
  // AI Summarizer Drawer state
  const [isAiDrawerVisible, setIsAiDrawerVisible] = useState(false);
  const [aiSummaryText, setAiSummaryText] = useState('');
  
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
                       activeTab.url === '';

  // ============================================================
  // SLIDE & FADE TRANSITION ANIMATION
  // Smooth transition between Home Hub and Browser View
  // ============================================================
  const transitionAnim = useRef(new Animated.Value(isNewTabPage ? 0 : 1)).current;
  
  // Watch URL changes and animate the transition
  useEffect(() => {
    if (isNewTabPage) {
      // Transitioning to Home Hub
      Animated.timing(transitionAnim, {
        toValue: 0,
        duration: 400,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    } else {
      // Transitioning to Browser View
      Animated.timing(transitionAnim, {
        toValue: 1,
        duration: 450,
        easing: Easing.out(Easing.back(1.5)), // High-end bounce effect
        useNativeDriver: true,
      }).start();
    }
  }, [isNewTabPage]);

  // Interpolated animation values
  const homeHubOpacity = transitionAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });
  
  const homeHubTranslateY = transitionAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -50], // Slides up as it fades
  });
  
  const browserViewOpacity = transitionAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  
  const browserViewTranslateY = transitionAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [20, 0], // Slides up with bounce
  });

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
      
      // Reset Reader Mode when navigating to a new page
      if (isReaderModeActive) {
        setIsReaderModeActive(false);
      }
      
      // Normal navigation
      updateTab(activeTab.id, { url: parsedUrl });
    }
  }, [activeTab, updateTab, userSettings.defaultSearchEngine, settings.predictiveCachingEnabled, isReaderModeActive]);

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
   * Tracks active downloads via Zustand store for DownloadsModal + notification banner
   */
  const handleFileDownload = useCallback(async (downloadUrl: string) => {
    console.log('[Browser] Download intercepted:', downloadUrl);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Only proceed on native platforms (file system not available on web)
    if (Platform.OS === 'web') {
      console.log('[Browser] Downloads not supported on web');
      return false;
    }

    // Register in Zustand store
    const store = useDownloadsStore.getState();
    const extractedName = downloadManager.extractFilename(downloadUrl);
    const activeId = store.startDownload(downloadUrl, extractedName);

    // Show download toast
    setDownloadToastVisible(true);
    setDownloadStatus('downloading');
    setDownloadProgress(0);

    // Download and share the file
    const result = await downloadManager.downloadAndShare(downloadUrl, (status, progress, filename, error) => {
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
          useDownloadsStore.getState().updateProgress(activeId, progress || 0);
          break;
        case 'complete':
          setDownloadStatus('complete');
          setDownloadProgress(100);
          useDownloadsStore.getState().completeDownload(activeId);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          break;
        case 'error':
          setDownloadStatus('error');
          useDownloadsStore.getState().failDownload(activeId, error || 'Download failed');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          console.error('[Browser] Download error:', error);
          break;
      }
    });

    // Persist completed download to the Downloads list
    if (result.success && result.localUri && result.filename) {
      addDownloadToList(result.filename, result.localUri);
    }

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
   * Download All Links — Injects JS to scan for downloadable <a> hrefs,
   * then sequentially downloads each one.
   */
  const handleDownloadAllLinks = useCallback(() => {
    if (!webViewRef.current || Platform.OS === 'web') return;

    const scanScript = `
      (function() {
        var exts = ['.pdf','.doc','.docx','.xls','.xlsx','.ppt','.pptx','.txt','.csv','.zip','.rar','.7z','.tar','.gz','.mp3','.wav','.mp4','.mov','.avi','.jpg','.jpeg','.png','.gif','.webp','.apk'];
        var links = Array.from(document.querySelectorAll('a[href]'));
        var found = [];
        links.forEach(function(a) {
          var href = a.href || '';
          var lower = href.toLowerCase();
          for (var i = 0; i < exts.length; i++) {
            if (lower.endsWith(exts[i]) || lower.includes(exts[i] + '?')) {
              found.push(href);
              break;
            }
          }
        });
        // Deduplicate
        found = found.filter(function(v, i, a) { return a.indexOf(v) === i; });
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'DOWNLOAD_ALL_LINKS', urls: found }));
      })();
      true;
    `;
    webViewRef.current.injectJavaScript(scanScript);
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
      
      // Update Privacy Context - determine if it's a tracker or ad
      const urlLower = url.toLowerCase();
      const isTracker = urlLower.includes('track') || 
                        urlLower.includes('analytics') || 
                        urlLower.includes('pixel') ||
                        urlLower.includes('beacon') ||
                        urlLower.includes('telemetry');
      
      if (isTracker) {
        incrementTrackers(1);
      } else {
        incrementAds(1);
      }
      
      return false;
    }
    
    return true;
  }, [userSettings.aggressiveAdBlocking, checkForDownload, handleFileDownload, incrementAds, incrementTrackers]);

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

      // Handle Image Long-Press Context Menu
      if (data.type === 'IMAGE_LONG_PRESS') {
        console.log('[Browser] Image long-press:', data.src);
        if (data.src) {
          setSelectedImageUrl(data.src);
          setIsImageMenuVisible(true);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
      }

      // Handle Text Selection Long-Press Menu
      if (data.type === 'TEXT_LONG_PRESS') {
        console.log('[Browser] Text long-press:', data.text?.substring(0, 50));
        if (data.text && data.text.trim().length > 0) {
          setSelectedText(data.text.trim());
          setIsTextMenuVisible(true);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
      }
      
      // Handle "Download All Links" scan result
      if (data.type === 'DOWNLOAD_ALL_LINKS') {
        const urls: string[] = data.urls || [];
        if (urls.length === 0) {
          Alert.alert('No Downloadable Links', 'No downloadable file links found on this page.');
        } else {
          Alert.alert(
            'Download All Links',
            `Found ${urls.length} downloadable file${urls.length > 1 ? 's' : ''} on this page. Download all?`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: `Download ${urls.length}`,
                onPress: () => {
                  urls.forEach((url: string) => handleFileDownload(url));
                },
              },
            ]
          );
        }
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

  // ============================================================
  // FIND IN PAGE - Premium Feature
  // Uses window.find() JavaScript API to search and highlight text
  // ============================================================
  
  /**
   * Open Find in Page mode
   * Called from BrowserMenu "Find" button
   */
  const handleOpenFindInPage = useCallback(() => {
    console.log('[Find in Page] Opening search bar');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsFindModeActive(true);
    setFindText('');
    // Focus the input after a small delay to allow render
    setTimeout(() => {
      findInputRef.current?.focus();
    }, 100);
  }, []);

  /**
   * Execute Find in Page search
   * Uses window.find() to locate and highlight text
   */
  const handleFindNext = useCallback(() => {
    if (!findText.trim() || !webViewRef.current) {
      console.log('[Find in Page] No search text or no WebView ref');
      return;
    }
    
    console.log(`[Find in Page] Searching for: "${findText}"`);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Escape special characters in the search text for safe injection
    const escapedText = findText.replace(/[\\'"]/g, '\\$&');
    
    // window.find(searchString, caseSensitive, backwards, wrapAround)
    const findScript = `
      (function() {
        try {
          const found = window.find("${escapedText}", false, false, true);
          if (!found) {
            console.log('[Find in Page] No more matches found');
          } else {
            console.log('[Find in Page] Match found');
          }
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'FIND_RESULT',
            found: found
          }));
        } catch(e) {
          console.error('[Find in Page] Error:', e);
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'FIND_RESULT',
            found: false,
            error: e.message
          }));
        }
      })();
      true;
    `;
    
    webViewRef.current.injectJavaScript(findScript);
  }, [findText]);

  /**
   * Close Find in Page mode
   * Clears the search and removes highlighting
   */
  const handleCloseFindInPage = useCallback(() => {
    console.log('[Find in Page] Closing search bar');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsFindModeActive(false);
    setFindText('');
    
    // Clear the selection/highlight in the WebView
    if (webViewRef.current) {
      const clearScript = `
        (function() {
          try {
            // Clear the current selection
            if (window.getSelection) {
              window.getSelection().removeAllRanges();
            }
            console.log('[Find in Page] Selection cleared');
          } catch(e) {
            console.log('[Find in Page] Error clearing selection:', e);
          }
        })();
        true;
      `;
      webViewRef.current.injectJavaScript(clearScript);
    }
  }, []);

  // ============================================================
  // BURN THIS SITE - Premium Feature
  // Clears localStorage, sessionStorage, and cookies for current site
  // ============================================================
  
  /**
   * Burn This Site - Incinerate all site data
   * Clears localStorage, sessionStorage, and cookies
   */
  const handleBurnSite = useCallback(() => {
    if (!webViewRef.current || !activeTab?.url) {
      console.log('[Burn Site] No WebView ref or URL');
      return;
    }
    
    console.log('[Burn Site] Incinerating site data for:', activeTab.url);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    
    // The burn script - clears all site storage and cookies
    const burnScript = `
      localStorage.clear(); 
      sessionStorage.clear(); 
      document.cookie.split(';').forEach(function(c) { 
        document.cookie = c.replace(/^ +/, '').replace(/=.*/, '=;expires=' + new Date().toUTCString() + ';path=/'); 
      }); 
      window.location.reload(); 
      true;
    `;
    
    webViewRef.current.injectJavaScript(burnScript);
    
    // Show feedback toast/alert
    Alert.alert(
      '🔥 Site Data Incinerated',
      'All cookies, localStorage, and sessionStorage have been cleared. The page is reloading...',
      [{ text: 'OK', style: 'default' }]
    );
  }, [activeTab?.url]);

  // ============================================================
  // AI SUMMARIZE - Premium Feature
  // Page Content Extraction, API Wiring, and Error Handling
  // ============================================================
  
  // Production API Key placeholder - user can add their own key
  const AI_API_KEY = ''; // Placeholder for user key (OpenAI or Gemini)
  
  // State for copy button feedback
  const [isCopied, setIsCopied] = useState(false);
  
  /**
   * Copy summary text to clipboard
   */
  const handleCopySummary = useCallback(async () => {
    if (!aiSummaryText || aiSummaryText.includes('Scanning') || aiSummaryText.includes('Generating')) {
      return;
    }
    
    try {
      await Clipboard.setStringAsync(aiSummaryText);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsCopied(true);
      
      // Reset after 2 seconds
      setTimeout(() => {
        setIsCopied(false);
      }, 2000);
    } catch (error) {
      console.error('[Copy] Failed to copy:', error);
      Alert.alert('Copy Failed', 'Could not copy to clipboard.');
    }
  }, [aiSummaryText]);

  /**
   * JavaScript injection script to extract text content from the page
   * Grabs paragraphs and headings, filters short content, limits to 4000 chars
   */
  const extractTextScript = `
    try {
      const paragraphs = Array.from(document.querySelectorAll('p, h1, h2, h3, article, section, main'))
        .map(p => p.innerText)
        .filter(t => t.length > 50)
        .join('\\n\\n');
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'EXTRACTED_TEXT',
        payload: paragraphs.substring(0, 4000)
      }));
    } catch(e) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'EXTRACTION_ERROR',
        payload: e.message
      }));
    }
    true;
  `;

  /**
   * Generate AI Summary from extracted text
   * Production-ready with API fallback to local heuristics
   */
  const generateAISummary = useCallback(async (text: string) => {
    try {
      console.log('[AI Summary] Processing text, length:', text.length);
      
      // ============================================================
      // ERROR HANDLING: Validation
      // ============================================================
      if (!text || text.trim().length < 100) {
        throw new Error('Not enough readable text found on this page to summarize.');
      }

      // ============================================================
      // PRODUCTION API: OpenAI GPT-4 / Gemini Integration
      // ============================================================
      const SYSTEM_PROMPT = 'You are a privacy-focused browser assistant. Summarize the following webpage content into 3 clear, high-impact bullet points.';
      
      // Try API if key is provided
      if (AI_API_KEY && AI_API_KEY.length > 10) {
        console.log('[AI Summary] Using API with provided key');
        setAiSummaryText('✨ Generating AI summary...');
        
        try {
          // Detect if it's an OpenAI key (starts with sk-) or Gemini key
          const isOpenAI = AI_API_KEY.startsWith('sk-');
          
          if (isOpenAI) {
            // ============================================================
            // OpenAI GPT-4 API
            // ============================================================
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${AI_API_KEY}`,
              },
              body: JSON.stringify({
                model: 'gpt-4',
                messages: [
                  { role: 'system', content: SYSTEM_PROMPT },
                  { role: 'user', content: `Summarize this webpage content:\n\n${text.substring(0, 3000)}` }
                ],
                max_tokens: 500,
                temperature: 0.7,
              }),
            });
            
            if (!response.ok) {
              throw new Error(`OpenAI API error: ${response.status}`);
            }
            
            const data = await response.json();
            const summary = data.choices?.[0]?.message?.content;
            
            if (summary) {
              setAiSummaryText(`✨ **AI Summary**\n\n${summary}`);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              return;
            }
          } else {
            // ============================================================
            // Google Gemini API
            // ============================================================
            const response = await fetch(
              `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${AI_API_KEY}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: [{
                    parts: [{
                      text: `${SYSTEM_PROMPT}\n\nWebpage content:\n\n${text.substring(0, 3000)}`
                    }]
                  }],
                  generationConfig: {
                    maxOutputTokens: 500,
                    temperature: 0.7,
                  }
                }),
              }
            );
            
            if (!response.ok) {
              throw new Error(`Gemini API error: ${response.status}`);
            }
            
            const data = await response.json();
            const summary = data.candidates?.[0]?.content?.parts?.[0]?.text;
            
            if (summary) {
              setAiSummaryText(`✨ **AI Summary**\n\n${summary}`);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              return;
            }
          }
        } catch (apiError: any) {
          console.warn('[AI Summary] API failed, falling back to local:', apiError.message);
          // Fall through to local heuristic
        }
      }

      // ============================================================
      // LOCAL FALLBACK: Heuristic-based summary (works without API)
      // Extracts key sentences from the text
      // ============================================================
      console.log('[AI Summary] Using local heuristic fallback');
      setAiSummaryText('📝 Analyzing content locally...');
      
      // Clean and split text into sentences
      const cleanText = text
        .replace(/\s+/g, ' ')
        .replace(/\n+/g, ' ')
        .trim();
      
      // Split by sentence-ending punctuation
      const sentences = cleanText
        .split(/(?<=[.!?])\s+/)
        .filter(s => s.length > 30 && s.length < 300)
        .map(s => s.trim());
      
      if (sentences.length < 2) {
        throw new Error('Could not extract meaningful sentences from this page.');
      }

      // Select key sentences: first, middle, and one from the end
      const keyPoints: string[] = [];
      
      // First sentence (usually introduction/headline)
      keyPoints.push(sentences[0]);
      
      // A sentence from the middle (core content)
      if (sentences.length > 2) {
        const middleIndex = Math.floor(sentences.length / 2);
        keyPoints.push(sentences[middleIndex]);
      }
      
      // A sentence from later in the text (often conclusion/key info)
      if (sentences.length > 4) {
        const lateIndex = Math.floor(sentences.length * 0.75);
        if (!keyPoints.includes(sentences[lateIndex])) {
          keyPoints.push(sentences[lateIndex]);
        }
      }
      
      // Add one more varied sentence if available
      if (sentences.length > 6 && keyPoints.length < 4) {
        const randomIndex = Math.floor(sentences.length * 0.4);
        if (!keyPoints.includes(sentences[randomIndex])) {
          keyPoints.push(sentences[randomIndex]);
        }
      }

      // Format output with bullet points
      const formattedSummary = [
        '📄 **Page Summary**\n',
        ...keyPoints.map((point) => `• ${point}`),
        '\n\n_Generated using local text analysis_'
      ].join('\n');

      setAiSummaryText(formattedSummary);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
    } catch (error: any) {
      // ============================================================
      // ERROR HANDLING: Catch block
      // ============================================================
      console.error('[AI Summary] Error:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setAiSummaryText(`⚠️ **AI Error**\n\n${error.message || 'Failed to generate summary. Please try again.'}`);
    }
  }, []);

  /**
   * Handle AI Summarize button press
   * Opens the drawer, shows scanning state, and triggers text extraction
   */
  const handleAISummarize = useCallback(() => {
    console.log('[AI Summarize] Starting for:', activeTab?.url);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    // Close menu first
    setMenuVisible(false);
    
    // Open the AI drawer with scanning state
    setAiSummaryText('🔍 Scanning page...');
    setIsAiDrawerVisible(true);
    
    // Check if we have a valid WebView reference
    if (!webViewRef.current) {
      console.log('[AI Summarize] No WebView ref - showing demo');
      // If no WebView (e.g., on New Tab Page), show a message
      setTimeout(() => {
        setAiSummaryText('ℹ️ **Navigate to a webpage first**\n\nOpen any website, then tap AI Summarize to generate a summary of its content.');
      }, 500);
      return;
    }
    
    // Inject the text extraction script
    console.log('[AI Summarize] Injecting extraction script');
    setAiSummaryText('🔍 Scanning page content...');
    webViewRef.current.injectJavaScript(extractTextScript);
    
  }, [activeTab?.url, extractTextScript]);

  /**
   * Handle messages from WebView (text extraction results)
   */
  const handleWebViewMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('[WebView Message] Type:', data.type);
      
      switch (data.type) {
        case 'EXTRACTED_TEXT':
          console.log('[WebView Message] Extracted text length:', data.payload?.length);
          setAiSummaryText('✨ Generating summary...');
          generateAISummary(data.payload);
          break;
          
        case 'EXTRACTION_ERROR':
          console.error('[WebView Message] Extraction error:', data.payload);
          setAiSummaryText(`⚠️ **Extraction Error**\n\n${data.payload || 'Failed to extract page content.'}`);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          break;
          
        default:
          // Handle other message types from existing code
          handleMessage(event);
          break;
      }
    } catch (e) {
      // If JSON parsing fails, pass to existing handler
      handleMessage(event);
    }
  }, [generateAISummary, handleMessage]);

  /**
   * Close the AI Summary drawer
   */
  const handleCloseAiDrawer = useCallback(() => {
    setIsAiDrawerVisible(false);
    // Clear text after animation
    setTimeout(() => {
      setAiSummaryText('');
    }, 300);
  }, []);

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

    // ============================================================================
    // UNIFIED CONTEXT MENU INTERCEPTOR
    // Handles both image long-press and text selection long-press
    // Suppresses the native callout while keeping text highlighting
    // ============================================================================
    scripts += `
      (function() {
        try {
          // Suppress native touch-callout but keep text selection highlighting
          var style = document.createElement('style');
          style.innerHTML = 'body { -webkit-touch-callout: none; }';
          document.head.appendChild(style);

          window.addEventListener('contextmenu', function(e) {
            // === IMAGE HANDLER ===
            // Walk up the DOM to find a nearby <img> (handles wrapped images)
            var el = e.target;
            var depth = 0;
            while (el && el.tagName !== 'IMG' && depth < 3) {
              el = el.parentElement;
              depth++;
            }
            if (el && el.tagName === 'IMG' && el.src) {
              e.preventDefault();
              e.stopPropagation();
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'IMAGE_LONG_PRESS',
                src: el.src
              }));
              return;
            }

            // === TEXT SELECTION HANDLER ===
            var selectedText = window.getSelection().toString().trim();
            if (selectedText.length > 0 && e.target.tagName !== 'IMG') {
              e.preventDefault();
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'TEXT_LONG_PRESS',
                text: selectedText
              }));
            }
          }, true);
          console.log('[Aura] Unified context menu interceptor active');
        } catch(e) {
          console.log('[Aura] Error setting up context interceptor:', e);
        }
      })();
    `;
    
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
      {/* Unified Top Bar - Only shown when NOT on the Home Hub (NewTabPage) */}
      {/* On Home Hub, the FloatingIslandDock handles search/navigation */}
      {/* Animated slide-up with bounce when transitioning to browser view */}
      {!isNewTabPage && (
        <Animated.View
          style={{
            opacity: browserViewOpacity,
            transform: [{ translateY: browserViewTranslateY }],
          }}
        >
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
        </Animated.View>
      )}

      {/* ============================================================ */}
      {/* FIND IN PAGE SEARCH BAR - Glassmorphic Premium UI */}
      {/* Conditionally renders below the URL bar when active */}
      {/* ============================================================ */}
      {isFindModeActive && (
        <View style={styles.findInPageContainer}>
          <View style={styles.findInPageBar}>
            {/* Search Input */}
            <TextInput
              ref={findInputRef}
              style={styles.findInPageInput}
              placeholder="Find in page..."
              placeholderTextColor="rgba(255, 255, 255, 0.5)"
              value={findText}
              onChangeText={setFindText}
              onSubmitEditing={handleFindNext}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              selectionColor="#00FFFF"
            />
            
            {/* Next Button - Arrow Down */}
            <TouchableOpacity
              style={styles.findInPageButton}
              onPress={handleFindNext}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-down" size={24} color="#00FFFF" />
            </TouchableOpacity>
            
            {/* Close Button - X */}
            <TouchableOpacity
              style={styles.findInPageCloseButton}
              onPress={handleCloseFindInPage}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Browser Menu (3-dot menu) - Premium Glassmorphic Design */}
      <BrowserMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        currentUrl={activeTab?.url ?? ''}
        currentTitle={activeTab?.title ?? ''}
        isBookmarked={activeTab ? useBrowserStore.getState().isBookmarked(activeTab.url) : false}
        isDesktopMode={activeTab?.isDesktopMode ?? false}
        isReaderMode={isReaderModeActive}
        onToggleBookmark={() => {
          if (activeTab) {
            useBrowserStore.getState().toggleBookmark(activeTab.url, activeTab.title);
          }
        }}
        onToggleDesktopMode={() => {
          toggleDesktopMode();
          // Reload page to fetch with new user agent
          setTimeout(() => {
            webViewRef.current?.reload();
          }, 100);
        }}
        onToggleReaderMode={toggleReaderMode}
        onFindInPage={handleOpenFindInPage}
        onBurnSite={handleBurnSite}
        onAISummarize={handleAISummarize}
        onOpenDownloads={() => setDownloadsModalVisible(true)}
        onDownloadAllLinks={handleDownloadAllLinks}
      />

      {/* ============================================================ */}
      {/* AI SUMMARIZER DRAWER - Premium Glassmorphic Bottom Sheet */}
      {/* Slides up from bottom with opalescent dark background */}
      {/* ============================================================ */}
      <Modal
        visible={isAiDrawerVisible}
        transparent
        animationType="slide"
        onRequestClose={handleCloseAiDrawer}
      >
        <Pressable 
          style={styles.aiDrawerOverlay}
          onPress={handleCloseAiDrawer}
        >
          <Pressable 
            style={[
              styles.aiDrawerContainer,
              { paddingBottom: Math.max(insets.bottom, 24) }
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Electric Cyan Top Border Highlight */}
            <View style={styles.aiDrawerTopHighlight} />
            
            {/* Header */}
            <View style={styles.aiDrawerHeader}>
              <View style={styles.aiDrawerHeaderLeft}>
                <Ionicons name="sparkles" size={24} color="#00FFFF" />
                <Text style={styles.aiDrawerTitle}>AI Page Summary</Text>
              </View>
              <TouchableOpacity 
                style={styles.aiDrawerCloseButton}
                onPress={handleCloseAiDrawer}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={24} color="#888" />
              </TouchableOpacity>
            </View>

            {/* Divider */}
            <View style={styles.aiDrawerDivider} />

            {/* Summary Content */}
            <ScrollView 
              style={styles.aiDrawerContent}
              contentContainerStyle={styles.aiDrawerContentContainer}
              showsVerticalScrollIndicator={false}
            >
              {aiSummaryText ? (
                <View style={styles.aiSummaryBox}>
                  {/* Copy Button - Top right of summary */}
                  {!aiSummaryText.includes('Scanning') && !aiSummaryText.includes('Generating') && !aiSummaryText.includes('Analyzing') && (
                    <TouchableOpacity
                      style={styles.aiCopyButton}
                      onPress={handleCopySummary}
                      activeOpacity={0.7}
                    >
                      <Ionicons 
                        name={isCopied ? "checkmark" : "copy-outline"} 
                        size={16} 
                        color={isCopied ? "#00FF88" : "#00FFFF"} 
                      />
                      <Text style={[
                        styles.aiCopyButtonText,
                        isCopied && { color: '#00FF88' }
                      ]}>
                        {isCopied ? 'Copied!' : 'Copy'}
                      </Text>
                    </TouchableOpacity>
                  )}
                  
                  <Text style={styles.aiSummaryText}>{aiSummaryText}</Text>
                  
                  {/* Loading indicator dots - show during scanning/generating */}
                  {(aiSummaryText.includes('Scanning') || aiSummaryText.includes('Generating') || aiSummaryText.includes('Analyzing')) && (
                    <View style={styles.aiLoadingDots}>
                      <View style={[styles.aiDot, styles.aiDot1]} />
                      <View style={[styles.aiDot, styles.aiDot2]} />
                      <View style={[styles.aiDot, styles.aiDot3]} />
                    </View>
                  )}
                </View>
              ) : (
                <Text style={styles.aiEmptyText}>
                  Navigate to a webpage and tap the AI button to generate a summary.
                </Text>
              )}
            </ScrollView>

            {/* Close Button */}
            <TouchableOpacity 
              style={styles.aiDrawerActionButton}
              onPress={handleCloseAiDrawer}
              activeOpacity={0.8}
            >
              <Text style={styles.aiDrawerActionText}>Close</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <View style={styles.webviewContainer}>
        {Platform.OS === 'web' ? (
          // Web platform: Show New Tab Page with slide/fade animation
          <Animated.View
            style={{
              flex: 1,
              opacity: homeHubOpacity,
              transform: [{ translateY: homeHubTranslateY }],
            }}
          >
            <NewTabPage
              onNavigate={handleNavigate}
              onSearch={handleNavigate}
              onOpenMenu={() => setMenuVisible(true)}
              onAISummarize={handleAISummarize}
              onAccessibility={() => setAccessibilityModalVisible(true)}
            />
          </Animated.View>
        ) : isNewTabPage ? (
          // Native: Show New Tab Page for blank/new tabs with slide/fade animation
          <Animated.View
            style={{
              flex: 1,
              opacity: homeHubOpacity,
              transform: [{ translateY: homeHubTranslateY }],
            }}
          >
            <NewTabPage
              onNavigate={handleNavigate}
              onSearch={handleNavigate}
              onOpenMenu={() => setMenuVisible(true)}
              onAISummarize={handleAISummarize}
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
              onMessage={handleWebViewMessage}
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

        {/* Live Captioning Pill - Demo Mode */}
        <CaptionPill
          visible={settings.liveCaptioningEnabled}
          onClose={() => useBrowserStore.getState().toggleLiveCaptioning()}
        />

        {/* Ambient Flash Overlay - Flashes cyan when loud sound detected */}
        {settings.ambientAwarenessEnabled && (
          <Animated.View
            style={[
              styles.ambientFlashOverlay,
              {
                opacity: ambientFlashAnim,
                pointerEvents: 'none',
              },
            ]}
          />
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

        {/* Downloads Manager Modal */}
        <DownloadsModal
          visible={downloadsModalVisible}
          onClose={() => setDownloadsModalVisible(false)}
        />

        {/* Background Download Notification Banner */}
        <DownloadNotificationBanner
          downloadsModalVisible={downloadsModalVisible}
          onOpenDownloads={() => setDownloadsModalVisible(true)}
        />

        {/* Image Long-Press Context Menu */}
        <ImageContextMenu
          visible={isImageMenuVisible}
          imageUrl={selectedImageUrl}
          onClose={() => setIsImageMenuVisible(false)}
          onDownload={handleFileDownload}
        />

        {/* Text Selection Context Menu */}
        <TextSelectionMenu
          visible={isTextMenuVisible}
          selectedText={selectedText}
          onClose={() => { setIsTextMenuVisible(false); setSelectedText(''); }}
          onNavigate={(url) => {
            if (activeTab && webViewRef.current) {
              updateTab(activeTab.id, { url });
            }
          }}
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

      {/* Quick Converse - Full-screen split-screen communication interface */}
      <QuickConverseView
        visible={settings.quickConverseEnabled}
        onClose={() => toggleQuickConverse()}
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
  // ============================================================
  // FIND IN PAGE - Premium Glassmorphic Search Bar
  // ============================================================
  findInPageContainer: {
    backgroundColor: 'rgba(20, 20, 20, 0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  findInPageBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 12,
    height: 52,
  },
  findInPageInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
    paddingVertical: 12,
    paddingRight: 8,
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    }),
  },
  findInPageButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
  },
  findInPageCloseButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  // ============================================================
  // AI SUMMARIZER DRAWER - Premium Glassmorphic Bottom Sheet
  // ============================================================
  aiDrawerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  aiDrawerContainer: {
    backgroundColor: 'rgba(20, 20, 25, 0.95)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingHorizontal: 20,
    minHeight: 320,
    maxHeight: '70%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -8 },
        shadowOpacity: 0.4,
        shadowRadius: 24,
      },
      android: {
        elevation: 24,
      },
      web: {
        boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.5)',
      },
    }),
  },
  aiDrawerTopHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#00FFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#00FFFF',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 12,
      },
    }),
  },
  aiDrawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    paddingBottom: 12,
  },
  aiDrawerHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  aiDrawerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    }),
  },
  aiDrawerCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiDrawerDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 16,
  },
  aiDrawerContent: {
    flex: 1,
  },
  aiDrawerContentContainer: {
    paddingBottom: 16,
  },
  aiSummaryBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    position: 'relative',
  },
  aiCopyButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
    zIndex: 10,
  },
  aiCopyButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#00FFFF',
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    }),
  },
  aiSummaryText: {
    fontSize: 16,
    lineHeight: 26,
    color: '#DDDDDD',
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    }),
  },
  aiEmptyText: {
    fontSize: 15,
    color: '#888888',
    textAlign: 'center',
    paddingVertical: 40,
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    }),
  },
  aiLoadingDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    gap: 8,
  },
  aiDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00FFFF',
    opacity: 0.5,
  },
  aiDot1: {
    opacity: 1,
  },
  aiDot2: {
    opacity: 0.7,
  },
  aiDot3: {
    opacity: 0.4,
  },
  aiDrawerActionButton: {
    backgroundColor: '#00FFFF',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#00FFFF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  aiDrawerActionText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0A0A0A',
    letterSpacing: 0.5,
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    }),
  },
  // ============================================================
  // AMBIENT AWARENESS - Flash overlay for danger sounds
  // ============================================================
  ambientFlashOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#00FFFF',
    zIndex: 9999,
  },
});
