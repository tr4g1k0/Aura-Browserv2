/**
 * Download Progress Sheet
 * 
 * Professional bottom sheet showing active downloads with:
 * - File name and type icon
 * - Progress bar with percentage
 * - Download speed (MB/s)
 * - Estimated time remaining
 * - Cancel button
 * - Multiple downloads stacked
 */

import React, { memo, useCallback, useMemo, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useDownloadsStore, ActiveDownload } from '../store/useDownloadsStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Colors
const DEEP_INDIGO = '#0A0A0F';
const CARD_DARK = '#141419';
const AURA_BLUE = '#00F2FF';
const TEXT_WHITE = '#FFFFFF';
const TEXT_MUTED = '#6B7280';
const SUCCESS_GREEN = '#10B981';
const DANGER_RED = '#EF4444';
const WARNING_ORANGE = '#F59E0B';

interface DownloadProgressSheetProps {
  visible: boolean;
  onClose: () => void;
  onOpenDownloads: () => void;
}

// File type icons
const getFileIcon = (filename: string): keyof typeof Ionicons.glyphMap => {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const iconMap: Record<string, keyof typeof Ionicons.glyphMap> = {
    pdf: 'document-text',
    doc: 'document-text', docx: 'document-text',
    xls: 'grid', xlsx: 'grid', csv: 'grid',
    ppt: 'easel', pptx: 'easel',
    jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', webp: 'image',
    mp3: 'musical-notes', wav: 'musical-notes', aac: 'musical-notes', flac: 'musical-notes',
    mp4: 'videocam', mov: 'videocam', avi: 'videocam', mkv: 'videocam', webm: 'videocam',
    zip: 'archive', rar: 'archive', '7z': 'archive',
    apk: 'phone-portrait',
  };
  return iconMap[ext] || 'document';
};

const getFileColor = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const colorMap: Record<string, string> = {
    pdf: '#EF4444', doc: '#3B82F6', docx: '#3B82F6',
    xls: '#10B981', xlsx: '#10B981',
    ppt: '#F59E0B', pptx: '#F59E0B',
    jpg: '#8B5CF6', jpeg: '#8B5CF6', png: '#8B5CF6', gif: '#8B5CF6',
    mp3: '#EC4899', wav: '#EC4899',
    mp4: '#06B6D4', mov: '#06B6D4',
    zip: '#6366F1', rar: '#6366F1',
  };
  return colorMap[ext] || AURA_BLUE;
};

// Individual download item
const DownloadItemComponent: React.FC<{
  download: ActiveDownload;
  onCancel: (url: string) => void;
}> = ({ download, onCancel }) => {
  const [speed, setSpeed] = useState(0);
  const [eta, setEta] = useState<number | null>(null);
  const [prevProgress, setPrevProgress] = useState(0);
  const [prevTime, setPrevTime] = useState(Date.now());

  const icon = getFileIcon(download.filename);
  const iconColor = getFileColor(download.filename);
  const isComplete = download.status === 'complete';
  const isError = download.status === 'error';
  const isDownloading = download.status === 'downloading';

  // Calculate speed and ETA
  useEffect(() => {
    if (isDownloading && download.progress > prevProgress) {
      const now = Date.now();
      const timeDiff = (now - prevTime) / 1000; // seconds
      const progressDiff = download.progress - prevProgress;
      
      if (timeDiff > 0.5) { // Update every 500ms
        // Assuming average file size of 10MB for ETA calculation
        const estimatedTotalBytes = 10 * 1024 * 1024;
        const bytesPerPercent = estimatedTotalBytes / 100;
        const bytesDownloaded = progressDiff * bytesPerPercent;
        const currentSpeed = bytesDownloaded / timeDiff; // bytes/sec
        
        setSpeed(currentSpeed);
        
        // ETA calculation
        const remainingPercent = 100 - download.progress;
        const remainingBytes = remainingPercent * bytesPerPercent;
        const estimatedSeconds = remainingBytes / currentSpeed;
        setEta(Math.ceil(estimatedSeconds));
        
        setPrevProgress(download.progress);
        setPrevTime(now);
      }
    }
  }, [download.progress, isDownloading]);

  const formatSpeed = (bytesPerSec: number): string => {
    if (bytesPerSec < 1024) return `${Math.round(bytesPerSec)} B/s`;
    if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
    return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
  };

  const formatETA = (seconds: number | null): string => {
    if (!seconds || seconds <= 0) return '';
    if (seconds < 60) return `${seconds}s remaining`;
    if (seconds < 3600) return `${Math.ceil(seconds / 60)}m remaining`;
    return `${Math.ceil(seconds / 3600)}h remaining`;
  };

  const handleCancel = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onCancel(download.url);
  }, [download.url, onCancel]);

  return (
    <View style={[styles.downloadItem, isError && styles.downloadItemError]}>
      {/* Icon */}
      <View style={[styles.iconContainer, { backgroundColor: `${iconColor}20` }]}>
        {isComplete ? (
          <Ionicons name="checkmark-circle" size={24} color={SUCCESS_GREEN} />
        ) : isError ? (
          <Ionicons name="alert-circle" size={24} color={DANGER_RED} />
        ) : (
          <Ionicons name={icon} size={24} color={iconColor} />
        )}
      </View>

      {/* Info */}
      <View style={styles.infoContainer}>
        <Text style={styles.filename} numberOfLines={1}>
          {download.filename}
        </Text>
        
        <View style={styles.statsRow}>
          {isComplete ? (
            <Text style={[styles.statusText, { color: SUCCESS_GREEN }]}>
              Download complete
            </Text>
          ) : isError ? (
            <Text style={[styles.statusText, { color: DANGER_RED }]}>
              {download.error || 'Download failed'}
            </Text>
          ) : (
            <>
              <Text style={styles.percentText}>{download.progress}%</Text>
              {speed > 0 && (
                <>
                  <Text style={styles.dot}>•</Text>
                  <Text style={styles.speedText}>{formatSpeed(speed)}</Text>
                </>
              )}
              {eta && eta > 0 && (
                <>
                  <Text style={styles.dot}>•</Text>
                  <Text style={styles.etaText}>{formatETA(eta)}</Text>
                </>
              )}
            </>
          )}
        </View>

        {/* Progress bar */}
        {isDownloading && (
          <View style={styles.progressBarBg}>
            <View 
              style={[
                styles.progressBarFill, 
                { width: `${download.progress}%` }
              ]} 
            />
          </View>
        )}
      </View>

      {/* Cancel/Retry button */}
      {isDownloading && (
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={handleCancel}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={20} color={TEXT_MUTED} />
        </TouchableOpacity>
      )}
    </View>
  );
};

const DownloadItem = memo(DownloadItemComponent);

// Main component
const DownloadProgressSheetComponent: React.FC<DownloadProgressSheetProps> = ({
  visible,
  onClose,
  onOpenDownloads,
}) => {
  const insets = useSafeAreaInsets();
  const activeDownloads = useDownloadsStore((s) => s.activeDownloads);
  const downloads = useMemo(
    () => Object.values(activeDownloads).sort((a, b) => b.startedAt - a.startedAt),
    [activeDownloads]
  );

  const handleCancel = useCallback((url: string) => {
    // Import downloadManager dynamically to avoid circular deps
    import('../services/FileDownloadManager').then(({ downloadManager }) => {
      downloadManager.cancelDownload(url);
    });
  }, []);

  const handleViewAll = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
    onOpenDownloads();
  }, [onClose, onOpenDownloads]);

  if (!visible || downloads.length === 0) return null;

  const hasActive = downloads.some(d => d.status === 'downloading' || d.status === 'starting');
  const completedCount = downloads.filter(d => d.status === 'complete').length;

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + 16 }]}>
      <BlurView intensity={90} tint="dark" style={styles.blurContainer}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.headerIconContainer}>
              <Ionicons 
                name={hasActive ? "cloud-download" : "checkmark-done"} 
                size={20} 
                color={hasActive ? AURA_BLUE : SUCCESS_GREEN} 
              />
            </View>
            <Text style={styles.headerTitle}>
              {hasActive 
                ? `Downloading ${downloads.filter(d => d.status === 'downloading').length} file${downloads.filter(d => d.status === 'downloading').length > 1 ? 's' : ''}`
                : `${completedCount} download${completedCount > 1 ? 's' : ''} complete`
              }
            </Text>
          </View>
          
          <TouchableOpacity
            style={styles.viewAllButton}
            onPress={handleViewAll}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.viewAllText}>View All</Text>
            <Ionicons name="chevron-forward" size={16} color={AURA_BLUE} />
          </TouchableOpacity>
        </View>

        {/* Downloads list */}
        <View style={styles.listContainer}>
          {downloads.slice(0, 3).map((download) => (
            <DownloadItem
              key={download.id}
              download={download}
              onCancel={handleCancel}
            />
          ))}
          
          {downloads.length > 3 && (
            <TouchableOpacity style={styles.moreButton} onPress={handleViewAll}>
              <Text style={styles.moreText}>
                +{downloads.length - 3} more download{downloads.length - 3 > 1 ? 's' : ''}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Close handle */}
        <TouchableOpacity style={styles.closeHandle} onPress={onClose}>
          <View style={styles.handleBar} />
        </TouchableOpacity>
      </BlurView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1001,
  },
  blurContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    backgroundColor: 'rgba(10, 10, 15, 0.95)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 242, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_WHITE,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: AURA_BLUE,
    marginRight: 4,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  downloadItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_DARK,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  downloadItemError: {
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoContainer: {
    flex: 1,
    marginRight: 8,
  },
  filename: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_WHITE,
    marginBottom: 4,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  percentText: {
    fontSize: 12,
    fontWeight: '700',
    color: AURA_BLUE,
  },
  dot: {
    fontSize: 12,
    color: TEXT_MUTED,
    marginHorizontal: 6,
  },
  speedText: {
    fontSize: 12,
    color: TEXT_MUTED,
  },
  etaText: {
    fontSize: 12,
    color: TEXT_MUTED,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  progressBarBg: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    marginTop: 8,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: AURA_BLUE,
    borderRadius: 2,
  },
  cancelButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreButton: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  moreText: {
    fontSize: 13,
    fontWeight: '600',
    color: AURA_BLUE,
  },
  closeHandle: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
});

export const DownloadProgressSheet = memo(DownloadProgressSheetComponent);

export default DownloadProgressSheet;
