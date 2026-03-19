/**
 * Media Download Overlay
 * 
 * Shows a download button overlay on detected video/audio elements
 * Appears when media is detected on a page and allows direct download
 */

import React, { memo, useState, useCallback, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Text,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';

interface DetectedMedia {
  type: 'video' | 'audio';
  src: string;
  allSources?: string[];
  poster?: string;
  duration?: number;
  title?: string;
  width?: number;
  height?: number;
  top?: number;
  isVisible?: boolean;
  isPlaying?: boolean;
  index?: number;
}

interface MediaDownloadOverlayProps {
  detectedMedia: DetectedMedia[];
  onDownload: (media: DetectedMedia) => void;
  bottomOffset?: number;
}

const AURA_BLUE = '#00F2FF';
const TEXT_WHITE = '#FFFFFF';
const TEXT_MUTED = '#6B7280';

// Format duration
const formatDuration = (seconds: number): string => {
  if (!seconds || !isFinite(seconds)) return '';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hours}:${remainingMins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Single media item button
const MediaDownloadButtonComponent: React.FC<{
  media: DetectedMedia;
  onDownload: () => void;
  index: number;
}> = ({ media, onDownload, index }) => {
  const [fadeAnim] = useState(new Animated.Value(0));
  const [pressed, setPressed] = useState(false);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      delay: index * 100,
      useNativeDriver: true,
    }).start();
  }, []);

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPressed(true);
    onDownload();
    
    // Reset pressed state after animation
    setTimeout(() => setPressed(false), 500);
  }, [onDownload]);

  return (
    <Animated.View style={[styles.buttonContainer, { opacity: fadeAnim }]}>
      <TouchableOpacity
        style={[styles.downloadButton, pressed && styles.downloadButtonPressed]}
        onPress={handlePress}
        activeOpacity={0.8}
      >
        <BlurView intensity={80} tint="dark" style={styles.buttonBlur}>
          <View style={styles.buttonContent}>
            <View style={styles.iconContainer}>
              <Ionicons 
                name={media.type === 'video' ? 'videocam' : 'musical-notes'} 
                size={18} 
                color={AURA_BLUE} 
              />
            </View>
            <View style={styles.buttonTextContainer}>
              <Text style={styles.buttonTitle} numberOfLines={1}>
                {media.type === 'video' ? 'Download Video' : 'Download Audio'}
              </Text>
              {media.duration && media.duration > 0 && (
                <Text style={styles.buttonSubtitle}>
                  {formatDuration(media.duration)}
                </Text>
              )}
            </View>
            <Ionicons name="download-outline" size={20} color={TEXT_WHITE} />
          </View>
        </BlurView>
      </TouchableOpacity>
    </Animated.View>
  );
};

const MediaDownloadButton = memo(MediaDownloadButtonComponent);

// Main overlay component
const MediaDownloadOverlayComponent: React.FC<MediaDownloadOverlayProps> = ({
  detectedMedia,
  onDownload,
  bottomOffset = 140,
}) => {
  // Only show visible, playing, or recent media
  const visibleMedia = detectedMedia.filter(m => 
    m.isVisible || m.isPlaying || (m.src && m.src.startsWith('http'))
  ).slice(0, 2); // Max 2 buttons

  if (visibleMedia.length === 0) return null;

  return (
    <View style={[styles.container, { bottom: bottomOffset }]}>
      {visibleMedia.map((media, index) => (
        <MediaDownloadButton
          key={`${media.type}-${media.index || index}-${media.src.substring(0, 50)}`}
          media={media}
          onDownload={() => onDownload(media)}
          index={index}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 999,
    gap: 8,
  },
  buttonContainer: {
    marginBottom: 8,
  },
  downloadButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  downloadButtonPressed: {
    transform: [{ scale: 0.98 }],
  },
  buttonBlur: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 242, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  buttonTextContainer: {
    flex: 1,
    marginRight: 8,
  },
  buttonTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT_WHITE,
  },
  buttonSubtitle: {
    fontSize: 12,
    color: TEXT_MUTED,
    marginTop: 2,
  },
});

export const MediaDownloadOverlay = memo(MediaDownloadOverlayComponent);

export default MediaDownloadOverlay;
