/**
 * VPN Store - Zustand State Manager
 * 
 * Manages the VPN connection state and integrates with:
 * - VPNService for actual connection management
 * - useBrowserSettings for the 'Always-On VPN' toggle
 * 
 * States: disconnected | connecting | connected | disconnecting | error
 */

import { create } from 'zustand';
import VPNService, { 
  VPNConnectionState, 
  VPNConnectionInfo, 
  VPNServer 
} from '../services/VPNService';

// ============================================================================
// TYPES
// ============================================================================

export interface VPNStats {
  bytesReceived: number;
  bytesSent: number;
  connectedDuration: number; // seconds
  sessionsToday: number;
}

interface VPNState {
  // Connection state
  connectionState: VPNConnectionState;
  connectionInfo: VPNConnectionInfo | null;
  selectedServer: VPNServer | null;
  availableServers: VPNServer[];
  
  // Mock mode indicator
  isMockMode: boolean;
  
  // Stats
  stats: VPNStats;
  
  // Error handling
  error: string | null;
  
  // Loading states
  isInitialized: boolean;
  isToggling: boolean;
  
  // Actions
  initialize: () => void;
  connect: (serverId?: string) => Promise<void>;
  disconnect: () => Promise<void>;
  toggleConnection: () => Promise<void>;
  selectServer: (serverId: string) => void;
  clearError: () => void;
  refreshServers: () => void;
}

// ============================================================================
// STORE
// ============================================================================

export const useVPNStore = create<VPNState>((set, get) => {
  // Stats update interval
  let statsInterval: NodeJS.Timeout | null = null;
  
  const startStatsUpdater = () => {
    if (statsInterval) return;
    
    statsInterval = setInterval(() => {
      const state = get();
      if (state.connectionState === 'connected' && state.connectionInfo?.connectedAt) {
        const duration = Math.floor((Date.now() - state.connectionInfo.connectedAt) / 1000);
        set(prev => ({
          stats: {
            ...prev.stats,
            connectedDuration: duration,
            // Simulate bandwidth in mock mode
            bytesReceived: prev.stats.bytesReceived + Math.floor(Math.random() * 50000),
            bytesSent: prev.stats.bytesSent + Math.floor(Math.random() * 10000),
          }
        }));
      }
    }, 1000);
  };
  
  const stopStatsUpdater = () => {
    if (statsInterval) {
      clearInterval(statsInterval);
      statsInterval = null;
    }
  };
  
  return {
    // Initial state
    connectionState: 'disconnected',
    connectionInfo: null,
    selectedServer: null,
    availableServers: [],
    isMockMode: VPNService.isInMockMode(),
    stats: {
      bytesReceived: 0,
      bytesSent: 0,
      connectedDuration: 0,
      sessionsToday: 0,
    },
    error: null,
    isInitialized: false,
    isToggling: false,
    
    // Initialize the store and subscribe to VPN service
    initialize: () => {
      if (get().isInitialized) return;
      
      // Subscribe to VPN service state changes
      VPNService.addConnectionListener((info) => {
        set({
          connectionState: info.state,
          connectionInfo: info,
          error: info.error || null,
        });
        
        // Start/stop stats updater based on connection state
        if (info.state === 'connected') {
          startStatsUpdater();
          set(prev => ({
            stats: {
              ...prev.stats,
              sessionsToday: prev.stats.sessionsToday + 1,
              bytesReceived: 0,
              bytesSent: 0,
              connectedDuration: 0,
            }
          }));
        } else {
          stopStatsUpdater();
        }
      });
      
      // Load available servers
      const servers = VPNService.getAvailableServers();
      const selected = servers.length > 0 ? servers[0] : null;
      
      set({
        isInitialized: true,
        availableServers: servers,
        selectedServer: selected,
        isMockMode: VPNService.isInMockMode(),
      });
      
      console.log('[VPNStore] Initialized', {
        mockMode: VPNService.isInMockMode(),
        servers: servers.length,
      });
    },
    
    // Connect to VPN
    connect: async (serverId?: string) => {
      const state = get();
      
      if (state.isToggling) {
        console.log('[VPNStore] Already toggling connection');
        return;
      }
      
      set({ isToggling: true, error: null });
      
      try {
        const targetServerId = serverId || state.selectedServer?.id;
        await VPNService.connect(targetServerId);
      } catch (error: any) {
        set({ error: error?.message || 'Failed to connect' });
      } finally {
        set({ isToggling: false });
      }
    },
    
    // Disconnect from VPN
    disconnect: async () => {
      const state = get();
      
      if (state.isToggling) {
        console.log('[VPNStore] Already toggling connection');
        return;
      }
      
      set({ isToggling: true, error: null });
      
      try {
        await VPNService.disconnect();
      } catch (error: any) {
        set({ error: error?.message || 'Failed to disconnect' });
      } finally {
        set({ isToggling: false });
      }
    },
    
    // Toggle connection state
    toggleConnection: async () => {
      const state = get();
      
      if (state.connectionState === 'connected') {
        await get().disconnect();
      } else if (state.connectionState === 'disconnected' || state.connectionState === 'error') {
        await get().connect();
      }
    },
    
    // Select a server
    selectServer: (serverId: string) => {
      const servers = get().availableServers;
      const server = servers.find(s => s.id === serverId);
      
      if (server) {
        set({ selectedServer: server });
        console.log(`[VPNStore] Selected server: ${server.name}`);
      }
    },
    
    // Clear error state
    clearError: () => {
      set({ error: null });
    },
    
    // Refresh server list
    refreshServers: () => {
      const servers = VPNService.getAvailableServers();
      set({ availableServers: servers });
    },
  };
});

// Export a hook for convenient access to VPN state
export const useVPNConnection = () => {
  const store = useVPNStore();
  
  return {
    state: store.connectionState,
    isConnected: store.connectionState === 'connected',
    isConnecting: store.connectionState === 'connecting',
    isDisconnecting: store.connectionState === 'disconnecting',
    hasError: store.connectionState === 'error',
    error: store.error,
    server: store.selectedServer,
    isMockMode: store.isMockMode,
    stats: store.stats,
    toggle: store.toggleConnection,
    connect: store.connect,
    disconnect: store.disconnect,
  };
};

export default useVPNStore;
