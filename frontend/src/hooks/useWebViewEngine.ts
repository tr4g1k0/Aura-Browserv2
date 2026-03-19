import { useState, useCallback, RefObject } from 'react';
import { Platform } from 'react-native';
import {
  isAdOrTracker,
  adBusterScript,
  createAdBusterScript,
  gpuLayerSquashingScript,
  performanceOptimizationScript,
  recordBlockedRequest,
  visionAIScannerPlaceholder,
} from '../utils/adblock';
import {
  predictiveCacheService,
  linkExtractionScript,
} from '../services/PredictiveCacheService';
import {
  pageContextExtractionScript,
} from '../services/SemanticHistoryService';
import {
  videoDetectionScript,
  youtubeBackgroundPlayScript,
} from '../services/BackgroundMediaService';

interface WebViewEngineDeps {
  userSettings: {
    aggressiveAdBlocking?: boolean;
    doNotTrack?: boolean;
    forceZoom?: boolean;
    aiHistoryEnabled?: boolean;
    [key: string]: any;
  };
  settings: {
    vpnEnabled?: boolean;
    predictiveCachingEnabled?: boolean;
    [key: string]: any;
  };
  isGhostMode: boolean;
  activeTab: { url?: string; scrollY?: number; [key: string]: any } | undefined;
  cachedPageSource: any;
  setCachedPageSource: (v: any) => void;
  setIsCacheHit: (v: boolean) => void;
  incrementAds: (count?: number) => void;
  incrementTrackers: (count?: number) => void;
  checkForDownload: (url: string) => boolean;
  handleFileDownload: (url: string) => Promise<boolean>;
  setLoading: (loading: boolean) => void;
  webViewRef: RefObject<any>;
}

export function useWebViewEngine(deps: WebViewEngineDeps) {
  const {
    userSettings,
    settings,
    isGhostMode,
    activeTab,
    cachedPageSource,
    setCachedPageSource,
    setIsCacheHit,
    incrementAds,
    incrementTrackers,
    checkForDownload,
    handleFileDownload,
    setLoading,
    webViewRef,
  } = deps;

  const [visionAISelectors, setVisionAISelectors] = useState<string[]>([]);
  const [adsBlocked, setAdsBlocked] = useState(0);

  const initVisionAISelectors = useCallback(async () => {
    const selectors = await visionAIScannerPlaceholder('');
    setVisionAISelectors(selectors);
  }, []);

  const vpnScript = settings.vpnEnabled ? `
    (function() {
      console.log('[VPN] Secure connection active');
    })();
    true;
  ` : '';

  const getInjectedScript = useCallback(() => {
    let scripts = '';
    
    scripts += gpuLayerSquashingScript;
    
    if (userSettings.aggressiveAdBlocking) {
      scripts += visionAISelectors.length > 0
        ? createAdBusterScript(visionAISelectors)
        : adBusterScript;
    }
    
    scripts += performanceOptimizationScript;
    scripts += vpnScript;
    
    if (userSettings.doNotTrack) {
      scripts += `
        (function() {
          try {
            Object.defineProperty(navigator, 'doNotTrack', {
              get: function() { return '1'; },
              configurable: true
            });
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
    }
    
    if (userSettings.forceZoom) {
      scripts += `
        (function() {
          try {
            var meta = document.querySelector('meta[name="viewport"]');
            if (meta) {
              meta.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=10.0, user-scalable=yes');
            } else {
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
    }

    // Force dark web mode
    if (userSettings.forceDarkWeb) {
      scripts += `
        (function() {
          try {
            var darkStyle = document.createElement('style');
            darkStyle.id = 'aura-force-dark';
            darkStyle.innerHTML = 'html { filter: invert(1) hue-rotate(180deg) !important; } img, video, canvas, svg, [style*="background-image"] { filter: invert(1) hue-rotate(180deg) !important; }';
            document.head.appendChild(darkStyle);
            console.log('[ForceDark] Dark mode filter applied');
          } catch(e) {
            console.log('[ForceDark] Error:', e);
          }
        })();
      `;
    }

    // Unified context menu + selection interceptor
    scripts += `
      (function() {
        try {
          var style = document.createElement('style');
          style.innerHTML = 'body { -webkit-touch-callout: none; }';
          document.head.appendChild(style);

          window.addEventListener('contextmenu', function(e) {
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
            }
          }, true);

          var _auraSelTimer = null;
          document.addEventListener('selectionchange', function() {
            clearTimeout(_auraSelTimer);
            _auraSelTimer = setTimeout(function() {
              var sel = window.getSelection().toString().trim();
              if (sel.length > 0) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'TEXT_SELECTED',
                  text: sel
                }));
              } else {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'TEXT_CLEAR' }));
              }
            }, 150);
          });

          console.log('[Aura] Context menu + selection interceptors active');
        } catch(e) {
          console.log('[Aura] Error setting up interceptors:', e);
        }
      })();
    `;

    // Bot detection
    scripts += `
      (function() {
        try {
          setTimeout(function() {
            var body = document.body ? document.body.innerText || '' : '';
            var url = window.location.href || '';
            var isBot = false;
            if (url.indexOf('/sorry/') !== -1 || url.indexOf('recaptcha') !== -1) isBot = true;
            if (body.indexOf('unusual traffic') !== -1) isBot = true;
            if (body.indexOf('reCAPTCHA') !== -1 && body.indexOf('robot') !== -1) isBot = true;
            if (body.indexOf('blocked') !== -1 && body.indexOf('automated') !== -1) isBot = true;
            if (isBot) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'BOT_DETECTED' }));
            }
          }, 1500);
        } catch(e) {}
      })();
    `;
    
    return scripts || 'true;';
  }, [userSettings.aggressiveAdBlocking, userSettings.doNotTrack, userSettings.forceZoom, userSettings.forceDarkWeb, visionAISelectors, vpnScript]);

  const handleShouldStartLoad = useCallback((event: any): boolean => {
    const { url } = event;
    
    if (Platform.OS === 'android' && checkForDownload(url)) {
      console.log('[Smart Shield] Download intercepted:', url);
      handleFileDownload(url);
      return false;
    }
    
    if (userSettings.aggressiveAdBlocking && isAdOrTracker(url)) {
      console.log('[Smart Shield] Blocked:', url);
      recordBlockedRequest(url);
      setAdsBlocked(prev => prev + 1);
      
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

  const handleLoadEnd = useCallback(() => {
    setLoading(false);
    
    if (cachedPageSource) {
      setCachedPageSource(null);
      setIsCacheHit(false);
    }
    
    if (userSettings.aggressiveAdBlocking) {
      const script = visionAISelectors.length > 0
        ? createAdBusterScript(visionAISelectors)
        : adBusterScript;
      webViewRef.current?.injectJavaScript(script);
    }

    // Scroll tracking script
    const scrollTrackingScript = `
      (function() {
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
        window.addEventListener('scroll', reportScroll, { passive: true });
        reportScroll();
      })();
      true;
    `;
    webViewRef.current?.injectJavaScript(scrollTrackingScript);

    // Restore scroll position
    const savedScrollY = activeTab?.scrollY || 0;
    if (savedScrollY > 0) {
      console.log('[Tab Virtualization] Restoring scroll position:', savedScrollY);
      const scrollRestoreScript = `
        (function() {
          setTimeout(() => {
            window.scrollTo(0, ${savedScrollY});
            console.log('[Tab Virtualization] Scrolled to:', ${savedScrollY});
          }, 100);
        })();
        true;
      `;
      webViewRef.current?.injectJavaScript(scrollRestoreScript);
    }

    // Predictive caching
    if (settings.predictiveCachingEnabled && activeTab?.url) {
      const currentUrl = activeTab.url;
      const lastProcessedUrl = (globalThis as any).__lastProcessedUrl;
      if (lastProcessedUrl !== currentUrl) {
        (globalThis as any).__lastProcessedUrl = currentUrl;
        webViewRef.current?.injectJavaScript(linkExtractionScript);
      }
    }

    // Video detection for background playback
    if (activeTab?.url) {
      // Inject video detector on all pages
      webViewRef.current?.injectJavaScript(videoDetectionScript);
      
      // Inject YouTube-specific background play script on YouTube
      const isYouTube = activeTab.url.includes('youtube.com') || activeTab.url.includes('youtu.be');
      if (isYouTube) {
        setTimeout(() => {
          webViewRef.current?.injectJavaScript(youtubeBackgroundPlayScript);
          console.log('[BackgroundMedia] YouTube background play script injected');
        }, 1000);
      }
    }

    // Media detection for downloads (inject separately from video detector)
    if (activeTab?.url && Platform.OS !== 'web') {
      // Import dynamically to avoid circular deps
      import('../services/MediaDownloadService').then(({ mediaDetectionScript }) => {
        webViewRef.current?.injectJavaScript(mediaDetectionScript);
      });
    }

    // Semantic history
    if (!isGhostMode && userSettings.aiHistoryEnabled !== false && activeTab?.url) {
      if ((globalThis as any).__semanticHistoryTimer) {
        clearTimeout((globalThis as any).__semanticHistoryTimer);
      }
      (globalThis as any).__semanticHistoryTimer = setTimeout(() => {
        console.log('[Semantic History] Capturing page context after 3s delay...');
        webViewRef.current?.injectJavaScript(pageContextExtractionScript);
      }, 3000);
    }
  }, [userSettings.aggressiveAdBlocking, userSettings.aiHistoryEnabled, settings.predictiveCachingEnabled, visionAISelectors, cachedPageSource, setCachedPageSource, setIsCacheHit, activeTab?.scrollY, activeTab?.url, isGhostMode, webViewRef, setLoading]);

  return {
    visionAISelectors,
    adsBlocked,
    initVisionAISelectors,
    getInjectedScript,
    handleShouldStartLoad,
    handleLoadEnd,
  };
}
