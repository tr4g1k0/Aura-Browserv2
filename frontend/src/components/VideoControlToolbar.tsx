/**
 * Video Control Toolbar
 * 
 * Floating toolbar that appears when video is detected playing on page
 * Features:
 * - PIP button (Picture-in-Picture)
 * - Background play toggle
 * - Mute/unmute button
 * - Auto-hides after 3 seconds of inactivity
 */

import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
  Text,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';

interface VideoInfo {
  isPlaying: boolean;
  isPaused: boolean;
  isMuted: boolean;
  currentTime: number;
  duration: number;
}

interface VideoControlToolbarProps {
  videoInfo: VideoInfo | null;
  onPIP: () => void;
  onBackgroundPlay: () => void;
  onToggleMute: () => void;
  onPlay: () => void;
  onPause: () => void;
  isBackgroundPlayEnabled: boolean;
  bottomOffset?: number;
}

const VideoControlToolbarComponent: React.FC<VideoControlToolbarProps> = ({
  videoInfo,
  onPIP,
  onBackgroundPlay,
  onToggleMute,
  onPlay,
  onPause,
  isBackgroundPlayEnabled,
  bottomOffset = 80,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastInteractionRef = useRef<number>(Date.now());

  // Show toolbar when video is playing
  useEffect(() => {
    if (videoInfo?.isPlaying) {
      showToolbar();
    } else {
      hideToolbar();
    }
  }, [videoInfo?.isPlaying]);

  const showToolbar = useCallback(() => {
    setIsVisible(true);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();

    // Reset auto-hide timer
    resetHideTimer();
  }, [fadeAnim]);

  const hideToolbar = useCallback(() => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setIsVisible(false);
    });

    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }
  }, [fadeAnim]);

  const resetHideTimer = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }

    // Auto-hide after 3 seconds
    hideTimeoutRef.current = setTimeout(() => {
      if (Date.now() - lastInteractionRef.current >= 3000) {
        hideToolbar();
      }
    }, 3000);
  }, [hideToolbar]);

  const handleInteraction = useCallback(() => {
    lastInteractionRef.current = Date.now();
    showToolbar();
  }, [showToolbar]);

  const handlePIP = useCallback(() => {
    handleInteraction();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPIP();
  }, [onPIP, handleInteraction]);

  const handleBackgroundPlay = useCallback(() => {
    handleInteraction();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onBackgroundPlay();
  }, [onBackgroundPlay, handleInteraction]);

  const handleToggleMute = useCallback(() => {
    handleInteraction();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onToggleMute();
  }, [onToggleMute, handleInteraction]);

  const handlePlayPause = useCallback(() => {
    handleInteraction();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (videoInfo?.isPlaying) {
      onPause();
    } else {
      onPlay();
    }
  }, [videoInfo?.isPlaying, onPlay, onPause, handleInteraction]);

  // Format time for display
  const formatTime = (seconds: number): string => {
    if (!seconds || !isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  if (!isVisible || !videoInfo) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          bottom: bottomOffset,
          opacity: fadeAnim,
          transform: [{
            translateY: fadeAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [20, 0],
            }),
          }],
        },
      ]}
      shouldRasterizeIOS={true}
      renderToHardwareTextureAndroid={true}
    >
      <BlurView intensity={80} tint="dark" style={styles.blurContainer}>
        <View style={styles.toolbar}>
          {/* Time display */}
          <View style={styles.timeContainer}>
            <Text style={styles.timeText}>
              {formatTime(videoInfo.currentTime)} / {formatTime(videoInfo.duration)}
            </Text>
          </View>

          {/* Control buttons */}
          <View style={styles.controls}>
            {/* Play/Pause */}
            <TouchableOpacity
              style={styles.controlButton}
              onPress={handlePlayPause}
              activeOpacity={0.7}
            >
              <Ionicons
                name={videoInfo.isPlaying ? 'pause' : 'play'}
                size={22}
                color="#FFFFFF"
              />
            </TouchableOpacity>

            {/* Mute/Unmute */}
            <TouchableOpacity
              style={styles.controlButton}
              onPress={handleToggleMute}
              activeOpacity={0.7}
            >
              <Ionicons
                name={videoInfo.isMuted ? 'volume-mute' : 'volume-high'}
                size={22}
                color="#FFFFFF"
              />
            </TouchableOpacity>

            {/* Background Play */}
            <TouchableOpacity
              style={[
                styles.controlButton,
                isBackgroundPlayEnabled && styles.controlButtonActive,
              ]}
              onPress={handleBackgroundPlay}
              activeOpacity={0.7}
            >
              <Ionicons
                name="headset"
                size={22}
                color={isBackgroundPlayEnabled ? '#00FFFF' : '#FFFFFF'}
              />
            </TouchableOpacity>

            {/* PIP - Android only for now */}
            {Platform.OS === 'android' && (
              <TouchableOpacity
                style={styles.controlButton}
                onPress={handlePIP}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="albums-outline"
                  size={22}
                  color="#FFFFFF"
                />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </BlurView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 1000,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  blurContainer: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  timeContainer: {
    flex: 1,
  },
  timeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
    opacity: 0.9,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  controlButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlButtonActive: {
    backgroundColor: 'rgba(0, 255, 255, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.5)',
  },
});

export const VideoControlToolbar = memo(VideoControlToolbarComponent);

export default VideoControlToolbar;
