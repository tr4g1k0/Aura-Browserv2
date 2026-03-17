import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

interface BrowserState {
  tabs: Tab[];
  activeTabId: string | null;
  settings: BrowserSettings;
  cachedPages: CachedPage[];
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

  loadPersistedState: async () => {
    try {
      const saved = await AsyncStorage.getItem('browser-state');
      if (saved) {
        const parsed = JSON.parse(saved);
        set((state) => ({
          tabs: parsed.tabs || state.tabs,
          settings: { ...state.settings, ...parsed.settings },
          activeTabId: parsed.activeTabId || state.tabs[0]?.id,
        }));
      }
    } catch (e) {
      console.error('Failed to load persisted state', e);
    }
  },

  persistState: async () => {
    try {
      const state = get();
      await AsyncStorage.setItem(
        'browser-state',
        JSON.stringify({
          tabs: state.tabs,
          settings: state.settings,
          activeTabId: state.activeTabId,
        })
      );
    } catch (e) {
      console.error('Failed to persist state', e);
    }
  },
}));
