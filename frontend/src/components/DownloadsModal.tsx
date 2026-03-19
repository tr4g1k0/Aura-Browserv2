/**
 * Downloads Modal - Aura Browser Downloads Manager
 * 
 * A full-screen modal displaying all downloaded files with:
 * - File list with icons based on file type
 * - Tap to open/share files
 * - Swipe or button to delete
 * - Aura aesthetic (deep indigo background)
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { 
  FadeIn, 
  FadeInDown,
  FadeOut,
  SlideInRight,
  SlideOutRight,
  Layout,
} from 'react-native-reanimated';

// Colors - Aura Aesthetic
const DEEP_INDIGO = '#0A0A0F';
const CARD_DARK = '#141419';
const AURA_BLUE = '#00F2FF';
const TEXT_WHITE = '#FFFFFF';
const TEXT_MUTED = '#6B7280';
const DANGER_RED = '#EF4444';
const SUCCESS_GREEN = '#10B981';

// Storage key for downloads list
const DOWNLOADS_STORAGE_KEY = '@aura_downloads_list';

// Download item interface
export interface DownloadItem {
  id: string;
  filename: string;
  uri: string;
  date: string;
  size?: number;
  mimeType?: string;
}

interface DownloadsModalProps {
  visible: boolean;
  onClose: () => void;
}

// Get file icon based on extension
const getFileIcon = (filename: string): keyof typeof Ionicons.glyphMap => {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  
  const iconMap: Record<string, keyof typeof Ionicons.glyphMap> = {
    // Documents
    pdf: 'document-text',
    doc: 'document-text',
    docx: 'document-text',
    txt: 'document-text',
    rtf: 'document-text',
    // Spreadsheets
    xls: 'grid',
    xlsx: 'grid',
    csv: 'grid',
    // Presentations
    ppt: 'easel',
    pptx: 'easel',
    // Images
    jpg: 'image',
    jpeg: 'image',
    png: 'image',
    gif: 'image',
    webp: 'image',
    svg: 'image',
    // Audio
    mp3: 'musical-notes',
    wav: 'musical-notes',
    aac: 'musical-notes',
    flac: 'musical-notes',
    // Video
    mp4: 'videocam',
    mov: 'videocam',
    avi: 'videocam',
    mkv: 'videocam',
    // Archives
    zip: 'archive',
    rar: 'archive',
    '7z': 'archive',
    tar: 'archive',
    // Code/Data
    json: 'code-slash',
    xml: 'code-slash',
    // Default
    default: 'document',
  };
  
  return iconMap[ext] || iconMap.default;
};

// Get file color based on type
const getFileColor = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  
  const colorMap: Record<string, string> = {
    pdf: '#EF4444',
    doc: '#3B82F6',
    docx: '#3B82F6',
    xls: '#10B981',
    xlsx: '#10B981',
    ppt: '#F59E0B',
    pptx: '#F59E0B',
    jpg: '#8B5CF6',
    jpeg: '#8B5CF6',
    png: '#8B5CF6',
    gif: '#8B5CF6',
    mp3: '#EC4899',
    mp4: '#06B6D4',
    zip: '#6366F1',
  };
  
  return colorMap[ext] || AURA_BLUE;
};

// Format file size
const formatFileSize = (bytes?: number): string => {
  if (!bytes) return '';
  
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

// Format date
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
};

// Download Item Component
const DownloadItemRow: React.FC<{
  item: DownloadItem;
  onPress: () => void;
  onDelete: () => void;
}> = ({ item, onPress, onDelete }) => {
  const icon = getFileIcon(item.filename);
  const iconColor = getFileColor(item.filename);
  
  return (
    <Animated.View
      entering={FadeInDown.duration(300)}
      exiting={FadeOut.duration(200)}
      layout={Layout.springify()}
    >
      <TouchableOpacity
        style={styles.downloadItem}
        onPress={onPress}
        activeOpacity={0.7}
      >
        {/* File Icon */}
        <View style={[styles.fileIconContainer, { backgroundColor: `${iconColor}20` }]}>
          <Ionicons name={icon} size={24} color={iconColor} />
        </View>
        
        {/* File Info */}
        <View style={styles.fileInfo}>
          <Text style={styles.fileName} numberOfLines={1}>
            {item.filename}
          </Text>
          <View style={styles.fileMeta}>
            <Text style={styles.fileDate}>{formatDate(item.date)}</Text>
            {item.size && (
              <>
                <Text style={styles.metaDot}>•</Text>
                <Text style={styles.fileSize}>{formatFileSize(item.size)}</Text>
              </>
            )}
          </View>
        </View>
        
        {/* Delete Button */}
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="trash-outline" size={20} color={DANGER_RED} />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
};

// Empty State Component
const EmptyState: React.FC = () => (
  <View style={styles.emptyState}>
    <Ionicons name="download-outline" size={64} color={TEXT_MUTED} />
    <Text style={styles.emptyTitle}>No Downloads Yet</Text>
    <Text style={styles.emptySubtitle}>
      Files you download will appear here
    </Text>
  </View>
);

// Main Downloads Modal Component
export const DownloadsModal: React.FC<DownloadsModalProps> = ({
  visible,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Load downloads from storage
  const loadDownloads = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(DOWNLOADS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as DownloadItem[];
        
        // Verify files still exist
        const validDownloads: DownloadItem[] = [];
        for (const item of parsed) {
          try {
            const info = await FileSystem.getInfoAsync(item.uri);
            if (info.exists) {
              validDownloads.push({
                ...item,
                size: info.size,
              });
            }
          } catch {
            // File doesn't exist, skip
          }
        }
        
        setDownloads(validDownloads);
        
        // Update storage if some files were removed
        if (validDownloads.length !== parsed.length) {
          await AsyncStorage.setItem(DOWNLOADS_STORAGE_KEY, JSON.stringify(validDownloads));
        }
      }
    } catch (error) {
      console.error('[DownloadsModal] Failed to load downloads:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Load downloads when modal becomes visible
  useEffect(() => {
    if (visible) {
      setIsLoading(true);
      loadDownloads();
    }
  }, [visible, loadDownloads]);

  // Handle file open/share
  const handleOpenFile = useCallback(async (item: DownloadItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    try {
      // Check if sharing is available
      const isAvailable = await Sharing.isAvailableAsync();
      
      if (!isAvailable) {
        Alert.alert('Sharing Not Available', 'Unable to open files on this device.');
        return;
      }
      
      await Sharing.shareAsync(item.uri, {
        dialogTitle: `Open ${item.filename}`,
      });
    } catch (error) {
      console.error('[DownloadsModal] Failed to open file:', error);
      Alert.alert('Error', 'Failed to open file. It may have been moved or deleted.');
    }
  }, []);

  // Handle file delete
  const handleDeleteFile = useCallback(async (item: DownloadItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    Alert.alert(
      'Delete Download',
      `Are you sure you want to delete "${item.filename}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete file
              await FileSystem.deleteAsync(item.uri, { idempotent: true });
              
              // Update state
              const updatedDownloads = downloads.filter(d => d.id !== item.id);
              setDownloads(updatedDownloads);
              
              // Update storage
              await AsyncStorage.setItem(DOWNLOADS_STORAGE_KEY, JSON.stringify(updatedDownloads));
              
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (error) {
              console.error('[DownloadsModal] Failed to delete file:', error);
              Alert.alert('Error', 'Failed to delete file.');
            }
          },
        },
      ]
    );
  }, [downloads]);

  // Handle clear all downloads
  const handleClearAll = useCallback(() => {
    if (downloads.length === 0) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    Alert.alert(
      'Clear All Downloads',
      'Are you sure you want to delete all downloaded files?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete all files
              for (const item of downloads) {
                await FileSystem.deleteAsync(item.uri, { idempotent: true });
              }
              
              // Clear state and storage
              setDownloads([]);
              await AsyncStorage.setItem(DOWNLOADS_STORAGE_KEY, JSON.stringify([]));
              
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (error) {
              console.error('[DownloadsModal] Failed to clear downloads:', error);
            }
          },
        },
      ]
    );
  }, [downloads]);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadDownloads();
  }, [loadDownloads]);

  const isWeb = Platform.OS === 'web';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={28} color={TEXT_WHITE} />
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>Downloads</Text>
          
          {downloads.length > 0 && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={handleClearAll}
              activeOpacity={0.7}
            >
              <Text style={styles.clearButtonText}>Clear All</Text>
            </TouchableOpacity>
          )}
        </View>
        
        {/* Downloads Count */}
        {downloads.length > 0 && (
          <Animated.View entering={FadeIn.delay(200)} style={styles.countContainer}>
            <Text style={styles.countText}>
              {downloads.length} {downloads.length === 1 ? 'file' : 'files'}
            </Text>
          </Animated.View>
        )}
        
        {/* Content */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={AURA_BLUE} />
          </View>
        ) : downloads.length === 0 ? (
          <EmptyState />
        ) : (
          <FlatList
            data={downloads}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <DownloadItemRow
                item={item}
                onPress={() => handleOpenFile(item)}
                onDelete={() => handleDeleteFile(item)}
              />
            )}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: insets.bottom + 20 },
            ]}
            showsVerticalScrollIndicator={false}
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
          />
        )}
      </View>
    </Modal>
  );
};

// ============================================================
// DOWNLOADS MANAGER UTILITY FUNCTIONS
// ============================================================

/**
 * Add a new download to the list (call after download completes)
 */
export const addDownloadToList = async (
  filename: string,
  uri: string,
  size?: number
): Promise<void> => {
  try {
    const stored = await AsyncStorage.getItem(DOWNLOADS_STORAGE_KEY);
    const downloads: DownloadItem[] = stored ? JSON.parse(stored) : [];
    
    const newItem: DownloadItem = {
      id: `download_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      filename,
      uri,
      date: new Date().toISOString(),
      size,
    };
    
    // Add to beginning of list (most recent first)
    downloads.unshift(newItem);
    
    // Keep only last 100 downloads in the list
    const trimmed = downloads.slice(0, 100);
    
    await AsyncStorage.setItem(DOWNLOADS_STORAGE_KEY, JSON.stringify(trimmed));
    console.log('[DownloadsManager] Added download to list:', filename);
  } catch (error) {
    console.error('[DownloadsManager] Failed to add download:', error);
  }
};

/**
 * Get the current downloads list
 */
export const getDownloadsList = async (): Promise<DownloadItem[]> => {
  try {
    const stored = await AsyncStorage.getItem(DOWNLOADS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DEEP_INDIGO,
  },
  
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: TEXT_WHITE,
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    }),
  },
  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: DANGER_RED,
  },
  
  // Count
  countContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  countText: {
    fontSize: 13,
    fontWeight: '500',
    color: TEXT_MUTED,
  },
  
  // Loading
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // List
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  
  // Download Item
  downloadItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_DARK,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  fileIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  fileInfo: {
    flex: 1,
    marginRight: 12,
  },
  fileName: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_WHITE,
    marginBottom: 4,
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    }),
  },
  fileMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fileDate: {
    fontSize: 12,
    color: TEXT_MUTED,
  },
  metaDot: {
    fontSize: 12,
    color: TEXT_MUTED,
    marginHorizontal: 6,
  },
  fileSize: {
    fontSize: 12,
    color: TEXT_MUTED,
  },
  deleteButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  
  // Empty State
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: TEXT_WHITE,
    marginTop: 20,
    marginBottom: 8,
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    }),
  },
  emptySubtitle: {
    fontSize: 14,
    color: TEXT_MUTED,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default DownloadsModal;
