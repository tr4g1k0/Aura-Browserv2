/**
 * Background Media Service
 * 
 * Enables background audio/video playback for Aura Browser
 * - Continues audio when app goes to background
 * - YouTube background play support
 * - Video detection on any page
 * - Media session integration for notifications
 */

import { Platform, AppState, AppStateStatus } from 'react-native';
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';

// ============================================================================
// TYPES
// ============================================================================

export interface MediaState {
  isPlaying: boolean;
  isPaused: boolean;
  isMuted: boolean;
  currentTime: number;
  duration: number;
  title: string;
  pageUrl: string;
  favicon?: string;
}

export interface VideoInfo {
  isPlaying: boolean;
  isPaused: boolean;
  isMuted: boolean;
  currentTime: number;
  duration: number;
  width: number;
  height: number;
  src: string;
}

// ============================================================================
// BACKGROUND MEDIA SERVICE
// ============================================================================

class BackgroundMediaService {
  private isInitialized = false;
  private appState: AppStateStatus = 'active';
  private currentMediaState: MediaState | null = null;
  private onMediaStateChange: ((state: MediaState | null) => void) | null = null;
  private appStateSubscription: any = null;

  /**
   * Initialize the background media service
   * Sets up audio session for background playback
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Configure audio session for background playback
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: true, // KEY: Keep audio active in background
        playsInSilentModeIOS: true,    // Play even in silent mode
        interruptionModeIOS: InterruptionModeIOS.DuckOthers,
        interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      // Listen for app state changes
      this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);

      this.isInitialized = true;
      console.log('[BackgroundMedia] Service initialized with background playback enabled');
    } catch (error) {
      console.error('[BackgroundMedia] Failed to initialize:', error);
    }
  }

  /**
   * Clean up the service
   */
  destroy(): void {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
    }
    this.isInitialized = false;
  }

  /**
   * Handle app state changes (background/foreground)
   */
  private handleAppStateChange = (nextAppState: AppStateStatus): void => {
    const wasActive = this.appState === 'active';
    const isNowBackground = nextAppState === 'background' || nextAppState === 'inactive';

    if (wasActive && isNowBackground) {
      console.log('[BackgroundMedia] App went to background - audio continues');
    } else if (!wasActive && nextAppState === 'active') {
      console.log('[BackgroundMedia] App returned to foreground');
    }

    this.appState = nextAppState;
  };

  /**
   * Set media state change callback
   */
  setMediaStateCallback(callback: (state: MediaState | null) => void): void {
    this.onMediaStateChange = callback;
  }

  /**
   * Update current media state from WebView
   */
  updateMediaState(state: MediaState | null): void {
    this.currentMediaState = state;
    if (this.onMediaStateChange) {
      this.onMediaStateChange(state);
    }
  }

  /**
   * Get current media state
   */
  getMediaState(): MediaState | null {
    return this.currentMediaState;
  }

  /**
   * Check if app is in background
   */
  isInBackground(): boolean {
    return this.appState === 'background' || this.appState === 'inactive';
  }
}

// ============================================================================
// VIDEO DETECTION & BACKGROUND PLAY SCRIPTS
// ============================================================================

/**
 * Injected JavaScript to detect video playback and enable background play
 * This script:
 * 1. Monitors all video elements on the page
 * 2. Reports video state to React Native
 * 3. Prevents YouTube from pausing when app goes to background
 */
export const videoDetectionScript = `
(function() {
  'use strict';
  
  // Prevent duplicate injection
  if (window.__AURA_VIDEO_DETECTOR__) return;
  window.__AURA_VIDEO_DETECTOR__ = true;
  
  let activeVideo = null;
  let reportInterval = null;
  
  // Find the most prominent video on the page
  function findActiveVideo() {
    const videos = document.querySelectorAll('video');
    let bestVideo = null;
    let bestScore = 0;
    
    videos.forEach(video => {
      if (video.paused && !video.played.length) return;
      
      const rect = video.getBoundingClientRect();
      const area = rect.width * rect.height;
      const isVisible = rect.top < window.innerHeight && rect.bottom > 0;
      
      let score = area;
      if (!video.paused) score += 100000; // Prioritize playing videos
      if (isVisible) score += 50000;
      
      if (score > bestScore) {
        bestScore = score;
        bestVideo = video;
      }
    });
    
    return bestVideo;
  }
  
  // Report video state to React Native
  function reportVideoState() {
    const video = findActiveVideo();
    
    if (!video) {
      if (activeVideo) {
        activeVideo = null;
        window.ReactNativeWebView?.postMessage(JSON.stringify({
          type: 'VIDEO_STATE',
          video: null
        }));
      }
      return;
    }
    
    activeVideo = video;
    
    const state = {
      isPlaying: !video.paused && !video.ended,
      isPaused: video.paused,
      isMuted: video.muted,
      currentTime: video.currentTime,
      duration: video.duration || 0,
      width: video.videoWidth,
      height: video.videoHeight,
      src: video.src || video.currentSrc || ''
    };
    
    window.ReactNativeWebView?.postMessage(JSON.stringify({
      type: 'VIDEO_STATE',
      video: state,
      url: window.location.href,
      title: document.title
    }));
  }
  
  // Set up video event listeners
  function setupVideoListeners(video) {
    const events = ['play', 'pause', 'ended', 'volumechange', 'timeupdate'];
    events.forEach(event => {
      video.addEventListener(event, reportVideoState, { passive: true });
    });
  }
  
  // Monitor for new videos added to the page
  function observeVideos() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeName === 'VIDEO') {
            setupVideoListeners(node);
          } else if (node.querySelectorAll) {
            node.querySelectorAll('video').forEach(setupVideoListeners);
          }
        });
      });
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
  
  // Initialize
  document.querySelectorAll('video').forEach(setupVideoListeners);
  observeVideos();
  
  // Report state periodically
  reportInterval = setInterval(reportVideoState, 1000);
  
  // Initial report
  setTimeout(reportVideoState, 500);
  
  console.log('[Aura] Video detector initialized');
})();
true;
`;

/**
 * YouTube-specific script to enable background playback
 * Overrides the Page Visibility API so YouTube thinks the page is always visible
 */
export const youtubeBackgroundPlayScript = `
(function() {
  'use strict';
  
  // Prevent duplicate injection
  if (window.__AURA_YT_BACKGROUND__) return;
  window.__AURA_YT_BACKGROUND__ = true;
  
  // Override Page Visibility API
  Object.defineProperty(document, 'hidden', {
    get: function() { return false; },
    configurable: true
  });
  
  Object.defineProperty(document, 'visibilityState', {
    get: function() { return 'visible'; },
    configurable: true
  });
  
  // Intercept visibility change events
  document.addEventListener('visibilitychange', function(e) {
    e.stopImmediatePropagation();
    e.preventDefault();
  }, true);
  
  // Also intercept at window level
  window.addEventListener('visibilitychange', function(e) {
    e.stopImmediatePropagation();
    e.preventDefault();
  }, true);
  
  // Override hasFocus to always return true
  const originalHasFocus = document.hasFocus;
  document.hasFocus = function() {
    return true;
  };
  
  // Prevent YouTube's background pause detection
  const originalAddEventListener = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function(type, listener, options) {
    if (type === 'visibilitychange' || type === 'blur' || type === 'pagehide') {
      // Don't add these listeners for YouTube's pause detection
      console.log('[Aura BG] Blocked event listener:', type);
      return;
    }
    return originalAddEventListener.call(this, type, listener, options);
  };
  
  console.log('[Aura] YouTube background play enabled');
})();
true;
`;

/**
 * Media control script - allows controlling video from React Native
 */
export const mediaControlScript = (action: 'play' | 'pause' | 'mute' | 'unmute') => `
(function() {
  const videos = document.querySelectorAll('video');
  const video = Array.from(videos).find(v => !v.paused) || videos[0];
  
  if (video) {
    switch('${action}') {
      case 'play':
        video.play().catch(() => {});
        break;
      case 'pause':
        video.pause();
        break;
      case 'mute':
        video.muted = true;
        break;
      case 'unmute':
        video.muted = false;
        break;
    }
  }
})();
true;
`;

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const backgroundMediaService = new BackgroundMediaService();

export default backgroundMediaService;
