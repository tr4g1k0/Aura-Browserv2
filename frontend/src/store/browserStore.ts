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
  activeTabId: string | null;
  settings: BrowserSettings;
  cachedPages: CachedPage[];
  history: HistoryEntry[];
  bookmarks: Bookmark[];
  isLoading: boolean;
  searchQuery: string;
  ambientAlerts: string[];
  liveCaptions: string[];
  
  // Actions
  addTab: (url?: string) => void;
  removeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateTab: (id: string, updates: Partial<Tab>) => void;
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

  addTab: (url = DEFAULT_URL) => {
    const newTab: Tab = {
      id: generateId(),
      url,
      title: 'New Tab',
      isActive: true,
      canGoBack: false,
      canGoForward: false,
    };
    set((state) => ({
      tabs: state.tabs.map((t) => ({ ...t, isActive: false })).concat(newTab),
      activeTabId: newTab.id,
    }));
    get().persistState();
  },

  removeTab: (id) => {
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
        };
        return { tabs: [newTab], activeTabId: newTab.id };
      }
      const wasActive = state.tabs.find((t) => t.id === id)?.isActive;
      if (wasActive && newTabs.length > 0) {
        newTabs[newTabs.length - 1].isActive = true;
        return { tabs: newTabs, activeTabId: newTabs[newTabs.length - 1].id };
      }
      return { tabs: newTabs };
    });
    get().persistState();
  },

  setActiveTab: (id) => {
    set((state) => ({
      tabs: state.tabs.map((t) => ({ ...t, isActive: t.id === id })),
      activeTabId: id,
    }));
    get().persistState();
  },

  updateTab: (id, updates) => {
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    }));
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
