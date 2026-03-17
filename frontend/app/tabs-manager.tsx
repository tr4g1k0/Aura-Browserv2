import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBrowserStore, Tab } from '../src/store/browserStore';
import * as Haptics from 'expo-haptics';

// Mock dummy tabs for demonstration
const MOCK_TABS: Tab[] = [
  {
    id: 'tab-1',
    url: 'https://www.amazon.com/dp/B0BSHF7WHW',
    title: 'Apple AirPods Pro (2nd Gen) - Amazon',
    isActive: false,
    canGoBack: true,
    canGoForward: false,
  },
  {
    id: 'tab-2',
    url: 'https://en.wikipedia.org/wiki/Artificial_intelligence',
    title: 'Artificial intelligence - Wikipedia',
    isActive: false,
    canGoBack: true,
    canGoForward: false,
  },
  {
    id: 'tab-3',
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    title: 'Never Gonna Give You Up - YouTube',
    isActive: false,
    canGoBack: true,
    canGoForward: false,
  },
  {
    id: 'tab-4',
    url: 'https://www.amazon.com/Sony-WH-1000XM5',
    title: 'Sony WH-1000XM5 Headphones - Amazon',
    isActive: false,
    canGoBack: true,
    canGoForward: false,
  },
  {
    id: 'tab-5',
    url: 'https://en.wikipedia.org/wiki/Machine_learning',
    title: 'Machine learning - Wikipedia',
    isActive: true,
    canGoBack: true,
    canGoForward: false,
  },
  {
    id: 'tab-6',
    url: 'https://www.youtube.com/watch?v=abc123',
    title: 'How to Code in React Native - YouTube',
    isActive: false,
    canGoBack: true,
    canGoForward: false,
  },
  {
    id: 'tab-7',
    url: 'https://news.ycombinator.com',
    title: 'Hacker News',
    isActive: false,
    canGoBack: true,
    canGoForward: false,
  },
  {
    id: 'tab-8',
    url: 'https://github.com/facebook/react-native',
    title: 'React Native - GitHub',
    isActive: false,
    canGoBack: true,
    canGoForward: false,
  },
];

interface TabGroup {
  category: string;
  icon: string;
  color: string;
  tabs: Tab[];
  isExpanded: boolean;
}

const CATEGORY_CONFIG: Record<string, { icon: string; color: string }> = {
  Shopping: { icon: 'cart', color: '#FF6B6B' },
  Research: { icon: 'school', color: '#4ECDC4' },
  Entertainment: { icon: 'play-circle', color: '#A78BFA' },
  News: { icon: 'newspaper', color: '#F59E0B' },
  Development: { icon: 'code-slash', color: '#3B82F6' },
  Social: { icon: 'people', color: '#EC4899' },
  Other: { icon: 'folder', color: '#6B7280' },
};

export default function TabsManagerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { tabs: storeTabs, addTab, removeTab, setActiveTab } = useBrowserStore();

  // Use mock tabs for demo, or real tabs if available
  const allTabs = storeTabs.length > 1 ? storeTabs : MOCK_TABS;

  const [isGrouped, setIsGrouped] = useState(false);
  const [isGrouping, setIsGrouping] = useState(false);
  const [tabGroups, setTabGroups] = useState<TabGroup[]>([]);
  const [groupAnimation] = useState(new Animated.Value(0));

  const handleClose = () => router.back();

  const handleSelectTab = (tab: Tab) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(tab.id);
    router.back();
  };

  const handleRemoveTab = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    removeTab(id);
  };

  const handleAddTab = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addTab();
    router.back();
  };

  // Mock AI Tab Grouping Function
  const groupTabsByIntent = useCallback(async () => {
    if (isGrouped) {
      // Ungroup - reset to flat list
      setIsGrouped(false);
      Animated.timing(groupAnimation, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
      return;
    }

    setIsGrouping(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Simulate AI processing delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Mock categorization logic
    const categoryMap = new Map<string, Tab[]>();

    allTabs.forEach(tab => {
      const url = tab.url.toLowerCase();
      const title = tab.title.toLowerCase();
      let category = 'Other';

      if (url.includes('amazon') || url.includes('shop') || url.includes('ebay') || url.includes('store')) {
        category = 'Shopping';
      } else if (url.includes('wikipedia') || url.includes('docs') || url.includes('stackoverflow')) {
        category = 'Research';
      } else if (url.includes('youtube') || url.includes('netflix') || url.includes('spotify') || url.includes('twitch')) {
        category = 'Entertainment';
      } else if (url.includes('news') || url.includes('ycombinator') || url.includes('reddit')) {
        category = 'News';
      } else if (url.includes('github') || url.includes('gitlab') || url.includes('dev.to') || title.includes('code')) {
        category = 'Development';
      }

      if (!categoryMap.has(category)) {
        categoryMap.set(category, []);
      }
      categoryMap.get(category)!.push(tab);
    });

    // Convert to TabGroup array
    const groups: TabGroup[] = [];
    categoryMap.forEach((tabs, category) => {
      const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.Other;
      groups.push({
        category,
        icon: config.icon,
        color: config.color,
        tabs,
        isExpanded: true,
      });
    });

    // Sort by number of tabs (most first)
    groups.sort((a, b) => b.tabs.length - a.tabs.length);

    setTabGroups(groups);
    setIsGrouping(false);
    setIsGrouped(true);

    Animated.timing(groupAnimation, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [isGrouped, allTabs, groupAnimation]);

  const toggleGroupExpansion = (category: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTabGroups(prev =>
      prev.map(g =>
        g.category === category ? { ...g, isExpanded: !g.isExpanded } : g
      )
    );
  };

  const renderTabCard = (tab: Tab, showCategory = false) => (
    <TouchableOpacity
      key={tab.id}
      style={[styles.tabCard, tab.isActive && styles.activeTabCard]}
      onPress={() => handleSelectTab(tab)}
      activeOpacity={0.7}
    >
      <View style={styles.tabContent}>
        <View style={styles.tabFavicon}>
          <Ionicons name="globe-outline" size={16} color="#888" />
        </View>
        <View style={styles.tabInfo}>
          <Text style={styles.tabTitle} numberOfLines={1}>
            {tab.title || 'New Tab'}
          </Text>
          <Text style={styles.tabUrl} numberOfLines={1}>
            {(() => {
              try {
                return new URL(tab.url).hostname;
              } catch {
                return tab.url;
              }
            })()}
          </Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.closeTabButton}
        onPress={() => handleRemoveTab(tab.id)}
        hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
      >
        <Ionicons name="close" size={18} color="#666" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderGroupedView = () => (
    <Animated.View
      style={{
        opacity: groupAnimation,
        transform: [{
          translateY: groupAnimation.interpolate({
            inputRange: [0, 1],
            outputRange: [20, 0],
          }),
        }],
      }}
    >
      {tabGroups.map(group => (
        <View key={group.category} style={styles.groupContainer}>
          <TouchableOpacity
            style={styles.groupHeader}
            onPress={() => toggleGroupExpansion(group.category)}
            activeOpacity={0.7}
          >
            <View style={styles.groupHeaderLeft}>
              <View style={[styles.groupIcon, { backgroundColor: `${group.color}20` }]}>
                <Ionicons name={group.icon as any} size={20} color={group.color} />
              </View>
              <View>
                <Text style={[styles.groupTitle, { color: group.color }]}>
                  {group.category}
                </Text>
                <Text style={styles.groupCount}>
                  {group.tabs.length} tab{group.tabs.length !== 1 ? 's' : ''}
                </Text>
              </View>
            </View>
            <Ionicons
              name={group.isExpanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color="#666"
            />
          </TouchableOpacity>

          {group.isExpanded && (
            <View style={styles.groupTabs}>
              {group.tabs.map(tab => renderTabCard(tab))}
            </View>
          )}
        </View>
      ))}
    </Animated.View>
  );

  const renderFlatView = () => (
    <View>
      {allTabs.map(tab => renderTabCard(tab))}
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Tabs</Text>
          <Text style={styles.subtitle}>{allTabs.length} open</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.addButton} onPress={handleAddTab}>
            <Ionicons name="add" size={24} color="#0D0D0D" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <Ionicons name="close" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* AI Group Button */}
      <TouchableOpacity
        style={[
          styles.groupByIntentButton,
          isGrouped && styles.groupByIntentButtonActive,
        ]}
        onPress={groupTabsByIntent}
        disabled={isGrouping}
        activeOpacity={0.8}
      >
        {isGrouping ? (
          <ActivityIndicator size="small" color="#00FF88" />
        ) : (
          <>
            <Ionicons
              name={isGrouped ? 'layers' : 'sparkles'}
              size={20}
              color={isGrouped ? '#0D0D0D' : '#00FF88'}
            />
            <Text
              style={[
                styles.groupByIntentText,
                isGrouped && styles.groupByIntentTextActive,
              ]}
            >
              {isGrouped ? 'Grouped by Intent' : 'Group by Intent (AI)'}
            </Text>
            {isGrouped && (
              <View style={styles.ungroupHint}>
                <Text style={styles.ungroupHintText}>Tap to ungroup</Text>
              </View>
            )}
          </>
        )}
      </TouchableOpacity>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {isGrouping ? (
          <View style={styles.loadingContainer}>
            <View style={styles.loadingAnimation}>
              <Ionicons name="sparkles" size={40} color="#00FF88" />
            </View>
            <Text style={styles.loadingText}>AI is analyzing your tabs...</Text>
            <Text style={styles.loadingSubtext}>Grouping by intent and topic</Text>
          </View>
        ) : isGrouped ? (
          renderGroupedView()
        ) : (
          renderFlatView()
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0D',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFF',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#00FF88',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupByIntentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginTop: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: '#1A2A1A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#00FF88',
    gap: 10,
  },
  groupByIntentButtonActive: {
    backgroundColor: '#00FF88',
    borderColor: '#00FF88',
  },
  groupByIntentText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#00FF88',
  },
  groupByIntentTextActive: {
    color: '#0D0D0D',
  },
  ungroupHint: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 4,
  },
  ungroupHintText: {
    fontSize: 10,
    color: '#0D0D0D',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  loadingAnimation: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1A2A1A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 8,
  },
  loadingSubtext: {
    fontSize: 14,
    color: '#666',
  },
  groupContainer: {
    marginBottom: 20,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  groupHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  groupTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  groupCount: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  groupTabs: {
    paddingLeft: 8,
  },
  tabCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  activeTabCard: {
    borderWidth: 1,
    borderColor: '#00FF88',
  },
  tabContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabFavicon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#2A2A2A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  tabInfo: {
    flex: 1,
  },
  tabTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFF',
    marginBottom: 2,
  },
  tabUrl: {
    fontSize: 12,
    color: '#666',
  },
  closeTabButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2A2A2A',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
