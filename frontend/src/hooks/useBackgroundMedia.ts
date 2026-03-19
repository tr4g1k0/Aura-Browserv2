/**
 * useBackgroundMedia Hook
 * 
 * Manages background video/audio playback state and controls
 * Integrates with BackgroundMediaService for:
 * - Video detection
 * - Background audio continuation
 * - YouTube background play
 * - Media controls
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import {
  backgroundMediaService,
  videoDetectionScript,
  youtubeBackgroundPlayScript,
  mediaControlScript,
} from '../services/BackgroundMediaService';

export interface VideoState {
  isPlaying: boolean;
  isPaused: boolean;
  isMuted: boolean;
  currentTime: number;
  duration: number;
  width: number;
  height: number;
  src: string;
}

interface UseBackgroundMediaProps {
  webViewRef: React.RefObject<any>;
  currentUrl: string;
  isGhostMode: boolean;
}

interface UseBackgroundMediaReturn {
  videoState: VideoState | null;
  isBackgroundPlayEnabled: boolean;
  isVideoToolbarVisible: boolean;
  toggleBackgroundPlay: () => void;
  toggleMute: () => void;
  play: () => void;
  pause: () => void;
  enterPIP: () => void;
  handleVideoMessage: (data: any) => void;
  getVideoScripts: () => string;
}

export function useBackgroundMedia({
  webViewRef,
  currentUrl,
  isGhostMode,
}: UseBackgroundMediaProps): UseBackgroundMediaReturn {
  const [videoState, setVideoState] = useState<VideoState | null>(null);
  const [isBackgroundPlayEnabled, setIsBackgroundPlayEnabled] = useState(true);
  const [isVideoToolbarVisible, setIsVideoToolbarVisible] = useState(false);
  const appStateRef = useRef<AppStateStatus>('active');
  const lastUrlRef = useRef<string>('');

  // Initialize background media service
  useEffect(() => {
    backgroundMediaService.initialize();
    
    return () => {
      backgroundMediaService.destroy();
    };
  }, []);

  // Monitor app state for background playback
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      const wasActive = appStateRef.current === 'active';
      const isNowBackground = nextAppState === 'background' || nextAppState === 'inactive';

      if (wasActive && isNowBackground && videoState?.isPlaying && isBackgroundPlayEnabled) {
        console.log('[BackgroundMedia] App backgrounded - audio continues playing');
        // The audio will continue because we've set up the audio session properly
      }

      appStateRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [videoState?.isPlaying, isBackgroundPlayEnabled]);

  // Inject YouTube background play script when on YouTube
  useEffect(() => {
    const isYouTube = currentUrl.includes('youtube.com') || currentUrl.includes('youtu.be');
    
    if (isYouTube && lastUrlRef.current !== currentUrl && isBackgroundPlayEnabled) {
      // Inject YouTube background play script with a small delay
      setTimeout(() => {
        webViewRef.current?.injectJavaScript(youtubeBackgroundPlayScript);
        console.log('[BackgroundMedia] YouTube background play script injected');
      }, 1500);
    }
    
    lastUrlRef.current = currentUrl;
  }, [currentUrl, isBackgroundPlayEnabled, webViewRef]);

  // Show/hide video toolbar based on video state
  useEffect(() => {
    setIsVideoToolbarVisible(videoState?.isPlaying || false);
  }, [videoState?.isPlaying]);

  // Handle video state messages from WebView
  const handleVideoMessage = useCallback((data: any) => {
    if (data.type === 'VIDEO_STATE') {
      if (data.video) {
        setVideoState(data.video);
        backgroundMediaService.updateMediaState({
          isPlaying: data.video.isPlaying,
          isPaused: data.video.isPaused,
          isMuted: data.video.isMuted,
          currentTime: data.video.currentTime,
          duration: data.video.duration,
          title: data.title || 'Video',
          pageUrl: data.url || currentUrl,
        });
      } else {
        setVideoState(null);
        backgroundMediaService.updateMediaState(null);
      }
    }
  }, [currentUrl]);

  // Toggle background play mode
  const toggleBackgroundPlay = useCallback(() => {
    setIsBackgroundPlayEnabled(prev => {
      const newValue = !prev;
      console.log('[BackgroundMedia] Background play:', newValue ? 'enabled' : 'disabled');
      
      // Re-inject YouTube script if enabling on YouTube
      if (newValue && (currentUrl.includes('youtube.com') || currentUrl.includes('youtu.be'))) {
        webViewRef.current?.injectJavaScript(youtubeBackgroundPlayScript);
      }
      
      return newValue;
    });
  }, [currentUrl, webViewRef]);

  // Media controls
  const toggleMute = useCallback(() => {
    if (!webViewRef.current) return;
    const action = videoState?.isMuted ? 'unmute' : 'mute';
    webViewRef.current.injectJavaScript(mediaControlScript(action));
  }, [videoState?.isMuted, webViewRef]);

  const play = useCallback(() => {
    if (!webViewRef.current) return;
    webViewRef.current.injectJavaScript(mediaControlScript('play'));
  }, [webViewRef]);

  const pause = useCallback(() => {
    if (!webViewRef.current) return;
    webViewRef.current.injectJavaScript(mediaControlScript('pause'));
  }, [webViewRef]);

  // Enter PIP mode (Android only for now)
  const enterPIP = useCallback(() => {
    if (Platform.OS !== 'android') {
      console.log('[BackgroundMedia] PIP is only supported on Android');
      return;
    }
    
    // Note: Full PIP implementation requires native module
    // For now, we'll rely on the system's auto-PIP when app goes to background
    console.log('[BackgroundMedia] PIP requested - will activate when app backgrounds');
  }, []);

  // Get scripts to inject into WebView
  const getVideoScripts = useCallback(() => {
    let scripts = videoDetectionScript;
    
    // Add YouTube-specific scripts for YouTube pages
    if (isBackgroundPlayEnabled && (currentUrl.includes('youtube.com') || currentUrl.includes('youtu.be'))) {
      scripts += youtubeBackgroundPlayScript;
    }
    
    return scripts;
  }, [currentUrl, isBackgroundPlayEnabled]);

  return {
    videoState,
    isBackgroundPlayEnabled,
    isVideoToolbarVisible,
    toggleBackgroundPlay,
    toggleMute,
    play,
    pause,
    enterPIP,
    handleVideoMessage,
    getVideoScripts,
  };
}

export default useBackgroundMedia;
