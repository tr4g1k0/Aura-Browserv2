import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBrowserStore, Tab } from '../src/store/browserStore';
import * as Haptics from 'expo-haptics';

const EXPO_PUBLIC_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface TabGroup {
  category: string;
  tabs: Tab[];
  color: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  Shopping: '#FF6B6B',
  Research: '#4ECDC4',
  Entertainment: '#A78BFA',
  News: '#F59E0B',
  Social: '#EC4899',
  Work: '#3B82F6',
  Other: '#6B7280',
};

export default function TabsManagerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { tabs, addTab, removeTab, setActiveTab } = useBrowserStore();

  const [tabGroups, setTabGroups] = useState<TabGroup[]>([]);
  const [isGrouping, setIsGrouping] = useState(false);
  const [groupBriefs, setGroupBriefs] = useState<Record<string, string>>({});
  const [loadingBrief, setLoadingBrief] = useState<string | null>(null);

  const handleClose = () => {
    router.back();
  };

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

  // AI-powered tab grouping
  const groupTabsByIntent = async () => {
    setIsGrouping(true);
    
    try {
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/tabs/categorize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tabs: tabs.map((t) => ({
            id: t.id,
            title: t.title,
            url: t.url,
            metaDescription: t.metaDescription,
          })),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const groups: TabGroup[] = [];
        
        // Group tabs by AI-assigned category
        const categoryMap = new Map<string, Tab[]>();
        
        for (const item of data.categorizedTabs) {
          const tab = tabs.find((t) => t.id === item.id);
          if (tab) {
            const category = item.category || 'Other';
            if (!categoryMap.has(category)) {
              categoryMap.set(category, []);
            }
            categoryMap.get(category)!.push({ ...tab, aiCategory: category });
          }
        }
        
        categoryMap.forEach((categoryTabs, category) => {
          groups.push({
            category,
            tabs: categoryTabs,
            color: CATEGORY_COLORS[category] || CATEGORY_COLORS.Other,
          });
        });
        
        setTabGroups(groups);
      }
    } catch (error) {
      console.error('Failed to categorize tabs:', error);
      // Fallback: group all tabs under "Other"
      setTabGroups([{
        category: 'All Tabs',
        tabs,
        color: CATEGORY_COLORS.Other,
      }]);
    }
    
    setIsGrouping(false);
  };

  // Generate AI brief for a group
  const generateBrief = async (category: string) => {
    setLoadingBrief(category);
    
    const group = tabGroups.find((g) => g.category === category);
    if (!group) return;
    
    try {
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/tabs/brief`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          tabs: group.tabs.map((t) => ({
            title: t.title,
            url: t.url,
          })),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setGroupBriefs((prev) => ({
          ...prev,
          [category]: data.brief,
        }));
      }
    } catch (error) {
      console.error('Failed to generate brief:', error);
    }
    
    setLoadingBrief(null);
  };

  useEffect(() => {
    if (tabs.length > 1) {
      groupTabsByIntent();
    } else {
      setTabGroups([{
        category: 'All Tabs',
        tabs,
        color: CATEGORY_COLORS.Other,
      }]);
    }
  }, [tabs.length]);

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
            {new URL(tab.url).hostname}
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

  const renderGroup = (group: TabGroup) => (
    <View key={group.category} style={styles.groupContainer}>
      <View style={styles.groupHeader}>
        <View style={[styles.categoryBadge, { backgroundColor: group.color + '20' }]}>
          <View style={[styles.categoryDot, { backgroundColor: group.color }]} />
          <Text style={[styles.categoryText, { color: group.color }]}>
            {group.category}
          </Text>
          <Text style={styles.tabCount}>{group.tabs.length}</Text>
        </View>
        
        <TouchableOpacity
          style={styles.briefButton}
          onPress={() => generateBrief(group.category)}
          disabled={loadingBrief === group.category}
        >
          {loadingBrief === group.category ? (
            <ActivityIndicator size="small" color="#00FF88" />
          ) : (
            <>
              <Ionicons name="document-text" size={14} color="#00FF88" />
              <Text style={styles.briefButtonText}>Brief</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {groupBriefs[group.category] && (
        <View style={styles.briefContainer}>
          <Text style={styles.briefText}>{groupBriefs[group.category]}</Text>
        </View>
      )}

      {group.tabs.map(renderTabCard)}
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Tabs</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.addButton}
            onPress={handleAddTab}
          >
            <Ionicons name="add" size={24} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleClose}
          >
            <Ionicons name="close" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {isGrouping ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#00FF88" />
            <Text style={styles.loadingText}>Organizing tabs by intent...</Text>
          </View>
        ) : (
          tabGroups.map(renderGroup)
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#888',
  },
  groupContainer: {
    marginBottom: 24,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '600',
  },
  tabCount: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
  },
  briefButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#1A2A1A',
    gap: 4,
  },
  briefButtonText: {
    fontSize: 12,
    color: '#00FF88',
    fontWeight: '600',
  },
  briefContainer: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#00FF88',
  },
  briefText: {
    fontSize: 13,
    color: '#CCC',
    lineHeight: 20,
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
