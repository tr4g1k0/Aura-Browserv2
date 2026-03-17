import { create } from 'zustand';
import { Platform } from 'react-native';

// Safely import AsyncStorage with fallback for Expo Go
let AsyncStorage: any = null;
try {
  AsyncStorage = require('@react-native-async-storage/async-storage').default;
} catch (e) {
  console.log('AsyncStorage not available');
}

// In-memory fallback storage for platforms without AsyncStorage
const memoryStorage: Record<string, string> = {};

const safeGetItem = async (key: string): Promise<string | null> => {
  try {
    if (AsyncStorage) {
      return await AsyncStorage.getItem(key);
    }
    return memoryStorage[key] || null;
  } catch (e) {
    return memoryStorage[key] || null;
  }
};

const safeSetItem = async (key: string, value: string): Promise<void> => {
  try {
    if (AsyncStorage) {
      await AsyncStorage.setItem(key, value);
    }
    memoryStorage[key] = value;
  } catch (e) {
    memoryStorage[key] = value;
  }
};

export interface Tab {
  id: string;
  url: string;
  title: string;
  favicon?: string;
  isActive: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  metaDescription?: string;
  aiCategory?: string;
  // Tab Virtualization: State preservation
  scrollY: number;           // Saved scroll position
  lastActiveTime: number;    // When tab was last active
}

export interface BrowserSettings {
  adblockEnabled: boolean;
  vpnEnabled: boolean;
  liveCaptioningEnabled: boolean;
  ambientAwarenessEnabled: boolean;
  predictiveCachingEnabled: boolean;
}

export interface CachedPage {
  url: string;
  html: string;
  timestamp: number;
}

export interface HistoryEntry {
  url: string;
  title: string;
  timestamp: number;
  favicon?: string;
}

export interface Bookmark {
  url: string;
  title: string;
  favicon?: string;
  addedAt: number;
}

interface BrowserState {
  tabs: Tab[];
  ghostTabs: Tab[];  // Separate tabs for Ghost Mode
  activeTabId: string | null;
  settings: BrowserSettings;
  cachedPages: CachedPage[];
  history: HistoryEntry[];
  bookmarks: Bookmark[];
  isLoading: boolean;
  searchQuery: string;
  ambientAlerts: string[];
  liveCaptions: string[];
  isGhostMode: boolean;  // Ghost Mode (Incognito) flag
  
  // Actions
  addTab: (url?: string) => void;
  removeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateTab: (id: string, updates: Partial<Tab>) => void;
  saveTabScrollPosition: (id: string, scrollY: number) => void;
  switchToTab: (id: string, currentScrollY?: number) => void;
  toggleAdblock: () => void;
  toggleVPN: () => void;
  toggleLiveCaptioning: () => void;
  toggleAmbientAwareness: () => void;
  setSearchQuery: (query: string) => void;
  setLoading: (loading: boolean) => void;
  addCachedPage: (page: CachedPage) => void;
  getCachedPage: (url: string) => CachedPage | undefined;
  addAmbientAlert: (alert: string) => void;
  clearAmbientAlerts: () => void;
  addLiveCaption: (caption: string) => void;
  clearLiveCaptions: () => void;
  // History actions
  addToHistory: (url: string, title: string, favicon?: string) => void;
  clearHistory: () => void;
  removeFromHistory: (timestamp: number) => void;
  // Bookmark actions
  addBookmark: (url: string, title: string, favicon?: string) => void;
  removeBookmark: (url: string) => void;
  isBookmarked: (url: string) => boolean;
  toggleBookmark: (url: string, title: string, favicon?: string) => void;
  // Ghost Mode actions
  toggleGhostMode: () => void;
  setGhostMode: (enabled: boolean) => void;
  loadPersistedState: () => Promise<void>;
  persistState: () => Promise<void>;
}

const DEFAULT_URL = 'https://www.google.com';

const generateId = () => Math.random().toString(36).substring(2, 9);

export const useBrowserStore = create<BrowserState>((set, get) => ({
  tabs: [
    {
      id: generateId(),
      url: DEFAULT_URL,
      title: 'Google',
      isActive: true,
      canGoBack: false,
      canGoForward: false,
      scrollY: 0,
      lastActiveTime: Date.now(),
    },
  ],
  activeTabId: null,
  settings: {
    adblockEnabled: true,
    vpnEnabled: false,
    liveCaptioningEnabled: false,
    ambientAwarenessEnabled: false,
    predictiveCachingEnabled: true,
  },
  cachedPages: [],
  history: [],
  bookmarks: [],
  isLoading: false,
  searchQuery: '',
  ambientAlerts: [],
  liveCaptions: [],
  isGhostMode: false,
  ghostTabs: [],

  addTab: (url = DEFAULT_URL) => {
    const newTab: Tab = {
      id: generateId(),
      url,
      title: 'New Tab',
      isActive: true,
      canGoBack: false,
      canGoForward: false,
      scrollY: 0,
      lastActiveTime: Date.now(),
    };
    
    const state = get();
    
    if (state.isGhostMode) {
      // In Ghost Mode, add to ghostTabs instead
      // Save current tab's state before switching
      set((state) => ({
        ghostTabs: state.ghostTabs.map((t) => ({ 
          ...t, 
          isActive: false,
          lastActiveTime: t.isActive ? Date.now() : t.lastActiveTime,
        })).concat(newTab),
        activeTabId: newTab.id,
      }));
    } else {
      // Save current tab's state before switching
      set((state) => ({
        tabs: state.tabs.map((t) => ({ 
          ...t, 
          isActive: false,
          lastActiveTime: t.isActive ? Date.now() : t.lastActiveTime,
        })).concat(newTab),
        activeTabId: newTab.id,
      }));
      get().persistState();
    }
  },

  removeTab: (id) => {
    const state = get();
    
    if (state.isGhostMode) {
      // In Ghost Mode, remove from ghostTabs
      set((state) => {
        const newTabs = state.ghostTabs.filter((t) => t.id !== id);
        if (newTabs.length === 0) {
          const newTab: Tab = {
            id: generateId(),
            url: DEFAULT_URL,
            title: 'New Tab',
            isActive: true,
            canGoBack: false,
            canGoForward: false,
            scrollY: 0,
            lastActiveTime: Date.now(),
          };
          return { ghostTabs: [newTab], activeTabId: newTab.id };
        }
        const wasActive = state.ghostTabs.find((t) => t.id === id)?.isActive;
        if (wasActive && newTabs.length > 0) {
          newTabs[newTabs.length - 1].isActive = true;
          newTabs[newTabs.length - 1].lastActiveTime = Date.now();
          return { ghostTabs: newTabs, activeTabId: newTabs[newTabs.length - 1].id };
        }
        return { ghostTabs: newTabs };
      });
    } else {
      set((state) => {
        const newTabs = state.tabs.filter((t) => t.id !== id);
        if (newTabs.length === 0) {
          const newTab: Tab = {
            id: generateId(),
            url: DEFAULT_URL,
            title: 'New Tab',
            isActive: true,
            canGoBack: false,
            canGoForward: false,
            scrollY: 0,
            lastActiveTime: Date.now(),
          };
          return { tabs: [newTab], activeTabId: newTab.id };
        }
        const wasActive = state.tabs.find((t) => t.id === id)?.isActive;
        if (wasActive && newTabs.length > 0) {
          newTabs[newTabs.length - 1].isActive = true;
          newTabs[newTabs.length - 1].lastActiveTime = Date.now();
          return { tabs: newTabs, activeTabId: newTabs[newTabs.length - 1].id };
        }
        return { tabs: newTabs };
      });
      get().persistState();
    }
  },

  setActiveTab: (id) => {
    const state = get();
    
    if (state.isGhostMode) {
      set((state) => ({
        ghostTabs: state.ghostTabs.map((t) => ({ 
          ...t, 
          isActive: t.id === id,
          lastActiveTime: t.id === id ? Date.now() : t.lastActiveTime,
        })),
        activeTabId: id,
      }));
    } else {
      set((state) => ({
        tabs: state.tabs.map((t) => ({ 
          ...t, 
          isActive: t.id === id,
          lastActiveTime: t.id === id ? Date.now() : t.lastActiveTime,
        })),
        activeTabId: id,
      }));
      get().persistState();
    }
  },

  // Tab Virtualization: Save scroll position for a specific tab
  saveTabScrollPosition: (id, scrollY) => {
    const state = get();
    
    if (state.isGhostMode) {
      set((state) => ({
        ghostTabs: state.ghostTabs.map((t) => 
          t.id === id ? { ...t, scrollY } : t
        ),
      }));
    } else {
      set((state) => ({
        tabs: state.tabs.map((t) => 
          t.id === id ? { ...t, scrollY } : t
        ),
      }));
    }
  },

  // Tab Virtualization: Switch tab with scroll position preservation
  switchToTab: (id, currentScrollY) => {
    const state = get();
    const currentTabs = state.isGhostMode ? state.ghostTabs : state.tabs;
    const activeTab = currentTabs.find((t) => t.isActive);
    
    // Save current tab's scroll position before switching
    if (activeTab && currentScrollY !== undefined) {
      get().saveTabScrollPosition(activeTab.id, currentScrollY);
    }
    
    // Now switch to the new tab
    get().setActiveTab(id);
  },

  updateTab: (id, updates) => {
    const state = get();
    
    if (state.isGhostMode) {
      set((state) => ({
        ghostTabs: state.ghostTabs.map((t) => (t.id === id ? { ...t, ...updates } : t)),
      }));
    } else {
      set((state) => ({
        tabs: state.tabs.map((t) => (t.id === id ? { ...t, ...updates } : t)),
      }));
    }
  },

  toggleAdblock: () => {
    set((state) => ({
      settings: { ...state.settings, adblockEnabled: !state.settings.adblockEnabled },
    }));
    get().persistState();
  },

  toggleVPN: () => {
    set((state) => ({
      settings: { ...state.settings, vpnEnabled: !state.settings.vpnEnabled },
    }));
    get().persistState();
  },

  toggleLiveCaptioning: () => {
    set((state) => ({
      settings: { ...state.settings, liveCaptioningEnabled: !state.settings.liveCaptioningEnabled },
    }));
    get().persistState();
  },

  toggleAmbientAwareness: () => {
    set((state) => ({
      settings: { ...state.settings, ambientAwarenessEnabled: !state.settings.ambientAwarenessEnabled },
    }));
    get().persistState();
  },

  setSearchQuery: (query) => set({ searchQuery: query }),
  setLoading: (loading) => set({ isLoading: loading }),

  addCachedPage: (page) => {
    set((state) => {
      const existing = state.cachedPages.filter((p) => p.url !== page.url);
      return { cachedPages: [...existing, page].slice(-10) }; // Keep last 10
    });
  },

  getCachedPage: (url) => {
    const state = get();
    const cached = state.cachedPages.find((p) => p.url === url);
    if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
      return cached;
    }
    return undefined;
  },

  addAmbientAlert: (alert) => {
    set((state) => ({
      ambientAlerts: [...state.ambientAlerts, alert].slice(-5),
    }));
  },

  clearAmbientAlerts: () => set({ ambientAlerts: [] }),

  addLiveCaption: (caption) => {
    set((state) => ({
      liveCaptions: [...state.liveCaptions, caption].slice(-10),
    }));
  },

  clearLiveCaptions: () => set({ liveCaptions: [] }),

  // History actions
  addToHistory: (url: string, title: string, favicon?: string) => {
    // DATA BLACKOUT: Skip history logging in Ghost Mode
    if (get().isGhostMode) {
      console.log('[Ghost Mode] History logging bypassed');
      return;
    }
    
    // Skip internal pages and empty URLs
    if (!url || url === 'about:blank' || url === 'about:newtab') {
      return;
    }
    
    set((state) => {
      const now = Date.now();
      // Avoid duplicate entries within 5 seconds for the same URL
      const recentMatch = state.history.find(
        (h) => h.url === url && now - h.timestamp < 5000
      );
      if (recentMatch) {
        return state;
      }
      
      const newEntry: HistoryEntry = {
        url,
        title: title || url,
        timestamp: now,
        favicon,
      };
      
      // Keep only the 500 most recent entries
      const updatedHistory = [newEntry, ...state.history].slice(0, 500);
      return { history: updatedHistory };
    });
    get().persistState();
  },

  clearHistory: () => {
    set({ history: [] });
    get().persistState();
  },

  removeFromHistory: (timestamp: number) => {
    set((state) => ({
      history: state.history.filter((h) => h.timestamp !== timestamp),
    }));
    get().persistState();
  },

  // Bookmark actions
  addBookmark: (url: string, title: string, favicon?: string) => {
    set((state) => {
      // Don't add duplicates
      if (state.bookmarks.some((b) => b.url === url)) {
        return state;
      }
      
      const newBookmark: Bookmark = {
        url,
        title: title || url,
        favicon,
        addedAt: Date.now(),
      };
      
      return { bookmarks: [newBookmark, ...state.bookmarks] };
    });
    get().persistState();
  },

  removeBookmark: (url: string) => {
    set((state) => ({
      bookmarks: state.bookmarks.filter((b) => b.url !== url),
    }));
    get().persistState();
  },

  isBookmarked: (url: string) => {
    return get().bookmarks.some((b) => b.url === url);
  },

  toggleBookmark: (url: string, title: string, favicon?: string) => {
    const state = get();
    if (state.bookmarks.some((b) => b.url === url)) {
      state.removeBookmark(url);
    } else {
      state.addBookmark(url, title, favicon);
    }
  },

  // Ghost Mode actions
  toggleGhostMode: () => {
    const state = get();
    const newGhostMode = !state.isGhostMode;
    
    if (newGhostMode) {
      // Entering Ghost Mode - create a fresh ghost tab
      const ghostTab: Tab = {
        id: generateId(),
        url: DEFAULT_URL,
        title: 'Ghost Tab',
        isActive: true,
        canGoBack: false,
        canGoForward: false,
        scrollY: 0,
        lastActiveTime: Date.now(),
      };
      set({
        isGhostMode: true,
        ghostTabs: [ghostTab],
        activeTabId: ghostTab.id,
      });
      console.log('[Ghost Mode] Enabled - all browsing data will NOT be saved');
    } else {
      // Exiting Ghost Mode - destroy all ghost tabs and switch back to regular tabs
      const regularTabs = state.tabs;
      const activeRegularTab = regularTabs.find((t) => t.isActive) || regularTabs[0];
      
      set({
        isGhostMode: false,
        ghostTabs: [], // Destroy all ghost tabs
        activeTabId: activeRegularTab?.id || null,
      });
      console.log('[Ghost Mode] Disabled - ghost tabs destroyed');
    }
  },

  setGhostMode: (enabled: boolean) => {
    if (enabled !== get().isGhostMode) {
      get().toggleGhostMode();
    }
  },

  loadPersistedState: async () => {
    try {
      const saved = await safeGetItem('browser-state');
      if (saved) {
        const parsed = JSON.parse(saved);
        set((state) => ({
          tabs: parsed.tabs || state.tabs,
          settings: { ...state.settings, ...parsed.settings },
          activeTabId: parsed.activeTabId || state.tabs[0]?.id,
          history: parsed.history || state.history,
          bookmarks: parsed.bookmarks || state.bookmarks,
        }));
      }
    } catch (e) {
      // AsyncStorage may not be available on all platforms (e.g., Expo Go on Android)
      console.log('Storage not available, using default state');
    }
  },

  persistState: async () => {
    try {
      const state = get();
      await safeSetItem(
        'browser-state',
        JSON.stringify({
          tabs: state.tabs,
          settings: state.settings,
          activeTabId: state.activeTabId,
          history: state.history,
          bookmarks: state.bookmarks,
        })
      );
    } catch (e) {
      // Storage may not be available on all platforms
      console.log('Unable to persist state');
    }
  },
}));
