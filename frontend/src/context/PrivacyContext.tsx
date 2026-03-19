/**
 * Privacy Context
 * 
 * Global state management for privacy metrics including:
 * - Ads blocked count
 * - Trackers blocked count
 * 
 * Persists lifetime counts to AsyncStorage so users see their
 * cumulative protection stats across sessions.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage keys
const STORAGE_KEYS = {
  ADS_BLOCKED: '@aura_ads_blocked_count',
  TRACKERS_BLOCKED: '@aura_trackers_blocked_count',
  SESSION_START: '@aura_session_start',
};

// Context interface
interface PrivacyContextType {
  adsBlockedCount: number;
  trackersBlockedCount: number;
  sessionAdsBlocked: number;
  sessionTrackersBlocked: number;
  incrementAds: (count?: number) => void;
  incrementTrackers: (count?: number) => void;
  resetSessionCounts: () => void;
  isLoaded: boolean;
}

// Default values
const defaultContext: PrivacyContextType = {
  adsBlockedCount: 0,
  trackersBlockedCount: 0,
  sessionAdsBlocked: 0,
  sessionTrackersBlocked: 0,
  incrementAds: () => {},
  incrementTrackers: () => {},
  resetSessionCounts: () => {},
  isLoaded: false,
};

// Create context
const PrivacyContext = createContext<PrivacyContextType>(defaultContext);

// Provider component
export const PrivacyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [adsBlockedCount, setAdsBlockedCount] = useState(0);
  const [trackersBlockedCount, setTrackersBlockedCount] = useState(0);
  const [sessionAdsBlocked, setSessionAdsBlocked] = useState(0);
  const [sessionTrackersBlocked, setSessionTrackersBlocked] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load persisted counts on mount
  useEffect(() => {
    const loadCounts = async () => {
      try {
        const [adsStr, trackersStr] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.ADS_BLOCKED),
          AsyncStorage.getItem(STORAGE_KEYS.TRACKERS_BLOCKED),
        ]);

        const loadedAds = adsStr ? parseInt(adsStr, 10) : 0;
        const loadedTrackers = trackersStr ? parseInt(trackersStr, 10) : 0;

        setAdsBlockedCount(isNaN(loadedAds) ? 0 : loadedAds);
        setTrackersBlockedCount(isNaN(loadedTrackers) ? 0 : loadedTrackers);
        setIsLoaded(true);

        console.log('[PrivacyContext] Loaded counts:', {
          ads: loadedAds,
          trackers: loadedTrackers,
        });
      } catch (error) {
        console.error('[PrivacyContext] Failed to load counts:', error);
        setIsLoaded(true);
      }
    };

    loadCounts();
  }, []);

  // Persist ads count when it changes
  useEffect(() => {
    if (isLoaded && adsBlockedCount > 0) {
      AsyncStorage.setItem(STORAGE_KEYS.ADS_BLOCKED, adsBlockedCount.toString())
        .catch(err => console.error('[PrivacyContext] Failed to save ads count:', err));
    }
  }, [adsBlockedCount, isLoaded]);

  // Persist trackers count when it changes
  useEffect(() => {
    if (isLoaded && trackersBlockedCount > 0) {
      AsyncStorage.setItem(STORAGE_KEYS.TRACKERS_BLOCKED, trackersBlockedCount.toString())
        .catch(err => console.error('[PrivacyContext] Failed to save trackers count:', err));
    }
  }, [trackersBlockedCount, isLoaded]);

  /**
   * Increment ads blocked count
   * @param count - Number to increment by (default 1)
   */
  const incrementAds = useCallback((count: number = 1) => {
    setAdsBlockedCount(prev => prev + count);
    setSessionAdsBlocked(prev => prev + count);
  }, []);

  /**
   * Increment trackers blocked count
   * @param count - Number to increment by (default 1)
   */
  const incrementTrackers = useCallback((count: number = 1) => {
    setTrackersBlockedCount(prev => prev + count);
    setSessionTrackersBlocked(prev => prev + count);
  }, []);

  /**
   * Reset session counts (not lifetime counts)
   */
  const resetSessionCounts = useCallback(() => {
    setSessionAdsBlocked(0);
    setSessionTrackersBlocked(0);
  }, []);

  const value: PrivacyContextType = {
    adsBlockedCount,
    trackersBlockedCount,
    sessionAdsBlocked,
    sessionTrackersBlocked,
    incrementAds,
    incrementTrackers,
    resetSessionCounts,
    isLoaded,
  };

  return (
    <PrivacyContext.Provider value={value}>
      {children}
    </PrivacyContext.Provider>
  );
};

// Custom hook to use the context
export const usePrivacy = () => {
  const context = useContext(PrivacyContext);
  if (!context) {
    throw new Error('usePrivacy must be used within a PrivacyProvider');
  }
  return context;
};

// Export for use in class components if needed
export { PrivacyContext };
