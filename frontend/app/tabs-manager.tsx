import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBrowserStore, Tab } from '../src/store/browserStore';
import { 
  groupTabsByIntent, 
  generateGroupSummary,
  TabGroup,
  GroupSummary,
  isInMockMode,
} from '../src/services/AITabAgent';
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

  // AI Tab Grouping Function using AITabAgent service
  const handleGroupByIntent = useCallback(async () => {
    if (isGrouped) {
      // Ungroup - reset to flat list
      setIsGrouped(false);
      setTabGroups([]);
      Animated.timing(groupAnimation, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
      return;
    }

    setIsGrouping(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      // Use AITabAgent service for grouping
      const result = await groupTabsByIntent(allTabs);
      
      setTabGroups(result.groups);
      setIsGrouped(true);

      Animated.timing(groupAnimation, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('[TabsManager] Grouping error:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsGrouping(false);
    }
  }, [isGrouped, allTabs, groupAnimation]);

  // Generate summary for a group
  const handleGenerateSummary = useCallback(async (groupId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Find the group
    const group = tabGroups.find(g => g.id === groupId);
    if (!group) return;

    // Set loading state
    setTabGroups(prev =>
      prev.map(g =>
        g.id === groupId ? { ...g, isSummarizing: true } : g
      )
    );

    try {
      // Generate summary using AITabAgent service
      const summary = await generateGroupSummary(group);
      
      // Update group with summary
      setTabGroups(prev =>
        prev.map(g =>
          g.id === groupId 
            ? { ...g, summary, isSummarizing: false } 
            : g
        )
      );

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('[TabsManager] Summary generation error:', error);
      
      // Clear loading state on error
      setTabGroups(prev =>
        prev.map(g =>
          g.id === groupId ? { ...g, isSummarizing: false } : g
        )
      );
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [tabGroups]);

  const toggleGroupExpansion = (groupId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTabGroups(prev =>
      prev.map(g =>
        g.id === groupId ? { ...g, isExpanded: !g.isExpanded } : g
      )
    );
  };

  const renderTabCard = (tab: Tab) => (
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

  // Render summary card with glassmorphism effect
  const renderSummaryCard = (summary: GroupSummary, color: string) => (
    <View style={[styles.summaryCard, { borderColor: `${color}40` }]}>
      <View style={styles.summaryHeader}>
        <Ionicons name="bulb" size={14} color={color} />
        <Text style={[styles.summaryLabel, { color }]}>AI Summary</Text>
        {isInMockMode() && (
          <View style={styles.mockBadge}>
            <Text style={styles.mockBadgeText}>MOCK</Text>
          </View>
        )}
      </View>
      <View style={styles.bulletList}>
        {summary.bullets.map((bullet, index) => (
          <View key={index} style={styles.bulletItem}>
            <View style={[styles.bulletDot, { backgroundColor: color }]} />
            <Text style={styles.bulletText}>{bullet}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.summaryConfidence}>
        {Math.round(summary.confidence * 100)}% confidence
      </Text>
    </View>
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
        <View key={group.id} style={styles.groupContainer}>
          {/* Group Header */}
          <TouchableOpacity
            style={styles.groupHeader}
            onPress={() => toggleGroupExpansion(group.id)}
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

          {/* Generate Brief Button */}
          {group.isExpanded && !group.summary && (
            <TouchableOpacity
              style={[styles.generateBriefButton, { borderColor: `${group.color}60` }]}
              onPress={() => handleGenerateSummary(group.id)}
              disabled={group.isSummarizing}
              activeOpacity={0.7}
            >
              {group.isSummarizing ? (
                <>
                  <ActivityIndicator size="small" color={group.color} />
                  <Text style={[styles.generateBriefText, { color: group.color }]}>
                    Generating summary...
                  </Text>
                </>
              ) : (
                <>
                  <Ionicons name="sparkles" size={16} color={group.color} />
                  <Text style={[styles.generateBriefText, { color: group.color }]}>
                    Generate Brief
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Summary Card (Glassmorphism) */}
          {group.isExpanded && group.summary && (
            renderSummaryCard(group.summary, group.color)
          )}

          {/* Tab Cards */}
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

      {/* AI Organize Button - Prominent, neon-accented */}
      <TouchableOpacity
        style={[
          styles.organizeButton,
          isGrouped && styles.organizeButtonActive,
        ]}
        onPress={handleGroupByIntent}
        disabled={isGrouping}
        activeOpacity={0.8}
      >
        {isGrouping ? (
          <ActivityIndicator size="small" color="#00FF88" />
        ) : (
          <>
            <Text style={styles.organizeButtonEmoji}>✨</Text>
            <Text
              style={[
                styles.organizeButtonText,
                isGrouped && styles.organizeButtonTextActive,
              ]}
            >
              {isGrouped ? 'Organized by AI' : 'Organize Tabs with AI'}
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
  // Prominent AI Organize Button
  organizeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginTop: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    backgroundColor: '#0D1A0D',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#00FF88',
    gap: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#00FF88',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: '0 4px 16px rgba(0, 255, 136, 0.3)',
      },
    }),
  },
  organizeButtonActive: {
    backgroundColor: '#00FF88',
    borderColor: '#00FF88',
  },
  organizeButtonEmoji: {
    fontSize: 20,
  },
  organizeButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#00FF88',
    letterSpacing: 0.5,
  },
  organizeButtonTextActive: {
    color: '#0D0D0D',
  },
  ungroupHint: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginLeft: 4,
  },
  ungroupHintText: {
    fontSize: 11,
    color: '#0D0D0D',
    fontWeight: '500',
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
    marginBottom: 24,
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
  // Generate Brief Button
  generateBriefButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 12,
    marginLeft: 8,
    marginRight: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    backgroundColor: 'rgba(255,255,255,0.02)',
    gap: 8,
  },
  generateBriefText: {
    fontSize: 13,
    fontWeight: '600',
  },
  // Summary Card - Glassmorphism Style
  summaryCard: {
    marginBottom: 12,
    marginLeft: 8,
    marginRight: 8,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
      web: {
        backdropFilter: 'blur(10px)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
      },
    }),
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 6,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  mockBadge: {
    backgroundColor: 'rgba(255, 184, 0, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 'auto',
  },
  mockBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFB800',
    letterSpacing: 0.5,
  },
  bulletList: {
    gap: 10,
  },
  bulletItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
    marginRight: 10,
  },
  bulletText: {
    flex: 1,
    fontSize: 13,
    color: '#CCC',
    lineHeight: 18,
  },
  summaryConfidence: {
    fontSize: 10,
    color: '#666',
    marginTop: 12,
    textAlign: 'right',
    fontStyle: 'italic',
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
