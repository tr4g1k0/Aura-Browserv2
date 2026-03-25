/**
 * Ghost Mode Store - Central state management for Ghost Mode
 * Manages biometric lock, self-destruct timer, decoy mode, location spoofing
 */
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export interface SpoofLocation {
  name: string;
  lat: number;
  lng: number;
  emoji: string;
}

export const PRESET_LOCATIONS: SpoofLocation[] = [
  { name: 'New York, USA', lat: 40.7128, lng: -74.0060, emoji: '🗽' },
  { name: 'London, UK', lat: 51.5074, lng: -0.1278, emoji: '🇬🇧' },
  { name: 'Tokyo, Japan', lat: 35.6762, lng: 139.6503, emoji: '🗼' },
  { name: 'Paris, France', lat: 48.8566, lng: 2.3522, emoji: '🗼' },
  { name: 'Sydney, Australia', lat: -33.8688, lng: 151.2093, emoji: '🦘' },
  { name: 'Toronto, Canada', lat: 43.6532, lng: -79.3832, emoji: '🍁' },
];

export type TimerPreset = 0 | 5 | 15 | 30 | 60;

interface GhostModeSettings {
  requireBiometric: boolean;
  defaultTimer: TimerPreset;
  decoyModeEnabled: boolean;
  defaultLocation: SpoofLocation | null;
  showEntryAnimation: boolean;
  blockWebRTC: boolean;
  rotateUserAgent: boolean;
}

interface GhostModeState {
  // Session state
  isActive: boolean;
  sessionStartTime: number | null;
  selfDestructMinutes: number;
  selfDestructEndTime: number | null;
  spoofedLocation: SpoofLocation | null;
  decoyActive: boolean;
  showRealHistory: boolean; // toggled by secret gesture

  // Biometric lock
  failedBioAttempts: number;
  bioLockoutUntil: number | null;

  // Settings
  settings: GhostModeSettings;

  // Actions
  initialize: () => Promise<void>;
  activateGhostMode: (timerMinutes: number) => void;
  deactivateGhostMode: () => void;
  setSelfDestructTimer: (minutes: number) => void;
  triggerSelfDestruct: () => void;
  setSpoofedLocation: (loc: SpoofLocation | null) => void;
  setRandomLocation: () => void;
  toggleDecoy: () => void;
  toggleShowRealHistory: () => void;
  updateSettings: (partial: Partial<GhostModeSettings>) => void;
  recordBioFailure: () => void;
  resetBioFailures: () => void;
  isBioLocked: () => boolean;
  getRemainingSeconds: () => number;
}

const STORAGE_KEY = 'aura_ghost_settings';

const DEFAULT_SETTINGS: GhostModeSettings = {
  requireBiometric: true,
  defaultTimer: 0,
  decoyModeEnabled: false,
  defaultLocation: null,
  showEntryAnimation: true,
  blockWebRTC: true,
  rotateUserAgent: true,
};

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];

export const getRandomUserAgent = (): string => {
  // Use a cryptographically secure RNG so User-Agent rotation cannot be predicted
  // by fingerprinting scripts that model Math.random() output.
  try {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return USER_AGENTS[buf[0] % USER_AGENTS.length];
  } catch {
    // Fallback for environments where crypto is unavailable
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  }
};

export const useGhostModeStore = create<GhostModeState>((set, get) => ({
  isActive: false,
  sessionStartTime: null,
  selfDestructMinutes: 0,
  selfDestructEndTime: null,
  spoofedLocation: null,
  decoyActive: false,
  showRealHistory: false,
  failedBioAttempts: 0,
  bioLockoutUntil: null,
  settings: DEFAULT_SETTINGS,

  initialize: async () => {
    try {
      const stored = Platform.OS === 'web'
        ? await AsyncStorage.getItem(STORAGE_KEY)
        : await SecureStore.getItemAsync(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        set({ settings: { ...DEFAULT_SETTINGS, ...parsed } });
      }
    } catch (e) {
      console.log('[GhostMode] Init error:', e);
    }
  },

  activateGhostMode: (timerMinutes: number) => {
    const endTime = timerMinutes > 0 ? Date.now() + timerMinutes * 60 * 1000 : null;
    set({
      isActive: true,
      sessionStartTime: Date.now(),
      selfDestructMinutes: timerMinutes,
      selfDestructEndTime: endTime,
      decoyActive: get().settings.decoyModeEnabled,
      spoofedLocation: get().settings.defaultLocation,
    });
    console.log('[GhostMode] Activated. Timer:', timerMinutes, 'min');
  },

  deactivateGhostMode: () => {
    set({
      isActive: false,
      sessionStartTime: null,
      selfDestructMinutes: 0,
      selfDestructEndTime: null,
      spoofedLocation: null,
      decoyActive: false,
      showRealHistory: false,
    });
    console.log('[GhostMode] Deactivated. All traces cleared.');
  },

  setSelfDestructTimer: (minutes: number) => {
    const endTime = minutes > 0 ? Date.now() + minutes * 60 * 1000 : null;
    set({ selfDestructMinutes: minutes, selfDestructEndTime: endTime });
  },

  triggerSelfDestruct: () => {
    console.log('[GhostMode] SELF DESTRUCT TRIGGERED');
    get().deactivateGhostMode();
  },

  setSpoofedLocation: (loc) => set({ spoofedLocation: loc }),

  setRandomLocation: () => {
    const lat = (Math.random() * 180 - 90);
    const lng = (Math.random() * 360 - 180);
    set({ spoofedLocation: { name: 'Random Location', lat, lng, emoji: '🎲' } });
  },

  toggleDecoy: () => set(s => ({ decoyActive: !s.decoyActive })),
  toggleShowRealHistory: () => set(s => ({ showRealHistory: !s.showRealHistory })),

  updateSettings: async (partial) => {
    const newSettings = { ...get().settings, ...partial };
    set({ settings: newSettings });
    try {
      const json = JSON.stringify(newSettings);
      if (Platform.OS === 'web') await AsyncStorage.setItem(STORAGE_KEY, json);
      else await SecureStore.setItemAsync(STORAGE_KEY, json);
    } catch (e) {
      console.log('[GhostMode] Save settings error:', e);
    }
  },

  recordBioFailure: () => {
    const attempts = get().failedBioAttempts + 1;
    if (attempts >= 3) {
      // Exponential backoff: 5 min → 15 min → 60 min for repeated failures.
      // A fixed 30-second lockout is trivially bypassed by waiting.
      const lockoutMs =
        attempts === 3 ? 5 * 60 * 1000 :
        attempts === 4 ? 15 * 60 * 1000 :
        60 * 60 * 1000;
      set({ failedBioAttempts: attempts, bioLockoutUntil: Date.now() + lockoutMs });
    } else {
      set({ failedBioAttempts: attempts });
    }
  },

  resetBioFailures: () => set({ failedBioAttempts: 0, bioLockoutUntil: null }),

  isBioLocked: () => {
    const lockout = get().bioLockoutUntil;
    if (!lockout) return false;
    if (Date.now() >= lockout) {
      set({ failedBioAttempts: 0, bioLockoutUntil: null });
      return false;
    }
    return true;
  },

  getRemainingSeconds: () => {
    const end = get().selfDestructEndTime;
    if (!end) return -1;
    return Math.max(0, Math.ceil((end - Date.now()) / 1000));
  },
}));

export default useGhostModeStore;
