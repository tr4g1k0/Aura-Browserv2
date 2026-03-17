import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  ActivityIndicator,
  Platform,
  LayoutAnimation,
  UIManager,
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

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Helper to generate unique IDs
const generateId = () => Math.random().toString(36).substring(2, 9);

// Default URL for new tabs
const DEFAULT_URL = 'https://www.google.com';

// Mock dummy tabs for demonstration
const createMockTabs = (): Tab[] => [
  {
    id: generateId(),
    url: 'https://www.amazon.com/dp/B0BSHF7WHW',
    title: 'Apple AirPods Pro (2nd Gen) - Amazon',
    isActive: false,
    canGoBack: true,
    canGoForward: false,
  },
  {
    id: generateId(),
    url: 'https://en.wikipedia.org/wiki/Artificial_intelligence',
    title: 'Artificial intelligence - Wikipedia',
    isActive: false,
    canGoBack: true,
    canGoForward: false,
  },
  {
    id: generateId(),
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    title: 'Never Gonna Give You Up - YouTube',
    isActive: false,
    canGoBack: true,
    canGoForward: false,
  },
  {
    id: generateId(),
    url: 'https://www.amazon.com/Sony-WH-1000XM5',
    title: 'Sony WH-1000XM5 Headphones - Amazon',
    isActive: false,
    canGoBack: true,
    canGoForward: false,
  },
  {
    id: generateId(),
    url: 'https://en.wikipedia.org/wiki/Machine_learning',
    title: 'Machine learning - Wikipedia',
    isActive: true,
    canGoBack: true,
    canGoForward: false,
  },
  {
    id: generateId(),
    url: 'https://www.youtube.com/watch?v=abc123',
    title: 'How to Code in React Native - YouTube',
    isActive: false,
    canGoBack: true,
    canGoForward: false,
  },
  {
    id: generateId(),
    url: 'https://news.ycombinator.com',
    title: 'Hacker News',
    isActive: false,
    canGoBack: true,
    canGoForward: false,
  },
  {
    id: generateId(),
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
  const { 
    tabs: storeTabs, 
    ghostTabs,
    isGhostMode,
    addTab, 
    removeTab, 
    setActiveTab,
    toggleGhostMode,
  } = useBrowserStore();

  // Local state for displayed tabs (handles both mock and real tabs)
  const [displayedTabs, setDisplayedTabs] = useState<Tab[]>([]);
  const [usingMockTabs, setUsingMockTabs] = useState(false);

  // Get the correct tabs based on Ghost Mode
  const currentTabs = isGhostMode ? ghostTabs : storeTabs;

  // Initialize tabs on mount
  useEffect(() => {
    if (currentTabs.length > 1) {
      // Use real tabs from store
      setDisplayedTabs(currentTabs);
      setUsingMockTabs(false);
    } else if (currentTabs.length === 1) {
      setDisplayedTabs(currentTabs);
      setUsingMockTabs(false);
    } else {
      // Use mock tabs for demo
      setDisplayedTabs(createMockTabs());
      setUsingMockTabs(true);
    }
  }, [isGhostMode]);

  // Sync with store when using real tabs
  useEffect(() => {
    if (!usingMockTabs && currentTabs.length > 0) {
      setDisplayedTabs(currentTabs);
    }
  }, [currentTabs, usingMockTabs]);

  const [isGrouped, setIsGrouped] = useState(false);
  const [isGrouping, setIsGrouping] = useState(false);
  const [tabGroups, setTabGroups] = useState<TabGroup[]>([]);
  const [groupAnimation] = useState(new Animated.Value(0));

  const handleClose = () => router.back();

  const handleSelectTab = (tab: Tab) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (usingMockTabs) {
      // Update local state for mock tabs
      setDisplayedTabs(prev => 
        prev.map(t => ({ ...t, isActive: t.id === tab.id }))
      );
    } else {
      // Use store for real tabs
      setActiveTab(tab.id);
    }
    
    router.back();
  };

  /**
   * Close a tab with smooth animation
   * Handles both mock tabs (local state) and real tabs (store)
   */
  const handleCloseTab = useCallback((id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    // Animate the removal
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    
    if (usingMockTabs) {
      // Handle mock tabs locally
      setDisplayedTabs(prev => {
        const newTabs = prev.filter(t => t.id !== id);
        
        // If no tabs left, create a new empty tab
        if (newTabs.length === 0) {
          const newTab: Tab = {
            id: generateId(),
            url: DEFAULT_URL,
            title: 'New Tab',
            isActive: true,
            canGoBack: false,
            canGoForward: false,
          };
          return [newTab];
        }
        
        // If closed tab was active, activate the last tab
        const closedTab = prev.find(t => t.id === id);
        if (closedTab?.isActive && newTabs.length > 0) {
          newTabs[newTabs.length - 1].isActive = true;
        }
        
        return newTabs;
      });
      
      // Also update grouped view if active
      if (isGrouped) {
        setTabGroups(prev => 
          prev.map(group => ({
            ...group,
            tabs: group.tabs.filter(t => t.id !== id),
          })).filter(group => group.tabs.length > 0)
        );
      }
    } else {
      // Use store for real tabs
      removeTab(id);
      
      // Update grouped view
      if (isGrouped) {
        setTabGroups(prev => 
          prev.map(group => ({
            ...group,
            tabs: group.tabs.filter(t => t.id !== id),
          })).filter(group => group.tabs.length > 0)
        );
      }
    }
  }, [usingMockTabs, removeTab, isGrouped]);

  const handleAddTab = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Animate the addition
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    
    if (usingMockTabs) {
      // Add to local mock tabs
      const newTab: Tab = {
        id: generateId(),
        url: DEFAULT_URL,
        title: 'New Tab',
        isActive: true,
        canGoBack: false,
        canGoForward: false,
      };
      setDisplayedTabs(prev => [
        ...prev.map(t => ({ ...t, isActive: false })),
        newTab,
      ]);
    } else {
      // Use store for real tabs
      addTab();
    }
    
    router.back();
  };

  // AI Tab Grouping Function using AITabAgent service
  const handleGroupByIntent = useCallback(async () => {
    if (isGrouped) {
      // Ungroup - reset to flat list
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
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
      const result = await groupTabsByIntent(displayedTabs);
      
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
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
  }, [isGrouped, displayedTabs, groupAnimation]);

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
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setTabGroups(prev =>
      prev.map(g =>
        g.id === groupId ? { ...g, isExpanded: !g.isExpanded } : g
      )
    );
  };

  const renderTabCard = (tab: Tab) => (
    <Animated.View key={tab.id}>
      <TouchableOpacity
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
        
        {/* Close Tab Button - Now properly wired */}
        <TouchableOpacity
          style={styles.closeTabButton}
          onPress={() => handleCloseTab(tab.id)}
          hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
          activeOpacity={0.6}
        >
          <Ionicons name="close" size={18} color="#888" />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
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
      {displayedTabs.map(tab => renderTabCard(tab))}
    </View>
  );

  // Ghost Mode color theme - Deep Crimson (#2A0000) for visual feedback
  const ghostModeColors = {
    background: isGhostMode ? '#2A0000' : '#0D0D0D',
    headerBorder: isGhostMode ? '#3D0000' : '#1A1A1A',
    accent: isGhostMode ? '#9B59B6' : '#00FF88',
    accentDark: isGhostMode ? '#2A0000' : '#1A1A1A',
    tabBackground: isGhostMode ? 'rgba(155, 89, 182, 0.1)' : 'rgba(255, 255, 255, 0.03)',
    tabBorder: isGhostMode ? 'rgba(155, 89, 182, 0.2)' : 'rgba(255, 255, 255, 0.05)',
  };

  return (
    <View style={[
      styles.container, 
      { paddingTop: insets.top, backgroundColor: ghostModeColors.background }
    ]}>
      {/* Ghost Mode Toggle - Prominent at top */}
      <TouchableOpacity
        style={[
          styles.ghostModeToggle,
          isGhostMode && styles.ghostModeToggleActive,
          { borderColor: isGhostMode ? '#9B59B6' : '#333' }
        ]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          toggleGhostMode();
        }}
        activeOpacity={0.8}
      >
        <View style={[
          styles.ghostModeIcon,
          isGhostMode && styles.ghostModeIconActive
        ]}>
          <Ionicons 
            name={isGhostMode ? "eye-off" : "eye-off-outline"} 
            size={20} 
            color={isGhostMode ? '#9B59B6' : '#888'} 
          />
        </View>
        <View style={styles.ghostModeTextContainer}>
          <Text style={[
            styles.ghostModeTitle,
            isGhostMode && { color: '#9B59B6' }
          ]}>
            Ghost Mode
          </Text>
          <Text style={styles.ghostModeSubtitle}>
            {isGhostMode ? 'Active • No history saved' : 'Browse without leaving traces'}
          </Text>
        </View>
        <View style={[
          styles.ghostModeSwitch,
          isGhostMode && styles.ghostModeSwitchActive
        ]}>
          <View style={[
            styles.ghostModeSwitchKnob,
            isGhostMode && styles.ghostModeSwitchKnobActive
          ]} />
        </View>
      </TouchableOpacity>

      <View style={[styles.header, { borderBottomColor: ghostModeColors.headerBorder }]}>
        <View>
          <Text style={styles.title}>
            {isGhostMode ? '👻 Ghost Tabs' : 'Tabs'}
          </Text>
          <Text style={styles.subtitle}>{displayedTabs.length} open</Text>
        </View>
        <View style={styles.headerActions}>
          {/* New Ghost Tab Button - Always visible for quick access */}
          {!isGhostMode && (
            <TouchableOpacity 
              style={[
                styles.ghostTabButton,
              ]} 
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                toggleGhostMode(); // Enter Ghost Mode first
              }}
            >
              <Ionicons name="eye-off" size={18} color="#9B59B6" />
            </TouchableOpacity>
          )}
          <TouchableOpacity 
            style={[
              styles.addButton,
              { backgroundColor: ghostModeColors.accent }
            ]} 
            onPress={handleAddTab}
          >
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
  // Ghost Mode Toggle Styles
  ghostModeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#333',
  },
  ghostModeToggleActive: {
    backgroundColor: 'rgba(155, 89, 182, 0.15)',
  },
  ghostModeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostModeIconActive: {
    backgroundColor: 'rgba(155, 89, 182, 0.2)',
  },
  ghostModeTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  ghostModeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  ghostModeSubtitle: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  ghostModeSwitch: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#333',
    padding: 2,
    justifyContent: 'center',
  },
  ghostModeSwitchActive: {
    backgroundColor: '#9B59B6',
  },
  ghostModeSwitchKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#666',
  },
  ghostModeSwitchKnobActive: {
    backgroundColor: '#FFF',
    marginLeft: 'auto',
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
  ghostTabButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(155, 89, 182, 0.15)',
    borderWidth: 1,
    borderColor: '#9B59B6',
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
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2A2A2A',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
});
