/**
 * Kids Mode Store
 * 
 * Manages all Kids Mode state including:
 * - Activation state and PIN
 * - Age group settings
 * - Time limits
 * - Allowed/blocked sites
 * - Activity tracking
 */

import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Safe AsyncStorage import
let AsyncStorage: any = null;
try {
  AsyncStorage = require('@react-native-async-storage/async-storage').default;
} catch (e) {
  console.log('[KidsMode] AsyncStorage not available');
}

// ============================================================================
// TYPES
// ============================================================================

export type AgeGroup = 'little-kids' | 'kids' | 'teens';
export type TimeLimit = 30 | 60 | 120 | 'unlimited';

export interface KidsModeConfig {
  isSetup: boolean;
  childName: string;
  ageGroup: AgeGroup;
  timeLimit: TimeLimit; // minutes
  customAllowedSites: string[];
  customBlockedSites: string[];
}

export interface ActivityLogEntry {
  url: string;
  title: string;
  timestamp: number;
  duration: number; // seconds spent on page
  wasBlocked: boolean;
}

export interface DailyReport {
  date: string; // YYYY-MM-DD
  totalTimeMinutes: number;
  sitesVisited: string[];
  blockedAttempts: number;
  entries: ActivityLogEntry[];
}

interface KidsModeStore {
  // Core state
  isActive: boolean;
  config: KidsModeConfig;
  
  // Time tracking
  todayUsageMinutes: number;
  sessionStartTime: number | null;
  isTimeLimitReached: boolean;
  
  // PIN lockout
  failedAttempts: number;
  lockoutUntil: number | null;
  
  // Activity tracking
  currentActivity: ActivityLogEntry | null;
  todayActivity: ActivityLogEntry[];
  
  // Actions
  initialize: () => Promise<void>;
  setupKidsMode: (config: Omit<KidsModeConfig, 'isSetup'>, pin: string) => Promise<void>;
  activateKidsMode: () => void;
  deactivateKidsMode: (pin: string) => Promise<boolean>;
  verifyPin: (pin: string) => Promise<boolean>;
  
  // Configuration
  updateConfig: (updates: Partial<KidsModeConfig>) => Promise<void>;
  addAllowedSite: (site: string) => void;
  removeAllowedSite: (site: string) => void;
  addBlockedSite: (site: string) => void;
  removeBlockedSite: (site: string) => void;
  
  // Time management
  startSession: () => void;
  endSession: () => void;
  extendTime: (minutes: number) => void;
  resetDailyTime: () => void;
  
  // Activity tracking
  logPageVisit: (url: string, title: string) => void;
  logBlockedAttempt: (url: string) => void;
  endPageVisit: () => void;
  
  // Reports
  getTodayReport: () => DailyReport;
  clearHistory: () => void;
  
  // PIN lockout
  incrementFailedAttempt: () => boolean; // returns true if now locked
  resetFailedAttempts: () => void;
  isLocked: () => boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const SECURE_PIN_KEY = 'aura_kids_pin';
const CONFIG_KEY = '@aura_kids_config';
const ACTIVITY_KEY = '@aura_kids_activity';
const USAGE_KEY = '@aura_kids_usage';

const DEFAULT_CONFIG: KidsModeConfig = {
  isSetup: false,
  childName: '',
  ageGroup: 'kids',
  timeLimit: 60,
  customAllowedSites: [],
  customBlockedSites: [],
};

const LOCKOUT_DURATION = 5 * 60 * 1000; // 5 minutes
const MAX_FAILED_ATTEMPTS = 3;

// ============================================================================
// STORE
// ============================================================================

export const useKidsModeStore = create<KidsModeStore>((set, get) => ({
  // Initial state
  isActive: false,
  config: DEFAULT_CONFIG,
  todayUsageMinutes: 0,
  sessionStartTime: null,
  isTimeLimitReached: false,
  failedAttempts: 0,
  lockoutUntil: null,
  currentActivity: null,
  todayActivity: [],

  // ── Initialize ──
  initialize: async () => {
    try {
      // Load config
      if (AsyncStorage) {
        const configData = await AsyncStorage.getItem(CONFIG_KEY);
        if (configData) {
          const config = JSON.parse(configData);
          set({ config });
        }

        // Load today's activity
        const today = new Date().toISOString().split('T')[0];
        const activityData = await AsyncStorage.getItem(`${ACTIVITY_KEY}_${today}`);
        if (activityData) {
          const activity = JSON.parse(activityData);
          set({ todayActivity: activity });
        }

        // Load today's usage
        const usageData = await AsyncStorage.getItem(`${USAGE_KEY}_${today}`);
        if (usageData) {
          set({ todayUsageMinutes: parseInt(usageData, 10) || 0 });
        }
      }

      console.log('[KidsMode] Initialized');
    } catch (error) {
      console.error('[KidsMode] Failed to initialize:', error);
    }
  },

  // ── Setup Kids Mode ──
  setupKidsMode: async (config, pin) => {
    try {
      // Store PIN securely
      if (Platform.OS !== 'web') {
        await SecureStore.setItemAsync(SECURE_PIN_KEY, pin);
      }

      const fullConfig: KidsModeConfig = {
        ...config,
        isSetup: true,
      };

      // Store config
      if (AsyncStorage) {
        await AsyncStorage.setItem(CONFIG_KEY, JSON.stringify(fullConfig));
      }

      set({ config: fullConfig });
      console.log('[KidsMode] Setup complete');
    } catch (error) {
      console.error('[KidsMode] Setup failed:', error);
      throw error;
    }
  },

  // ── Activate/Deactivate ──
  activateKidsMode: () => {
    const { config } = get();
    if (!config.isSetup) return;

    set({ 
      isActive: true,
      sessionStartTime: Date.now(),
      isTimeLimitReached: false,
    });
    console.log('[KidsMode] Activated');
  },

  deactivateKidsMode: async (pin) => {
    const isValid = await get().verifyPin(pin);
    if (!isValid) {
      const locked = get().incrementFailedAttempt();
      return false;
    }

    get().resetFailedAttempts();
    get().endSession();
    set({ isActive: false });
    console.log('[KidsMode] Deactivated');
    return true;
  },

  verifyPin: async (pin) => {
    try {
      if (Platform.OS === 'web') return true;

      const storedPin = await SecureStore.getItemAsync(SECURE_PIN_KEY);
      return storedPin === pin;
    } catch (error) {
      console.error('[KidsMode] PIN verification failed:', error);
      return false;
    }
  },

  // ── Configuration ──
  updateConfig: async (updates) => {
    const { config } = get();
    const newConfig = { ...config, ...updates };

    if (AsyncStorage) {
      await AsyncStorage.setItem(CONFIG_KEY, JSON.stringify(newConfig));
    }

    set({ config: newConfig });
  },

  addAllowedSite: (site) => {
    const { config } = get();
    const normalizedSite = site.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
    
    if (!config.customAllowedSites.includes(normalizedSite)) {
      const updated = [...config.customAllowedSites, normalizedSite];
      get().updateConfig({ customAllowedSites: updated });
    }
  },

  removeAllowedSite: (site) => {
    const { config } = get();
    const updated = config.customAllowedSites.filter((s) => s !== site);
    get().updateConfig({ customAllowedSites: updated });
  },

  addBlockedSite: (site) => {
    const { config } = get();
    const normalizedSite = site.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
    
    if (!config.customBlockedSites.includes(normalizedSite)) {
      const updated = [...config.customBlockedSites, normalizedSite];
      get().updateConfig({ customBlockedSites: updated });
    }
  },

  removeBlockedSite: (site) => {
    const { config } = get();
    const updated = config.customBlockedSites.filter((s) => s !== site);
    get().updateConfig({ customBlockedSites: updated });
  },

  // ── Time Management ──
  startSession: () => {
    set({ sessionStartTime: Date.now() });
  },

  endSession: () => {
    const { sessionStartTime, todayUsageMinutes } = get();
    if (!sessionStartTime) return;

    const sessionMinutes = Math.floor((Date.now() - sessionStartTime) / 60000);
    const newTotal = todayUsageMinutes + sessionMinutes;

    // Save to storage
    const today = new Date().toISOString().split('T')[0];
    if (AsyncStorage) {
      AsyncStorage.setItem(`${USAGE_KEY}_${today}`, String(newTotal));
    }

    set({
      todayUsageMinutes: newTotal,
      sessionStartTime: null,
    });
  },

  extendTime: (minutes) => {
    set({ isTimeLimitReached: false });
    // Optionally adjust usage time
  },

  resetDailyTime: () => {
    set({
      todayUsageMinutes: 0,
      isTimeLimitReached: false,
    });
  },

  // ── Activity Tracking ──
  logPageVisit: (url, title) => {
    const entry: ActivityLogEntry = {
      url,
      title,
      timestamp: Date.now(),
      duration: 0,
      wasBlocked: false,
    };

    // End previous activity
    get().endPageVisit();

    set({ currentActivity: entry });
  },

  logBlockedAttempt: (url) => {
    const entry: ActivityLogEntry = {
      url,
      title: 'Blocked',
      timestamp: Date.now(),
      duration: 0,
      wasBlocked: true,
    };

    const { todayActivity } = get();
    const updated = [...todayActivity, entry];
    
    // Save to storage
    const today = new Date().toISOString().split('T')[0];
    if (AsyncStorage) {
      AsyncStorage.setItem(`${ACTIVITY_KEY}_${today}`, JSON.stringify(updated));
    }

    set({ todayActivity: updated });
  },

  endPageVisit: () => {
    const { currentActivity, todayActivity } = get();
    if (!currentActivity) return;

    const duration = Math.floor((Date.now() - currentActivity.timestamp) / 1000);
    const completedEntry = { ...currentActivity, duration };

    const updated = [...todayActivity, completedEntry];

    // Save to storage
    const today = new Date().toISOString().split('T')[0];
    if (AsyncStorage) {
      AsyncStorage.setItem(`${ACTIVITY_KEY}_${today}`, JSON.stringify(updated));
    }

    set({
      todayActivity: updated,
      currentActivity: null,
    });
  },

  // ── Reports ──
  getTodayReport: () => {
    const { todayActivity, todayUsageMinutes, sessionStartTime } = get();
    const today = new Date().toISOString().split('T')[0];

    // Calculate total time including current session
    let totalMinutes = todayUsageMinutes;
    if (sessionStartTime) {
      totalMinutes += Math.floor((Date.now() - sessionStartTime) / 60000);
    }

    // Get unique sites
    const sitesSet = new Set<string>();
    todayActivity.forEach((entry) => {
      if (!entry.wasBlocked) {
        try {
          const hostname = new URL(entry.url).hostname;
          sitesSet.add(hostname);
        } catch {}
      }
    });

    // Count blocked attempts
    const blockedAttempts = todayActivity.filter((e) => e.wasBlocked).length;

    return {
      date: today,
      totalTimeMinutes: totalMinutes,
      sitesVisited: Array.from(sitesSet),
      blockedAttempts,
      entries: todayActivity,
    };
  },

  clearHistory: () => {
    set({ todayActivity: [] });
    
    const today = new Date().toISOString().split('T')[0];
    if (AsyncStorage) {
      AsyncStorage.removeItem(`${ACTIVITY_KEY}_${today}`);
    }
  },

  // ── PIN Lockout ──
  incrementFailedAttempt: () => {
    const { failedAttempts } = get();
    const newCount = failedAttempts + 1;

    if (newCount >= MAX_FAILED_ATTEMPTS) {
      set({
        failedAttempts: newCount,
        lockoutUntil: Date.now() + LOCKOUT_DURATION,
      });
      return true;
    }

    set({ failedAttempts: newCount });
    return false;
  },

  resetFailedAttempts: () => {
    set({ failedAttempts: 0, lockoutUntil: null });
  },

  isLocked: () => {
    const { lockoutUntil } = get();
    if (!lockoutUntil) return false;
    return Date.now() < lockoutUntil;
  },
}));

export default useKidsModeStore;
