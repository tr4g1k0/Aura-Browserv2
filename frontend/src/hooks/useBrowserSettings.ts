// useBrowserSettings Hook
// Manages and persists browser settings using AsyncStorage

import { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';

// Safe AsyncStorage import with fallback
let AsyncStorage: any = null;
try {
  AsyncStorage = require('@react-native-async-storage/async-storage').default;
} catch (e) {
  console.log('AsyncStorage not available');
}

// In-memory fallback storage
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

export type SearchEngine = 'google' | 'duckduckgo' | 'bing';
export type CaptioningLanguage = 'english' | 'spanish' | 'french' | 'german' | 'japanese' | 'chinese';
export type AddressBarPosition = 'top' | 'bottom';

export interface ToolbarShortcuts {
  showLiveCaptioning: boolean;
  showAIAgent: boolean;
  showVPNToggle: boolean;
  showAdBlockStatus: boolean;
  showShare: boolean;
}

export interface BrowserSettings {
  // AI & Accessibility
  strictLocalAI: boolean;
  aiHistoryEnabled: boolean;      // Semantic Time-Machine: AI-powered history
  captioningLanguage: CaptioningLanguage;
  liveCaptioningEnabled: boolean;
  ambientAwarenessEnabled: boolean;
  
  // Privacy & Security
  aggressiveAdBlocking: boolean;
  alwaysOnVPN: boolean;
  doNotTrack: boolean;
  
  // General Browsing
  defaultSearchEngine: SearchEngine;
  requestDesktopSite: boolean;
  predictiveCaching: boolean;
  
  // Display
  darkMode: boolean;
  
  // Toolbar Customization
  addressBarPosition: AddressBarPosition;
  toolbarShortcuts: ToolbarShortcuts;
}

export const DEFAULT_TOOLBAR_SHORTCUTS: ToolbarShortcuts = {
  showLiveCaptioning: false,
  showAIAgent: false,
  showVPNToggle: false,
  showAdBlockStatus: false,
  showShare: false,
};

export const DEFAULT_BROWSER_SETTINGS: BrowserSettings = {
  // AI & Accessibility
  strictLocalAI: false,
  aiHistoryEnabled: true,         // Semantic Time-Machine enabled by default
  captioningLanguage: 'english',
  liveCaptioningEnabled: false,
  ambientAwarenessEnabled: false,
  
  // Privacy & Security
  aggressiveAdBlocking: true,
  alwaysOnVPN: false,
  doNotTrack: true,
  
  // General Browsing
  defaultSearchEngine: 'google',
  requestDesktopSite: false,
  predictiveCaching: true,
  
  // Display
  darkMode: true,
  
  // Toolbar Customization
  addressBarPosition: 'bottom',
  toolbarShortcuts: DEFAULT_TOOLBAR_SHORTCUTS,
};

const SETTINGS_STORAGE_KEY = '@access_browser_settings';

export interface UseBrowserSettingsReturn {
  settings: BrowserSettings;
  updateSetting: <K extends keyof BrowserSettings>(key: K, value: BrowserSettings[K]) => void;
  updateSettings: (newSettings: Partial<BrowserSettings>) => void;
  resetSettings: () => void;
  clearBrowsingData: () => Promise<void>;
  isLoading: boolean;
}

export const useBrowserSettings = (): UseBrowserSettingsReturn => {
  const [settings, setSettings] = useState<BrowserSettings>(DEFAULT_BROWSER_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const stored = await safeGetItem(SETTINGS_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          setSettings({ ...DEFAULT_BROWSER_SETTINGS, ...parsed });
        }
      } catch (e) {
        console.log('Failed to load settings, using defaults');
      } finally {
        setIsLoading(false);
      }
    };
    loadSettings();
  }, []);

  // Persist settings whenever they change
  const persistSettings = useCallback(async (newSettings: BrowserSettings) => {
    try {
      await safeSetItem(SETTINGS_STORAGE_KEY, JSON.stringify(newSettings));
    } catch (e) {
      console.log('Failed to persist settings');
    }
  }, []);

  // Update a single setting
  const updateSetting = useCallback(<K extends keyof BrowserSettings>(
    key: K,
    value: BrowserSettings[K]
  ) => {
    setSettings(prev => {
      const newSettings = { ...prev, [key]: value };
      persistSettings(newSettings);
      
      // AUDIT: Console log for debugging state changes
      console.log(`[Settings] ${String(key)} set to ${JSON.stringify(value)}`);
      
      return newSettings;
    });
  }, [persistSettings]);

  // Update multiple settings at once
  const updateSettings = useCallback((newSettings: Partial<BrowserSettings>) => {
    setSettings(prev => {
      const merged = { ...prev, ...newSettings };
      persistSettings(merged);
      return merged;
    });
  }, [persistSettings]);

  // Reset to defaults
  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_BROWSER_SETTINGS);
    persistSettings(DEFAULT_BROWSER_SETTINGS);
  }, [persistSettings]);

  // Clear browsing data (mock implementation)
  const clearBrowsingData = useCallback(async () => {
    // In a real implementation, this would clear:
    // - Browsing history
    // - Cached pages
    // - Cookies and site data
    // - Downloaded files
    
    // For now, we'll clear any cached data in AsyncStorage
    try {
      if (AsyncStorage) {
        const keys = await AsyncStorage.getAllKeys();
        const dataKeys = keys.filter((k: string) => 
          k.startsWith('@access_browser_') && k !== SETTINGS_STORAGE_KEY
        );
        if (dataKeys.length > 0) {
          await AsyncStorage.multiRemove(dataKeys);
        }
      }
      // Clear memory storage except settings
      Object.keys(memoryStorage).forEach(key => {
        if (key !== SETTINGS_STORAGE_KEY) {
          delete memoryStorage[key];
        }
      });
    } catch (e) {
      console.log('Failed to clear browsing data');
    }
  }, []);

  return {
    settings,
    updateSetting,
    updateSettings,
    resetSettings,
    clearBrowsingData,
    isLoading,
  };
};
