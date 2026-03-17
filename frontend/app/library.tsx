import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  FlatList,
  Platform,
  Alert,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut, Layout } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useBrowserStore, HistoryEntry, Bookmark } from '../src/store/browserStore';
import { semanticHistoryService } from '../src/services/SemanticHistoryService';

interface LibraryScreenProps {
  visible: boolean;
  onClose: () => void;
  onNavigate: (url: string) => void;
}

type TabType = 'bookmarks' | 'history';

/**
 * LibraryScreen - Hub for Bookmarks and History
 * 
 * Features:
 * - Two-tab interface (Bookmarks / History)
 * - Semantic Time-Machine: AI-powered fuzzy search through history
 * - Displays AI-generated semantic labels for each history entry
 * - Search through both title AND semanticLabel for intelligent matching
 * - Swipe to delete bookmarks/history entries
 * - Navigate back to past pages
 * 
 * PRIVACY GUARD:
 * All AI History processing happens 100% locally on-device.
 * No page content or semantic labels ever leave this device.
 */
export const LibraryScreen: React.FC<LibraryScreenProps> = ({
  visible,
  onClose,
  onNavigate,
}) => {
  const insets = useSafeAreaInsets();
  const { 
    history, 
    bookmarks, 
    clearHistory, 
    removeFromHistory, 
    removeBookmark 
  } = useBrowserStore();
  
  const [activeTab, setActiveTab] = useState<TabType>('bookmarks');
  const [searchQuery, setSearchQuery] = useState('');

  /**
   * Semantic Time-Machine: Fuzzy Search Engine
   * Searches against both title AND semanticLabel for intelligent matching
   * Uses the SemanticHistoryService for advanced fuzzy matching
   */
  const filteredHistory = useMemo(() => {
    if (!searchQuery.trim()) {
      return history;
    }
    
    // Use the semantic history service's fuzzy search
    return semanticHistoryService.fuzzySearch(searchQuery, history);
  }, [history, searchQuery]);

  // Filter bookmarks based on search query
  const filteredBookmarks = useMemo(() => {
    if (!searchQuery.trim()) {
      return bookmarks;
    }
    const query = searchQuery.toLowerCase();
    return bookmarks.filter(
      (entry) =>
        entry.title.toLowerCase().includes(query) ||
        entry.url.toLowerCase().includes(query)
    );
  }, [bookmarks, searchQuery]);

  const handleTabChange = (tab: TabType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(tab);
    setSearchQuery('');
  };

  const handleItemPress = (url: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onNavigate(url);
    onClose();
  };

  const handleRemoveHistoryItem = (timestamp: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    removeFromHistory(timestamp);
  };

  const handleRemoveBookmark = (url: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    removeBookmark(url);
  };

  const handleClearHistory = () => {
    Alert.alert(
      'Clear History',
      'Are you sure you want to clear all browsing history?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            clearHistory();
          },
        },
      ]
    );
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    // Less than 1 hour ago
    if (diff < 60 * 60 * 1000) {
      const minutes = Math.floor(diff / (60 * 1000));
      return `${minutes}m ago`;
    }
    
    // Less than 24 hours ago
    if (diff < 24 * 60 * 60 * 1000) {
      const hours = Math.floor(diff / (60 * 60 * 1000));
      return `${hours}h ago`;
    }
    
    // Less than 7 days ago
    if (diff < 7 * 24 * 60 * 60 * 1000) {
      const days = Math.floor(diff / (24 * 60 * 60 * 1000));
      return `${days}d ago`;
    }
    
    // Format as date
    return date.toLocaleDateString();
  };

  const getHostname = (url: string) => {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return url;
    }
  };

  /**
   * Render History Item with Semantic Label
   * Displays the AI-generated semantic label in Electric Cyan (#00FFFF)
   * This proves to the user that the AI 'remembered' the page content
   */
  const renderHistoryItem = useCallback(({ item }: { item: HistoryEntry }) => (
    <Animated.View 
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(150)}
      layout={Layout.springify()}
    >
      <TouchableOpacity
        style={styles.listItem}
        onPress={() => handleItemPress(item.url)}
        activeOpacity={0.7}
      >
        <View style={styles.itemIcon}>
          {item.semanticLabel ? (
            // AI-enhanced history entry
            <Ionicons name="sparkles" size={18} color="#00FFFF" />
          ) : (
            <Ionicons name="time-outline" size={20} color="#888" />
          )}
        </View>
        <View style={styles.itemContent}>
          <Text style={styles.itemTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.itemUrl} numberOfLines={1}>
            {getHostname(item.url)}
          </Text>
          {/* Semantic Time-Machine: Display AI-generated label */}
          {item.semanticLabel && (
            <Text style={styles.semanticLabel} numberOfLines={2}>
              {item.semanticLabel}
            </Text>
          )}
        </View>
        <View style={styles.itemActions}>
          <Text style={styles.itemTime}>{formatTime(item.timestamp)}</Text>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleRemoveHistoryItem(item.timestamp)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={16} color="#666" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Animated.View>
  ), []);

  const renderBookmarkItem = useCallback(({ item }: { item: Bookmark }) => (
    <Animated.View 
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(150)}
      layout={Layout.springify()}
    >
      <TouchableOpacity
        style={styles.listItem}
        onPress={() => handleItemPress(item.url)}
        activeOpacity={0.7}
      >
        <View style={[styles.itemIcon, styles.bookmarkIcon]}>
          <Ionicons name="bookmark" size={18} color="#00E5FF" />
        </View>
        <View style={styles.itemContent}>
          <Text style={styles.itemTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.itemUrl} numberOfLines={1}>
            {getHostname(item.url)}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleRemoveBookmark(item.url)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={16} color="#666" />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  ), []);

  const renderEmptyState = (type: TabType) => (
    <View style={styles.emptyState}>
      <Ionicons
        name={type === 'bookmarks' ? 'bookmark-outline' : 'time-outline'}
        size={48}
        color="#333"
      />
      <Text style={styles.emptyTitle}>
        {type === 'bookmarks' ? 'No Bookmarks Yet' : 'No History'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {type === 'bookmarks'
          ? 'Tap the star icon to save your favorite pages'
          : searchQuery
          ? 'No results found for your search'
          : 'Your browsing history will appear here'}
      </Text>
      {type === 'history' && !searchQuery && (
        <Text style={styles.privacyNote}>
          AI-powered semantic search enabled
        </Text>
      )}
    </View>
  );

  const isWeb = Platform.OS === 'web';

  // Count entries with semantic labels
  const semanticEntriesCount = useMemo(() => 
    history.filter(h => h.semanticLabel).length,
  [history]);

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
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onClose();
            }}
          >
            <Ionicons name="close" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Library</Text>
          {activeTab === 'history' && history.length > 0 && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={handleClearHistory}
            >
              <Text style={styles.clearButtonText}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Tab Switcher */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'bookmarks' && styles.tabActive]}
            onPress={() => handleTabChange('bookmarks')}
          >
            <Ionicons
              name={activeTab === 'bookmarks' ? 'bookmark' : 'bookmark-outline'}
              size={18}
              color={activeTab === 'bookmarks' ? '#00E5FF' : '#888'}
            />
            <Text style={[styles.tabText, activeTab === 'bookmarks' && styles.tabTextActive]}>
              Bookmarks
            </Text>
            {bookmarks.length > 0 && (
              <View style={[styles.badge, activeTab === 'bookmarks' && styles.badgeActive]}>
                <Text style={styles.badgeText}>{bookmarks.length}</Text>
              </View>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.tab, activeTab === 'history' && styles.tabActive]}
            onPress={() => handleTabChange('history')}
          >
            <Ionicons
              name={activeTab === 'history' ? 'time' : 'time-outline'}
              size={18}
              color={activeTab === 'history' ? '#00FF88' : '#888'}
            />
            <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>
              History
            </Text>
            {history.length > 0 && (
              <View style={[styles.badge, activeTab === 'history' && styles.badgeActiveGreen]}>
                <Text style={styles.badgeText}>{history.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Semantic AI Status Badge (for History tab) */}
        {activeTab === 'history' && history.length > 0 && (
          <View style={styles.semanticStatusContainer}>
            <View style={styles.semanticStatusBadge}>
              <Ionicons name="sparkles" size={14} color="#00FFFF" />
              <Text style={styles.semanticStatusText}>
                {semanticEntriesCount} AI-enhanced {semanticEntriesCount === 1 ? 'entry' : 'entries'}
              </Text>
              <Text style={styles.semanticPrivacyText}>• 100% Local</Text>
            </View>
          </View>
        )}

        {/* Search Bar with Semantic Search Hint */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color="#666" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={
                activeTab === 'history' 
                  ? "Search your memory..." 
                  : "Search bookmarks..."
              }
              placeholderTextColor="#555"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                style={styles.clearSearchButton}
              >
                <Ionicons name="close-circle" size={18} color="#666" />
              </TouchableOpacity>
            )}
          </View>
          {activeTab === 'history' && searchQuery.length > 0 && (
            <Text style={styles.searchHint}>
              Searching titles and AI-generated context...
            </Text>
          )}
        </View>

        {/* Content */}
        {activeTab === 'bookmarks' ? (
          <FlatList
            data={filteredBookmarks}
            keyExtractor={(item) => item.url}
            renderItem={renderBookmarkItem}
            contentContainerStyle={[
              styles.listContent,
              filteredBookmarks.length === 0 && styles.emptyListContent,
            ]}
            ListEmptyComponent={renderEmptyState('bookmarks')}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <FlatList
            data={filteredHistory}
            keyExtractor={(item) => `${item.url}-${item.timestamp}`}
            renderItem={renderHistoryItem}
            contentContainerStyle={[
              styles.listContent,
              filteredHistory.length === 0 && styles.emptyListContent,
            ]}
            ListEmptyComponent={renderEmptyState('history')}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0D',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
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
    color: '#FF6B6B',
    fontSize: 14,
    fontWeight: '600',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    gap: 8,
  },
  tabActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
  },
  tabTextActive: {
    color: '#FFF',
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeActive: {
    backgroundColor: 'rgba(0, 229, 255, 0.2)',
  },
  badgeActiveGreen: {
    backgroundColor: 'rgba(0, 255, 136, 0.2)',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFF',
  },
  // Semantic AI Status Badge
  semanticStatusContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  semanticStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 255, 255, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
    gap: 6,
  },
  semanticStatusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#00FFFF',
  },
  semanticPrivacyText: {
    fontSize: 10,
    color: '#00FF88',
    fontWeight: '500',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: '#FFF',
    fontSize: 15,
    height: '100%',
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    }),
  },
  clearSearchButton: {
    padding: 4,
  },
  searchHint: {
    fontSize: 11,
    color: '#00FFFF',
    marginTop: 6,
    marginLeft: 4,
    fontStyle: 'italic',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  emptyListContent: {
    flex: 1,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginBottom: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  itemIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  bookmarkIcon: {
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
  },
  itemContent: {
    flex: 1,
    marginRight: 8,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#FFF',
    marginBottom: 2,
  },
  itemUrl: {
    fontSize: 12,
    color: '#666',
  },
  // Semantic Time-Machine: Electric Cyan label
  semanticLabel: {
    fontSize: 12,
    color: '#00FFFF',        // Electric Cyan
    fontStyle: 'italic',
    marginTop: 6,
    lineHeight: 16,
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
      web: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    }),
  },
  itemActions: {
    alignItems: 'flex-end',
    gap: 8,
  },
  itemTime: {
    fontSize: 11,
    color: '#555',
  },
  deleteButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#555',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#444',
    textAlign: 'center',
    lineHeight: 20,
  },
  privacyNote: {
    fontSize: 11,
    color: '#00FFFF',
    marginTop: 16,
    fontStyle: 'italic',
  },
});

export default LibraryScreen;
