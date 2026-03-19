/**
 * Smart Tab Management Store
 * 
 * Extends the browser store with advanced tab management features:
 * - Tab Groups with colors and names
 * - Pinned Tabs
 * - Tab Hibernation/Sleep
 * - Tab Undo (restore closed tabs)
 * - Tab Statistics
 * - Duplicate Detection
 */

import { create } from 'zustand';
import { Tab } from './browserStore';

// ============================================================================
// TYPES
// ============================================================================

export interface TabGroup {
  id: string;
  name: string;
  color: string;
  tabIds: string[];
  isExpanded: boolean;
  createdAt: number;
}

export interface ClosedTab {
  tab: Tab;
  closedAt: number;
  position: number;
  groupId?: string;
}

export interface TabMetadata {
  tabId: string;
  lastVisited: number;
  visitCount: number;
  isPinned: boolean;
  isHibernated: boolean;
  groupId?: string;
  thumbnail?: string;
  memorySaved?: number; // Bytes saved when hibernated
}

export interface TabStats {
  totalTabs: number;
  hibernatedTabs: number;
  pinnedTabs: number;
  groupedTabs: number;
  memorySavedMB: number;
  oldestTabDays: number;
}

// Predefined group suggestions
export const SUGGESTED_GROUPS = [
  { name: 'Work', color: '#3B82F6', icon: 'briefcase' },
  { name: 'Shopping', color: '#F59E0B', icon: 'cart' },
  { name: 'Social', color: '#EC4899', icon: 'people' },
  { name: 'Research', color: '#8B5CF6', icon: 'school' },
  { name: 'Entertainment', color: '#10B981', icon: 'game-controller' },
  { name: 'News', color: '#EF4444', icon: 'newspaper' },
];

// ============================================================================
// STORE
// ============================================================================

interface SmartTabStore {
  // Tab Groups
  groups: TabGroup[];
  createGroup: (name: string, color: string, tabIds?: string[]) => string;
  deleteGroup: (groupId: string) => void;
  addTabToGroup: (tabId: string, groupId: string) => void;
  removeTabFromGroup: (tabId: string) => void;
  toggleGroupExpanded: (groupId: string) => void;
  getTabGroup: (tabId: string) => TabGroup | null;

  // Tab Metadata
  tabMetadata: Record<string, TabMetadata>;
  updateTabMetadata: (tabId: string, updates: Partial<TabMetadata>) => void;
  getTabMetadata: (tabId: string) => TabMetadata | null;

  // Pinned Tabs
  pinTab: (tabId: string) => void;
  unpinTab: (tabId: string) => void;
  isPinned: (tabId: string) => boolean;

  // Tab Hibernation
  hibernateTab: (tabId: string, memorySaved?: number) => void;
  wakeTab: (tabId: string) => void;
  isHibernated: (tabId: string) => boolean;
  getHibernatedTabs: () => string[];

  // Tab Undo
  closedTabs: ClosedTab[];
  addToClosedTabs: (tab: Tab, position: number, groupId?: string) => void;
  undoCloseTab: () => ClosedTab | null;
  clearClosedTabs: () => void;
  canUndo: () => boolean;

  // Tab Statistics
  getTabStats: (totalTabs: number) => TabStats;

  // Smart Suggestions
  getStaleTabIds: (tabs: Tab[], daysSinceVisit?: number) => string[];
  getDuplicateTabIds: (tabs: Tab[]) => string[];

  // Search
  searchTabs: (tabs: Tab[], query: string) => Tab[];

  // Sort
  sortTabs: (tabs: Tab[], sortBy: 'recent' | 'alphabetical' | 'group') => Tab[];
}

let groupIdCounter = 0;

export const useSmartTabStore = create<SmartTabStore>((set, get) => ({
  // ── Tab Groups ──
  groups: [],

  createGroup: (name: string, color: string, tabIds: string[] = []) => {
    const id = `group_${Date.now()}_${++groupIdCounter}`;
    const newGroup: TabGroup = {
      id,
      name,
      color,
      tabIds,
      isExpanded: true,
      createdAt: Date.now(),
    };
    
    set((state) => ({
      groups: [...state.groups, newGroup],
    }));

    // Update tab metadata
    tabIds.forEach((tabId) => {
      get().updateTabMetadata(tabId, { groupId: id });
    });

    return id;
  },

  deleteGroup: (groupId: string) => {
    const group = get().groups.find((g) => g.id === groupId);
    if (!group) return;

    // Remove group from all tabs
    group.tabIds.forEach((tabId) => {
      get().updateTabMetadata(tabId, { groupId: undefined });
    });

    set((state) => ({
      groups: state.groups.filter((g) => g.id !== groupId),
    }));
  },

  addTabToGroup: (tabId: string, groupId: string) => {
    // Remove from existing group first
    get().removeTabFromGroup(tabId);

    set((state) => ({
      groups: state.groups.map((g) =>
        g.id === groupId
          ? { ...g, tabIds: [...g.tabIds, tabId] }
          : g
      ),
    }));

    get().updateTabMetadata(tabId, { groupId });
  },

  removeTabFromGroup: (tabId: string) => {
    const currentGroup = get().getTabGroup(tabId);
    if (!currentGroup) return;

    set((state) => ({
      groups: state.groups.map((g) =>
        g.id === currentGroup.id
          ? { ...g, tabIds: g.tabIds.filter((id) => id !== tabId) }
          : g
      ),
    }));

    get().updateTabMetadata(tabId, { groupId: undefined });
  },

  toggleGroupExpanded: (groupId: string) => {
    set((state) => ({
      groups: state.groups.map((g) =>
        g.id === groupId ? { ...g, isExpanded: !g.isExpanded } : g
      ),
    }));
  },

  getTabGroup: (tabId: string) => {
    return get().groups.find((g) => g.tabIds.includes(tabId)) || null;
  },

  // ── Tab Metadata ──
  tabMetadata: {},

  updateTabMetadata: (tabId: string, updates: Partial<TabMetadata>) => {
    set((state) => {
      const existing = state.tabMetadata[tabId] || {
        tabId,
        lastVisited: Date.now(),
        visitCount: 0,
        isPinned: false,
        isHibernated: false,
      };
      return {
        tabMetadata: {
          ...state.tabMetadata,
          [tabId]: { ...existing, ...updates },
        },
      };
    });
  },

  getTabMetadata: (tabId: string) => {
    return get().tabMetadata[tabId] || null;
  },

  // ── Pinned Tabs ──
  pinTab: (tabId: string) => {
    get().updateTabMetadata(tabId, { isPinned: true });
  },

  unpinTab: (tabId: string) => {
    get().updateTabMetadata(tabId, { isPinned: false });
  },

  isPinned: (tabId: string) => {
    return get().tabMetadata[tabId]?.isPinned || false;
  },

  // ── Tab Hibernation ──
  hibernateTab: (tabId: string, memorySaved?: number) => {
    get().updateTabMetadata(tabId, { isHibernated: true, memorySaved });
  },

  wakeTab: (tabId: string) => {
    get().updateTabMetadata(tabId, { isHibernated: false, memorySaved: undefined });
  },

  isHibernated: (tabId: string) => {
    return get().tabMetadata[tabId]?.isHibernated || false;
  },

  getHibernatedTabs: () => {
    const { tabMetadata } = get();
    return Object.keys(tabMetadata).filter((id) => tabMetadata[id].isHibernated);
  },

  // ── Tab Undo ──
  closedTabs: [],

  addToClosedTabs: (tab: Tab, position: number, groupId?: string) => {
    set((state) => {
      const closedTabs = [
        { tab, closedAt: Date.now(), position, groupId },
        ...state.closedTabs,
      ].slice(0, 5); // Keep only last 5
      return { closedTabs };
    });
  },

  undoCloseTab: () => {
    const { closedTabs } = get();
    if (closedTabs.length === 0) return null;

    const [restored, ...rest] = closedTabs;
    set({ closedTabs: rest });
    return restored;
  },

  clearClosedTabs: () => {
    set({ closedTabs: [] });
  },

  canUndo: () => {
    return get().closedTabs.length > 0;
  },

  // ── Tab Statistics ──
  getTabStats: (totalTabs: number) => {
    const { tabMetadata, groups } = get();
    const metadataValues = Object.values(tabMetadata);

    const hibernatedTabs = metadataValues.filter((m) => m.isHibernated).length;
    const pinnedTabs = metadataValues.filter((m) => m.isPinned).length;
    const groupedTabs = groups.reduce((sum, g) => sum + g.tabIds.length, 0);
    const memorySavedBytes = metadataValues.reduce(
      (sum, m) => sum + (m.memorySaved || 0),
      0
    );

    // Calculate oldest tab
    const now = Date.now();
    let oldestDays = 0;
    metadataValues.forEach((m) => {
      const days = Math.floor((now - m.lastVisited) / (1000 * 60 * 60 * 24));
      if (days > oldestDays) oldestDays = days;
    });

    return {
      totalTabs,
      hibernatedTabs,
      pinnedTabs,
      groupedTabs,
      memorySavedMB: Math.round(memorySavedBytes / (1024 * 1024)),
      oldestTabDays: oldestDays,
    };
  },

  // ── Smart Suggestions ──
  getStaleTabIds: (tabs: Tab[], daysSinceVisit: number = 3) => {
    const { tabMetadata } = get();
    const now = Date.now();
    const thresholdMs = daysSinceVisit * 24 * 60 * 60 * 1000;

    return tabs
      .filter((tab) => {
        const meta = tabMetadata[tab.id];
        if (!meta) return false;
        if (meta.isPinned) return false; // Never suggest pinned tabs
        return now - meta.lastVisited > thresholdMs;
      })
      .map((tab) => tab.id);
  },

  getDuplicateTabIds: (tabs: Tab[]) => {
    const urlMap = new Map<string, string[]>();
    
    tabs.forEach((tab) => {
      try {
        // Normalize URL
        const url = new URL(tab.url);
        const normalized = `${url.hostname}${url.pathname}`;
        const existing = urlMap.get(normalized) || [];
        urlMap.set(normalized, [...existing, tab.id]);
      } catch {
        // Invalid URL, skip
      }
    });

    // Return all but the first (most recent) tab for each duplicate URL
    const duplicates: string[] = [];
    urlMap.forEach((ids) => {
      if (ids.length > 1) {
        duplicates.push(...ids.slice(1));
      }
    });

    return duplicates;
  },

  // ── Search ──
  searchTabs: (tabs: Tab[], query: string) => {
    if (!query.trim()) return tabs;
    
    const lowerQuery = query.toLowerCase();
    return tabs.filter(
      (tab) =>
        tab.title.toLowerCase().includes(lowerQuery) ||
        tab.url.toLowerCase().includes(lowerQuery)
    );
  },

  // ── Sort ──
  sortTabs: (tabs: Tab[], sortBy: 'recent' | 'alphabetical' | 'group') => {
    const { tabMetadata, groups } = get();
    const sortedTabs = [...tabs];

    switch (sortBy) {
      case 'recent':
        sortedTabs.sort((a, b) => {
          const metaA = tabMetadata[a.id];
          const metaB = tabMetadata[b.id];
          return (metaB?.lastVisited || 0) - (metaA?.lastVisited || 0);
        });
        break;

      case 'alphabetical':
        sortedTabs.sort((a, b) => 
          (a.title || '').localeCompare(b.title || '')
        );
        break;

      case 'group':
        // Sort by group, then ungrouped
        sortedTabs.sort((a, b) => {
          const groupA = groups.find((g) => g.tabIds.includes(a.id));
          const groupB = groups.find((g) => g.tabIds.includes(b.id));
          
          if (groupA && !groupB) return -1;
          if (!groupA && groupB) return 1;
          if (groupA && groupB) {
            return groupA.name.localeCompare(groupB.name);
          }
          return 0;
        });
        break;
    }

    // Always put pinned tabs first
    const pinned = sortedTabs.filter((t) => tabMetadata[t.id]?.isPinned);
    const unpinned = sortedTabs.filter((t) => !tabMetadata[t.id]?.isPinned);
    
    return [...pinned, ...unpinned];
  },
}));

export default useSmartTabStore;
