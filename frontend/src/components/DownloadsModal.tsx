/**
 * Downloads Modal - Aura Browser Downloads Manager
 * 
 * Features:
 * - Active downloads with live progress bars
 * - Search bar to filter by filename
 * - Filter chips by file type (All, Docs, Images, Audio, Video, Archives)
 * - Batch select mode for bulk delete
 * - AUTO-CATEGORIZATION: Group-by-Category view with collapsible section headers
 * - Tap to open/share files, delete individual/bulk
 * - Aura aesthetic (deep indigo background)
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  SectionList,
  Modal,
  Platform,
  Alert,
  ActivityIndicator,
  TextInput,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  Layout,
} from 'react-native-reanimated';
import { useDownloadsStore, ActiveDownload } from '../store/useDownloadsStore';
import {
  getCategoryForFile,
  DownloadCategory,
  CATEGORY_ICONS,
  CATEGORY_COLORS,
} from '../services/FileDownloadManager';

// Colors
const DEEP_INDIGO = '#0A0A0F';
const CARD_DARK = '#141419';
const CARD_ACTIVE = '#1A1A24';
const AURA_BLUE = '#00F2FF';
const TEXT_WHITE = '#FFFFFF';
const TEXT_MUTED = '#6B7280';
const DANGER_RED = '#EF4444';
const SUCCESS_GREEN = '#10B981';
const SEARCH_BG = '#1C1C26';
const CHIP_BG = '#1C1C26';
const CHIP_ACTIVE_BG = 'rgba(0, 242, 255, 0.15)';

const DOWNLOADS_STORAGE_KEY = '@aura_downloads_list';

// Download item interface — now includes category
export interface DownloadItem {
  id: string;
  filename: string;
  uri: string;
  date: string;
  size?: number;
  mimeType?: string;
  category?: DownloadCategory;
}

interface DownloadsModalProps {
  visible: boolean;
  onClose: () => void;
}

// File type filter categories
type FileCategory = 'all' | 'documents' | 'images' | 'audio' | 'video' | 'archives';

const FILE_CATEGORIES: { key: FileCategory; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'all', label: 'All', icon: 'apps-outline' },
  { key: 'documents', label: 'Docs', icon: 'document-text-outline' },
  { key: 'images', label: 'Images', icon: 'image-outline' },
  { key: 'audio', label: 'Audio', icon: 'musical-notes-outline' },
  { key: 'video', label: 'Video', icon: 'videocam-outline' },
  { key: 'archives', label: 'Archives', icon: 'archive-outline' },
];

const CATEGORY_EXTENSIONS: Record<FileCategory, string[]> = {
  all: [],
  documents: ['pdf', 'doc', 'docx', 'txt', 'rtf', 'xls', 'xlsx', 'csv', 'ppt', 'pptx', 'json', 'xml'],
  images: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'heic'],
  audio: ['mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a'],
  video: ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v'],
  archives: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2'],
};

// ============================================================
// UTILS
// ============================================================
const getFileIcon = (filename: string): keyof typeof Ionicons.glyphMap => {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const iconMap: Record<string, keyof typeof Ionicons.glyphMap> = {
    pdf: 'document-text', doc: 'document-text', docx: 'document-text', txt: 'document-text', rtf: 'document-text',
    xls: 'grid', xlsx: 'grid', csv: 'grid',
    ppt: 'easel', pptx: 'easel',
    jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', webp: 'image', svg: 'image',
    mp3: 'musical-notes', wav: 'musical-notes', aac: 'musical-notes', flac: 'musical-notes',
    mp4: 'videocam', mov: 'videocam', avi: 'videocam', mkv: 'videocam',
    zip: 'archive', rar: 'archive', '7z': 'archive', tar: 'archive',
    json: 'code-slash', xml: 'code-slash',
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
    mp3: '#EC4899', mp4: '#06B6D4', zip: '#6366F1',
  };
  return colorMap[ext] || AURA_BLUE;
};

const formatFileSize = (bytes?: number): string => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

// ============================================================
// ACTIVE DOWNLOAD ROW
// ============================================================
const ActiveDownloadRow: React.FC<{ item: ActiveDownload }> = ({ item }) => {
  const icon = getFileIcon(item.filename);
  const iconColor = getFileColor(item.filename);
  const isComplete = item.status === 'complete';
  const isError = item.status === 'error';

  return (
    <Animated.View entering={FadeInDown.duration(250)} exiting={FadeOut.duration(200)}>
      <View style={[styles.downloadItem, { backgroundColor: CARD_ACTIVE, borderWidth: 1, borderColor: isError ? 'rgba(239,68,68,0.3)' : 'rgba(0,242,255,0.15)' }]}>
        <View style={[styles.fileIconContainer, { backgroundColor: `${iconColor}20` }]}>
          {isComplete ? (
            <Ionicons name="checkmark-circle" size={24} color={SUCCESS_GREEN} />
          ) : isError ? (
            <Ionicons name="alert-circle" size={24} color={DANGER_RED} />
          ) : (
            <ActivityIndicator size="small" color={iconColor} />
          )}
        </View>
        <View style={styles.fileInfo}>
          <Text style={styles.fileName} numberOfLines={1}>{item.filename}</Text>
          <View style={styles.fileMeta}>
            <Text style={[styles.fileDate, isError && { color: DANGER_RED }]}>
              {isError ? 'Failed' : isComplete ? 'Complete' : `${item.progress}%`}
            </Text>
          </View>
          {!isComplete && !isError && (
            <View style={styles.progressBarBg}>
              <Animated.View style={[styles.progressBarFill, { width: `${item.progress}%` }]} />
            </View>
          )}
        </View>
      </View>
    </Animated.View>
  );
};

// ============================================================
// COMPLETED DOWNLOAD ROW
// ============================================================
const DownloadItemRow: React.FC<{
  item: DownloadItem;
  onPress: () => void;
  onDelete: () => void;
  isSelected: boolean;
  isBatchMode: boolean;
  onToggleSelect: () => void;
  showCategory?: boolean;
}> = ({ item, onPress, onDelete, isSelected, isBatchMode, onToggleSelect, showCategory }) => {
  const icon = getFileIcon(item.filename);
  const iconColor = getFileColor(item.filename);
  const cat = item.category || getCategoryForFile(item.filename);

  return (
    <Animated.View entering={FadeInDown.duration(300)} exiting={FadeOut.duration(200)} layout={Layout.springify()}>
      <TouchableOpacity
        style={[styles.downloadItem, isSelected && styles.downloadItemSelected]}
        onPress={isBatchMode ? onToggleSelect : onPress}
        onLongPress={onToggleSelect}
        activeOpacity={0.7}
        data-testid={`download-item-${item.id}`}
      >
        {isBatchMode && (
          <TouchableOpacity style={styles.checkboxContainer} onPress={onToggleSelect}>
            <Ionicons
              name={isSelected ? 'checkbox' : 'square-outline'}
              size={22}
              color={isSelected ? AURA_BLUE : TEXT_MUTED}
            />
          </TouchableOpacity>
        )}
        <View style={[styles.fileIconContainer, { backgroundColor: `${iconColor}20` }]}>
          <Ionicons name={icon} size={24} color={iconColor} />
        </View>
        <View style={styles.fileInfo}>
          <Text style={styles.fileName} numberOfLines={1}>{item.filename}</Text>
          <View style={styles.fileMeta}>
            {showCategory && (
              <>
                <View style={[styles.categoryBadge, { backgroundColor: `${CATEGORY_COLORS[cat]}20` }]}>
                  <Text style={[styles.categoryBadgeText, { color: CATEGORY_COLORS[cat] }]}>{cat}</Text>
                </View>
                <Text style={styles.metaDot}>•</Text>
              </>
            )}
            <Text style={styles.fileDate}>{formatDate(item.date)}</Text>
            {item.size ? (
              <>
                <Text style={styles.metaDot}>•</Text>
                <Text style={styles.fileSize}>{formatFileSize(item.size)}</Text>
              </>
            ) : null}
          </View>
        </View>
        {!isBatchMode && (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={(e) => { e.stopPropagation(); onDelete(); }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="trash-outline" size={20} color={DANGER_RED} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

// ============================================================
// CATEGORY SECTION HEADER (for grouped view)
// ============================================================
const CategorySectionHeader: React.FC<{
  category: DownloadCategory;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
}> = ({ category, count, collapsed, onToggle }) => {
  const color = CATEGORY_COLORS[category];
  const icon = CATEGORY_ICONS[category] as keyof typeof Ionicons.glyphMap;
  return (
    <TouchableOpacity style={styles.sectionHeader} onPress={onToggle} activeOpacity={0.7} data-testid={`category-header-${category}`}>
      <View style={[styles.sectionHeaderIcon, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <Text style={styles.sectionHeaderTitle}>{category}</Text>
      <View style={styles.sectionHeaderRight}>
        <Text style={[styles.sectionHeaderCount, { color }]}>{count}</Text>
        <Ionicons
          name={collapsed ? 'chevron-forward' : 'chevron-down'}
          size={16}
          color={TEXT_MUTED}
          style={{ marginLeft: 4 }}
        />
      </View>
    </TouchableOpacity>
  );
};

// Empty State
const EmptyState: React.FC<{ hasFilter: boolean }> = ({ hasFilter }) => (
  <View style={styles.emptyState}>
    <Ionicons name={hasFilter ? 'search-outline' : 'download-outline'} size={64} color={TEXT_MUTED} />
    <Text style={styles.emptyTitle}>{hasFilter ? 'No Matches' : 'No Downloads Yet'}</Text>
    <Text style={styles.emptySubtitle}>
      {hasFilter ? 'Try a different search or filter' : 'Files you download will appear here'}
    </Text>
  </View>
);

// ============================================================
// MAIN MODAL
// ============================================================
export const DownloadsModal: React.FC<DownloadsModalProps> = ({ visible, onClose }) => {
  const insets = useSafeAreaInsets();
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Search & filter
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FileCategory>('all');

  // View mode: list (flat) or grouped (by category)
  const [isGrouped, setIsGrouped] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<DownloadCategory>>(new Set());

  // Batch select
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Active downloads from store
  const activeDownloads = useDownloadsStore((s) => s.activeDownloads);
  const activeList = useMemo(() => Object.values(activeDownloads).sort((a, b) => b.startedAt - a.startedAt), [activeDownloads]);

  // Filtered downloads
  const filteredDownloads = useMemo(() => {
    let list = downloads;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((d) => d.filename.toLowerCase().includes(q));
    }
    if (activeFilter !== 'all') {
      const exts = CATEGORY_EXTENSIONS[activeFilter];
      list = list.filter((d) => {
        const ext = d.filename.split('.').pop()?.toLowerCase() || '';
        return exts.includes(ext);
      });
    }
    return list;
  }, [downloads, searchQuery, activeFilter]);

  // Grouped sections for SectionList
  const groupedSections = useMemo(() => {
    const groups: Record<DownloadCategory, DownloadItem[]> = {
      Documents: [], Images: [], Media: [], Archives: [], Other: [],
    };
    for (const item of filteredDownloads) {
      const cat = item.category || getCategoryForFile(item.filename);
      groups[cat].push(item);
    }
    return (Object.entries(groups) as [DownloadCategory, DownloadItem[]][])
      .filter(([, items]) => items.length > 0)
      .map(([cat, items]) => ({ title: cat, data: collapsedCategories.has(cat) ? [] : items, count: items.length }));
  }, [filteredDownloads, collapsedCategories]);

  const hasFilter = searchQuery.trim().length > 0 || activeFilter !== 'all';

  // Load downloads from storage
  const loadDownloads = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(DOWNLOADS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as DownloadItem[];
        const validDownloads: DownloadItem[] = [];
        for (const item of parsed) {
          try {
            const info = await FileSystem.getInfoAsync(item.uri);
            if (info.exists) {
              // Backfill category for legacy items that don't have it
              const category = item.category || getCategoryForFile(item.filename);
              validDownloads.push({ ...item, size: info.size, category });
            }
          } catch {
            // File gone, skip
          }
        }
        setDownloads(validDownloads);
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

  useEffect(() => {
    if (visible) {
      setIsLoading(true);
      setSearchQuery('');
      setActiveFilter('all');
      setIsBatchMode(false);
      setSelectedIds(new Set());
      loadDownloads();
    }
  }, [visible, loadDownloads]);

  // Handle file open/share
  const handleOpenFile = useCallback(async (item: DownloadItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Sharing Not Available', 'Unable to open files on this device.');
        return;
      }
      await Sharing.shareAsync(item.uri, { dialogTitle: `Open ${item.filename}` });
    } catch {
      Alert.alert('Error', 'Failed to open file. It may have been moved or deleted.');
    }
  }, []);

  // Handle single delete
  const handleDeleteFile = useCallback(async (item: DownloadItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Delete Download', `Delete "${item.filename}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await FileSystem.deleteAsync(item.uri, { idempotent: true });
            const updated = downloads.filter((d) => d.id !== item.id);
            setDownloads(updated);
            await AsyncStorage.setItem(DOWNLOADS_STORAGE_KEY, JSON.stringify(updated));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch {
            Alert.alert('Error', 'Failed to delete file.');
          }
        },
      },
    ]);
  }, [downloads]);

  // Batch delete
  const handleBatchDelete = useCallback(() => {
    if (selectedIds.size === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Delete Selected',
      `Delete ${selectedIds.size} file${selectedIds.size > 1 ? 's' : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              for (const item of downloads) {
                if (selectedIds.has(item.id)) {
                  await FileSystem.deleteAsync(item.uri, { idempotent: true });
                }
              }
              const updated = downloads.filter((d) => !selectedIds.has(d.id));
              setDownloads(updated);
              await AsyncStorage.setItem(DOWNLOADS_STORAGE_KEY, JSON.stringify(updated));
              setSelectedIds(new Set());
              setIsBatchMode(false);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch {
              Alert.alert('Error', 'Failed to delete some files.');
            }
          },
        },
      ]
    );
  }, [downloads, selectedIds]);

  // Clear all
  const handleClearAll = useCallback(() => {
    if (downloads.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Clear All Downloads', 'Delete all downloaded files?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear All', style: 'destructive',
        onPress: async () => {
          try {
            for (const item of downloads) {
              await FileSystem.deleteAsync(item.uri, { idempotent: true });
            }
            setDownloads([]);
            await AsyncStorage.setItem(DOWNLOADS_STORAGE_KEY, JSON.stringify([]));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch {
            console.error('[DownloadsModal] Clear all failed');
          }
        },
      },
    ]);
  }, [downloads]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadDownloads();
  }, [loadDownloads]);

  const toggleSelect = useCallback((id: string) => {
    Haptics.selectionAsync();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    if (!isBatchMode) setIsBatchMode(true);
  }, [isBatchMode]);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(filteredDownloads.map((d) => d.id)));
  }, [filteredDownloads]);

  const exitBatchMode = useCallback(() => {
    setIsBatchMode(false);
    setSelectedIds(new Set());
  }, []);

  const toggleCategoryCollapse = useCallback((cat: DownloadCategory) => {
    Haptics.selectionAsync();
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  }, []);

  // ============================================================
  // RENDER HELPERS
  // ============================================================
  const renderListHeader = () => (
    <>
      {/* Active Downloads Section */}
      {activeList.length > 0 && (
        <View style={styles.activeSection}>
          <Text style={styles.sectionLabel}>ACTIVE DOWNLOADS</Text>
          {activeList.map((dl) => <ActiveDownloadRow key={dl.id} item={dl} />)}
        </View>
      )}

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={18} color={TEXT_MUTED} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search downloads..."
          placeholderTextColor={TEXT_MUTED}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
          data-testid="downloads-search-input"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={18} color={TEXT_MUTED} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Chips + Group Toggle */}
      <View style={styles.filterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          {FILE_CATEGORIES.map((cat) => {
            const isActive = activeFilter === cat.key;
            return (
              <TouchableOpacity
                key={cat.key}
                style={[styles.chip, isActive && styles.chipActive]}
                onPress={() => setActiveFilter(cat.key)}
                data-testid={`filter-chip-${cat.key}`}
              >
                <Ionicons name={cat.icon} size={14} color={isActive ? AURA_BLUE : TEXT_MUTED} style={{ marginRight: 4 }} />
                <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{cat.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        {/* Group toggle */}
        <TouchableOpacity
          style={[styles.groupToggle, isGrouped && styles.groupToggleActive]}
          onPress={() => { Haptics.selectionAsync(); setIsGrouped(!isGrouped); }}
          data-testid="toggle-group-view"
        >
          <Ionicons name={isGrouped ? 'folder-open' : 'folder-outline'} size={16} color={isGrouped ? AURA_BLUE : TEXT_MUTED} />
        </TouchableOpacity>
      </View>

      {/* Count / Batch bar */}
      {filteredDownloads.length > 0 && (
        <View style={styles.countRow}>
          {isBatchMode ? (
            <View style={styles.batchBar}>
              <TouchableOpacity onPress={exitBatchMode} style={styles.batchBtn}>
                <Text style={styles.batchBtnText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.countText}>{selectedIds.size} selected</Text>
              <TouchableOpacity onPress={selectAll} style={styles.batchBtn}>
                <Text style={[styles.batchBtnText, { color: AURA_BLUE }]}>Select All</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.countText}>
              {filteredDownloads.length} {filteredDownloads.length === 1 ? 'file' : 'files'}
              {isGrouped ? ` in ${groupedSections.length} ${groupedSections.length === 1 ? 'category' : 'categories'}` : ''}
            </Text>
          )}
        </View>
      )}
    </>
  );

  const renderItem = ({ item }: { item: DownloadItem }) => (
    <DownloadItemRow
      item={item}
      onPress={() => handleOpenFile(item)}
      onDelete={() => handleDeleteFile(item)}
      isSelected={selectedIds.has(item.id)}
      isBatchMode={isBatchMode}
      onToggleSelect={() => toggleSelect(item.id)}
      showCategory={!isGrouped}
    />
  );

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.7} data-testid="downloads-close-btn">
            <Ionicons name="close" size={28} color={TEXT_WHITE} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Downloads</Text>
          {isBatchMode ? (
            <TouchableOpacity style={styles.clearButton} onPress={handleBatchDelete} activeOpacity={0.7} data-testid="downloads-batch-delete-btn">
              <Text style={styles.clearButtonText}>Delete ({selectedIds.size})</Text>
            </TouchableOpacity>
          ) : downloads.length > 0 ? (
            <TouchableOpacity style={styles.clearButton} onPress={handleClearAll} activeOpacity={0.7} data-testid="downloads-clear-all-btn">
              <Text style={styles.clearButtonText}>Clear All</Text>
            </TouchableOpacity>
          ) : <View style={{ width: 70 }} />}
        </View>

        {/* Content */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={AURA_BLUE} />
          </View>
        ) : isGrouped && filteredDownloads.length > 0 ? (
          /* ——— GROUPED VIEW (SectionList) ——— */
          <SectionList
            sections={groupedSections}
            keyExtractor={(item) => item.id}
            ListHeaderComponent={renderListHeader}
            ListEmptyComponent={<EmptyState hasFilter={hasFilter} />}
            renderSectionHeader={({ section }) => (
              <CategorySectionHeader
                category={section.title as DownloadCategory}
                count={section.count}
                collapsed={collapsedCategories.has(section.title as DownloadCategory)}
                onToggle={() => toggleCategoryCollapse(section.title as DownloadCategory)}
              />
            )}
            renderItem={renderItem}
            contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 20 }]}
            showsVerticalScrollIndicator={false}
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            stickySectionHeadersEnabled={false}
          />
        ) : (
          /* ——— FLAT VIEW (FlatList) ——— */
          <FlatList
            data={filteredDownloads}
            keyExtractor={(item) => item.id}
            ListHeaderComponent={renderListHeader}
            ListEmptyComponent={<EmptyState hasFilter={hasFilter} />}
            renderItem={renderItem}
            getItemLayout={(_data, index) => ({
              length: 80, offset: 80 * index, index,
            })}
            contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 20 }]}
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
// UTILITY FUNCTIONS (exported for use by index.tsx)
// ============================================================
export const addDownloadToList = async (filename: string, uri: string, size?: number): Promise<void> => {
  try {
    const stored = await AsyncStorage.getItem(DOWNLOADS_STORAGE_KEY);
    const downloads: DownloadItem[] = stored ? JSON.parse(stored) : [];
    const category = getCategoryForFile(filename);
    const newItem: DownloadItem = {
      id: `download_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      filename, uri,
      date: new Date().toISOString(),
      size,
      category,
    };
    downloads.unshift(newItem);
    await AsyncStorage.setItem(DOWNLOADS_STORAGE_KEY, JSON.stringify(downloads.slice(0, 200)));
    console.log(`[DownloadsManager] Added download to list: ${filename} [${category}]`);
  } catch (error) {
    console.error('[DownloadsManager] Failed to add download:', error);
  }
};

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
const FONT_FAMILY = Platform.select({
  ios: { fontFamily: 'System' },
  android: { fontFamily: 'Roboto' },
  web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DEEP_INDIGO },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  closeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: TEXT_WHITE, ...FONT_FAMILY },
  clearButton: { paddingHorizontal: 12, paddingVertical: 8 },
  clearButtonText: { fontSize: 14, fontWeight: '600', color: DANGER_RED },

  // Search
  searchContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: SEARCH_BG, borderRadius: 12,
    marginHorizontal: 16, marginTop: 12, marginBottom: 8,
    paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 10 : 6,
  },
  searchInput: { flex: 1, fontSize: 15, color: TEXT_WHITE, padding: 0, ...FONT_FAMILY },

  // Filter chips row with group toggle
  filterRow: { flexDirection: 'row', alignItems: 'center', paddingRight: 8 },
  chipsRow: { paddingHorizontal: 16, paddingVertical: 8, gap: 8, flexGrow: 1 },
  chip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: CHIP_BG, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: 'transparent',
  },
  chipActive: { backgroundColor: CHIP_ACTIVE_BG, borderColor: AURA_BLUE },
  chipText: { fontSize: 12, fontWeight: '600', color: TEXT_MUTED, ...FONT_FAMILY },
  chipTextActive: { color: AURA_BLUE },

  // Group toggle
  groupToggle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: CHIP_BG, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'transparent',
  },
  groupToggleActive: { backgroundColor: CHIP_ACTIVE_BG, borderColor: AURA_BLUE },

  // Count / batch bar
  countRow: { paddingHorizontal: 20, paddingVertical: 8 },
  countText: { fontSize: 13, fontWeight: '500', color: TEXT_MUTED },
  batchBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  batchBtn: { paddingVertical: 4, paddingHorizontal: 4 },
  batchBtnText: { fontSize: 14, fontWeight: '600', color: TEXT_MUTED, ...FONT_FAMILY },

  // Active section
  activeSection: { paddingHorizontal: 16, paddingTop: 12 },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: AURA_BLUE, letterSpacing: 1.2,
    marginBottom: 8, ...FONT_FAMILY,
  },

  // Progress bar
  progressBarBg: {
    height: 3, backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2, marginTop: 6, overflow: 'hidden',
  },
  progressBarFill: { height: '100%', backgroundColor: AURA_BLUE, borderRadius: 2 },

  // Section header (grouped view)
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 4, marginTop: 8, marginBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  sectionHeaderIcon: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  sectionHeaderTitle: {
    flex: 1, fontSize: 14, fontWeight: '700', color: TEXT_WHITE,
    letterSpacing: 0.5, ...FONT_FAMILY,
  },
  sectionHeaderRight: { flexDirection: 'row', alignItems: 'center' },
  sectionHeaderCount: { fontSize: 13, fontWeight: '700' },

  // Loading
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // List
  listContent: { paddingHorizontal: 16, paddingTop: 0 },

  // Download Item
  downloadItem: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: CARD_DARK, borderRadius: 16,
    padding: 16, marginBottom: 10,
  },
  downloadItemSelected: { backgroundColor: 'rgba(0,242,255,0.08)', borderWidth: 1, borderColor: 'rgba(0,242,255,0.25)' },
  checkboxContainer: { marginRight: 10 },
  fileIconContainer: {
    width: 48, height: 48, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', marginRight: 14,
  },
  fileInfo: { flex: 1, marginRight: 12 },
  fileName: { fontSize: 15, fontWeight: '600', color: TEXT_WHITE, marginBottom: 4, ...FONT_FAMILY },
  fileMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  fileDate: { fontSize: 12, color: TEXT_MUTED },
  metaDot: { fontSize: 12, color: TEXT_MUTED, marginHorizontal: 6 },
  fileSize: { fontSize: 12, color: TEXT_MUTED },
  categoryBadge: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },
  categoryBadgeText: {
    fontSize: 10, fontWeight: '700', letterSpacing: 0.5,
  },
  deleteButton: {
    width: 40, height: 40, alignItems: 'center', justifyContent: 'center',
    borderRadius: 20, backgroundColor: 'rgba(239,68,68,0.1)',
  },

  // Empty State
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, paddingTop: 60 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: TEXT_WHITE, marginTop: 20, marginBottom: 8, ...FONT_FAMILY },
  emptySubtitle: { fontSize: 14, color: TEXT_MUTED, textAlign: 'center', lineHeight: 20 },
});

export default DownloadsModal;
