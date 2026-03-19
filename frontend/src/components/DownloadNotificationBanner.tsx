/**
 * DownloadNotificationBanner - Persistent floating banner
 * Shows when downloads are active and the DownloadsModal is closed.
 * Tap to open the Downloads modal. Auto-hides when all downloads complete.
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDownloadsStore } from '../store/useDownloadsStore';

const AURA_BLUE = '#00F2FF';
const SUCCESS_GREEN = '#10B981';
const DANGER_RED = '#EF4444';

interface DownloadNotificationBannerProps {
  downloadsModalVisible: boolean;
  onOpenDownloads: () => void;
}

export const DownloadNotificationBanner: React.FC<DownloadNotificationBannerProps> = ({
  downloadsModalVisible,
  onOpenDownloads,
}) => {
  const insets = useSafeAreaInsets();
  const activeDownloads = useDownloadsStore((s) => s.activeDownloads);
  const slideAnim = useRef(new Animated.Value(-80)).current;

  const items = Object.values(activeDownloads);
  const inProgress = items.filter((d) => d.status === 'downloading' || d.status === 'starting');
  const completed = items.filter((d) => d.status === 'complete');
  const failed = items.filter((d) => d.status === 'error');
  const hasActive = items.length > 0;
  const shouldShow = hasActive && !downloadsModalVisible;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: shouldShow ? 0 : -80,
      useNativeDriver: true,
      damping: 18,
      stiffness: 140,
    }).start();
  }, [shouldShow]);

  if (!hasActive) return null;

  // Compute aggregate progress
  const avgProgress = inProgress.length > 0
    ? Math.round(inProgress.reduce((s, d) => s + d.progress, 0) / inProgress.length)
    : completed.length > 0 ? 100 : 0;

  let label = '';
  let iconName: keyof typeof Ionicons.glyphMap = 'cloud-download-outline';
  let iconColor = AURA_BLUE;

  if (inProgress.length > 0) {
    label = inProgress.length === 1
      ? `Downloading ${truncate(inProgress[0].filename, 20)}... ${avgProgress}%`
      : `Downloading ${inProgress.length} files... ${avgProgress}%`;
    iconName = 'cloud-download-outline';
    iconColor = AURA_BLUE;
  } else if (failed.length > 0 && completed.length === 0) {
    label = `${failed.length} download${failed.length > 1 ? 's' : ''} failed`;
    iconName = 'alert-circle-outline';
    iconColor = DANGER_RED;
  } else if (completed.length > 0) {
    label = `${completed.length} download${completed.length > 1 ? 's' : ''} complete`;
    iconName = 'checkmark-circle-outline';
    iconColor = SUCCESS_GREEN;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        { top: insets.top + 60, transform: [{ translateY: slideAnim }] },
      ]}
      pointerEvents="box-none"
    >
      <TouchableOpacity
        style={styles.banner}
        activeOpacity={0.85}
        onPress={onOpenDownloads}
        data-testid="download-notification-banner"
      >
        <View style={[styles.iconCircle, { backgroundColor: `${iconColor}18` }]}>
          <Ionicons name={iconName} size={18} color={iconColor} />
        </View>
        <Text style={styles.label} numberOfLines={1}>{label}</Text>
        {inProgress.length > 0 && (
          <View style={styles.progressOuter}>
            <View style={[styles.progressInner, { width: `${avgProgress}%` }]} />
          </View>
        )}
        <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.4)" style={{ marginLeft: 8 }} />
      </TouchableOpacity>
    </Animated.View>
  );
};

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  const ext = s.lastIndexOf('.');
  if (ext > 0 && s.length - ext <= 6) {
    const available = max - (s.length - ext) - 3;
    if (available > 3) return s.substring(0, available) + '...' + s.substring(ext);
  }
  return s.substring(0, max - 3) + '...';
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 999,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(20, 20, 28, 0.96)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
      },
      android: { elevation: 8 },
    }),
  },
  iconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  label: {
    flex: 1,
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    }),
  },
  progressOuter: {
    width: 40,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
    marginLeft: 8,
  },
  progressInner: {
    height: '100%',
    backgroundColor: '#00F2FF',
    borderRadius: 2,
  },
});

export default DownloadNotificationBanner;
