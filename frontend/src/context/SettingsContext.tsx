import React, { useState, createContext, useContext, ReactNode } from 'react';
import { useBrowserSettings, BrowserSettings, UseBrowserSettingsReturn, DEFAULT_BROWSER_SETTINGS } from '../hooks/useBrowserSettings';

const SettingsContext = createContext<UseBrowserSettingsReturn | null>(null);

export const useSettings = (): UseBrowserSettingsReturn => {
  const context = useContext(SettingsContext);
  if (!context) {
    // Return a default implementation if not in provider
    return {
      settings: DEFAULT_BROWSER_SETTINGS,
      updateSetting: () => {},
      updateSettings: () => {},
      resetSettings: () => {},
      clearBrowsingData: async () => {},
      isLoading: false,
    };
  }
  return context;
};

interface SettingsProviderProps {
  children: ReactNode;
}

export const SettingsProvider: React.FC<SettingsProviderProps> = ({ children }) => {
  const browserSettings = useBrowserSettings();

  return (
    <SettingsContext.Provider value={browserSettings}>
      {children}
    </SettingsContext.Provider>
  );
};
