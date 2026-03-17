import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';

export type DownloadStatus = 'downloading' | 'complete' | 'error' | null;

interface DownloadToastProps {
  visible: boolean;
  status: DownloadStatus;
  filename: string;
  progress?: number;
  onDismiss?: () => void;
}

/**
 * DownloadToast - Shows download progress and status
 * 
 * Features:
 * - Animated slide-in from top
 * - Progress bar during download
 * - Success/error states with icons
 * - Auto-dismiss after completion
 * - Glassmorphism styling
 */
export const DownloadToast: React.FC<DownloadToastProps> = ({
  visible,
  status,
  filename,
  progress = 0,
  onDismiss,
}) => {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Slide animation
  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 0 : -100,
      useNativeDriver: true,
      damping: 15,
      stiffness: 120,
    }).start();
  }, [visible]);

  // Progress animation
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  // Auto-dismiss after completion
  useEffect(() => {
    if (status === 'complete' || status === 'error') {
      const timeout = setTimeout(() => {
        onDismiss?.();
      }, status === 'complete' ? 3000 : 5000);
      return () => clearTimeout(timeout);
    }
  }, [status, onDismiss]);

  if (!visible && status === null) return null;

  const getStatusConfig = () => {
    switch (status) {
      case 'downloading':
        return {
          icon: 'cloud-download-outline' as const,
          iconColor: '#00FF88',
          text: `Downloading ${truncateFilename(filename)}...`,
          showProgress: true,
        };
      case 'complete':
        return {
          icon: 'checkmark-circle' as const,
          iconColor: '#00FF88',
          text: 'Download Complete',
          showProgress: false,
        };
      case 'error':
        return {
          icon: 'alert-circle' as const,
          iconColor: '#FF6B6B',
          text: 'Download Failed',
          showProgress: false,
        };
      default:
        return {
          icon: 'cloud-download-outline' as const,
          iconColor: '#00FF88',
          text: 'Starting download...',
          showProgress: false,
        };
    }
  };

  const config = getStatusConfig();
  const isWeb = Platform.OS === 'web';

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  const content = (
    <Animated.View
      style={[
        styles.container,
        { 
          top: insets.top + 60, // Below the unified top bar
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <TouchableOpacity 
        activeOpacity={0.9} 
        onPress={onDismiss}
        style={styles.touchable}
      >
        {isWeb ? (
          <View style={styles.toastContent}>
            <View style={styles.iconContainer}>
              <Ionicons name={config.icon} size={20} color={config.iconColor} />
            </View>
            
            <View style={styles.textContainer}>
              <Text style={styles.statusText} numberOfLines={1}>
                {config.text}
              </Text>
              {status === 'downloading' && (
                <Text style={styles.progressText}>{progress}%</Text>
              )}
            </View>

            {status === 'complete' && (
              <View style={styles.shareHint}>
                <Ionicons name="share-outline" size={16} color="#00FF88" />
              </View>
            )}
          </View>
        ) : (
          <BlurView tint="dark" intensity={80} style={styles.toastContent}>
            <View style={styles.iconContainer}>
              <Ionicons name={config.icon} size={20} color={config.iconColor} />
            </View>
            
            <View style={styles.textContainer}>
              <Text style={styles.statusText} numberOfLines={1}>
                {config.text}
              </Text>
              {status === 'downloading' && (
                <Text style={styles.progressText}>{progress}%</Text>
              )}
            </View>

            {status === 'complete' && (
              <View style={styles.shareHint}>
                <Ionicons name="share-outline" size={16} color="#00FF88" />
              </View>
            )}
          </BlurView>
        )}

        {/* Progress Bar */}
        {config.showProgress && (
          <View style={styles.progressBarContainer}>
            <Animated.View 
              style={[
                styles.progressBar,
                { width: progressWidth }
              ]} 
            />
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );

  return content;
};

/**
 * Truncate filename for display
 */
function truncateFilename(filename: string, maxLength: number = 25): string {
  if (filename.length <= maxLength) return filename;
  
  const ext = filename.lastIndexOf('.');
  if (ext > 0) {
    const name = filename.substring(0, ext);
    const extension = filename.substring(ext);
    const available = maxLength - extension.length - 3; // 3 for "..."
    
    if (available > 5) {
      return name.substring(0, available) + '...' + extension;
    }
  }
  
  return filename.substring(0, maxLength - 3) + '...';
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 1000,
  },
  touchable: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(26, 26, 26, 0.95)',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 255, 136, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    }),
  },
  progressText: {
    color: '#00FF88',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 8,
  },
  shareHint: {
    marginLeft: 12,
    opacity: 0.8,
  },
  progressBarContainer: {
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#00FF88',
    borderRadius: 2,
  },
});

export default DownloadToast;
