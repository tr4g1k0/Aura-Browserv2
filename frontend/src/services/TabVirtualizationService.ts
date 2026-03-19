/**
 * Tab Virtualization Service
 * Manages WebView instances to optimize memory usage
 * - Pauses background tabs to reduce memory/CPU
 * - Limits active WebView instances to MAX_ACTIVE_WEBVIEWS
 * - Auto-destroys tabs inactive for > INACTIVE_DESTROY_TIME
 */

import { InteractionManager } from 'react-native';

const MAX_ACTIVE_WEBVIEWS = 5;
const INACTIVE_DESTROY_TIME = 10 * 60 * 1000; // 10 minutes in ms
const CLEANUP_INTERVAL = 60 * 1000; // Check every minute

export interface VirtualizedTab {
  id: string;
  lastActiveTime: number;
  isPaused: boolean;
  shouldDestroy: boolean;
}

class TabVirtualizationService {
  private activeTabId: string | null = null;
  private tabStates: Map<string, VirtualizedTab> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private onTabStateChange: ((tabId: string, state: VirtualizedTab) => void) | null = null;

  /**
   * Start the virtualization service
   */
  start(onTabStateChange?: (tabId: string, state: VirtualizedTab) => void): void {
    this.onTabStateChange = onTabStateChange || null;
    
    // Start cleanup interval
    if (!this.cleanupInterval) {
      this.cleanupInterval = setInterval(() => {
        this.performCleanup();
      }, CLEANUP_INTERVAL);
    }
    
    console.log('[TabVirtualization] Service started');
  }

  /**
   * Stop the virtualization service
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    console.log('[TabVirtualization] Service stopped');
  }

  /**
   * Register a new tab with the service
   */
  registerTab(tabId: string): void {
    if (!this.tabStates.has(tabId)) {
      this.tabStates.set(tabId, {
        id: tabId,
        lastActiveTime: Date.now(),
        isPaused: false,
        shouldDestroy: false,
      });
      console.log(`[TabVirtualization] Tab registered: ${tabId}`);
    }
  }

  /**
   * Unregister a tab from the service
   */
  unregisterTab(tabId: string): void {
    this.tabStates.delete(tabId);
    console.log(`[TabVirtualization] Tab unregistered: ${tabId}`);
  }

  /**
   * Set the active tab - this tab will NEVER be paused
   */
  setActiveTab(tabId: string): void {
    const previousActiveId = this.activeTabId;
    this.activeTabId = tabId;

    // Update the active tab's state
    const activeState = this.tabStates.get(tabId);
    if (activeState) {
      activeState.lastActiveTime = Date.now();
      activeState.isPaused = false; // NEVER pause active tab
      activeState.shouldDestroy = false;
      this.notifyStateChange(tabId, activeState);
    }

    // Pause the previous active tab if different
    if (previousActiveId && previousActiveId !== tabId) {
      const prevState = this.tabStates.get(previousActiveId);
      if (prevState) {
        prevState.isPaused = true;
        this.notifyStateChange(previousActiveId, prevState);
      }
    }

    // Manage other background tabs
    this.optimizeBackgroundTabs();
    
    console.log(`[TabVirtualization] Active tab set: ${tabId}`);
  }

  /**
   * Get the pause state for a tab
   * CRITICAL: Active tab is NEVER paused
   */
  isTabPaused(tabId: string): boolean {
    // Active tab is NEVER paused
    if (tabId === this.activeTabId) {
      return false;
    }
    
    const state = this.tabStates.get(tabId);
    return state?.isPaused ?? false;
  }

  /**
   * Check if a tab should be destroyed (inactive too long)
   */
  shouldDestroyTab(tabId: string): boolean {
    // Never destroy active tab
    if (tabId === this.activeTabId) {
      return false;
    }
    
    const state = this.tabStates.get(tabId);
    return state?.shouldDestroy ?? false;
  }

  /**
   * Get all tab IDs that should be destroyed
   */
  getTabsToDestroy(): string[] {
    const toDestroy: string[] = [];
    this.tabStates.forEach((state, tabId) => {
      if (state.shouldDestroy && tabId !== this.activeTabId) {
        toDestroy.push(tabId);
      }
    });
    return toDestroy;
  }

  /**
   * Optimize background tabs based on MAX_ACTIVE_WEBVIEWS limit
   */
  private optimizeBackgroundTabs(): void {
    InteractionManager.runAfterInteractions(() => {
      const allTabs = Array.from(this.tabStates.entries())
        .filter(([id]) => id !== this.activeTabId)
        .sort((a, b) => b[1].lastActiveTime - a[1].lastActiveTime);

      // Keep only MAX_ACTIVE_WEBVIEWS - 1 background tabs unpaused (active tab takes 1 slot)
      const maxBackgroundTabs = MAX_ACTIVE_WEBVIEWS - 1;
      
      allTabs.forEach(([tabId, state], index) => {
        if (index < maxBackgroundTabs) {
          // Keep recently used tabs unpaused
          state.isPaused = false;
        } else {
          // Pause older tabs to save memory
          state.isPaused = true;
        }
        this.notifyStateChange(tabId, state);
      });
    });
  }

  /**
   * Periodic cleanup - mark very old tabs for destruction
   */
  private performCleanup(): void {
    const now = Date.now();
    
    this.tabStates.forEach((state, tabId) => {
      // Never touch active tab
      if (tabId === this.activeTabId) {
        return;
      }

      const inactiveTime = now - state.lastActiveTime;
      
      if (inactiveTime > INACTIVE_DESTROY_TIME) {
        state.shouldDestroy = true;
        state.isPaused = true;
        console.log(`[TabVirtualization] Tab marked for destruction (inactive ${Math.round(inactiveTime / 60000)}min): ${tabId}`);
        this.notifyStateChange(tabId, state);
      }
    });
  }

  /**
   * Notify listeners of state changes
   */
  private notifyStateChange(tabId: string, state: VirtualizedTab): void {
    if (this.onTabStateChange) {
      this.onTabStateChange(tabId, { ...state });
    }
  }

  /**
   * Get current stats for debugging
   */
  getStats(): { total: number; paused: number; active: number; markedForDestruction: number } {
    let paused = 0;
    let markedForDestruction = 0;
    
    this.tabStates.forEach((state) => {
      if (state.isPaused) paused++;
      if (state.shouldDestroy) markedForDestruction++;
    });

    return {
      total: this.tabStates.size,
      paused,
      active: this.tabStates.size - paused,
      markedForDestruction,
    };
  }
}

export const tabVirtualizationService = new TabVirtualizationService();
