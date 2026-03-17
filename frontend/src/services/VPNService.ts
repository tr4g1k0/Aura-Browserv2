/**
 * VPN Service - Native Bridge Architecture
 * 
 * This service acts as the bridge to native device VPN modules.
 * It handles connection management, status monitoring, and mock mode for development.
 * 
 * Native Implementation Notes:
 * - Android: Will use VpnService API with TUN interface
 * - iOS: Will use NetworkExtension framework with NEPacketTunnelProvider
 * 
 * The real VPN implementation will be injected via the Expo Config Plugin
 * during the `expo prebuild` phase.
 */

import { Platform } from 'react-native';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type VPNConnectionState = 
  | 'disconnected' 
  | 'connecting' 
  | 'connected' 
  | 'disconnecting'
  | 'error';

export interface VPNConnectionInfo {
  state: VPNConnectionState;
  serverAddress?: string;
  serverLocation?: string;
  connectedAt?: number;
  bytesReceived?: number;
  bytesSent?: number;
  error?: string;
}

export interface VPNServer {
  id: string;
  name: string;
  country: string;
  city: string;
  address: string;
  load: number; // 0-100 percentage
  latency: number; // ms
}

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Check if we're running in mock mode
 * Mock mode is active when:
 * - Running on web platform
 * - Running in Expo Go (no native modules)
 * - DEV flag is set for testing
 */
const isMockMode = (): boolean => {
  // Always mock on web
  if (Platform.OS === 'web') {
    return true;
  }
  
  // Check for native VPN module availability
  // In a real implementation, this would check for the native module
  try {
    // Placeholder: Native module check would go here
    // const { NativeVPNModule } = require('./NativeVPNModule');
    // return !NativeVPNModule;
    return true; // For now, always use mock mode
  } catch {
    return true;
  }
};

// Mock VPN servers for development
const MOCK_VPN_SERVERS: VPNServer[] = [
  { id: 'us-east', name: 'US East', country: 'United States', city: 'New York', address: '10.0.0.1', load: 45, latency: 25 },
  { id: 'us-west', name: 'US West', country: 'United States', city: 'Los Angeles', address: '10.0.0.2', load: 32, latency: 55 },
  { id: 'eu-west', name: 'EU West', country: 'Netherlands', city: 'Amsterdam', address: '10.0.0.3', load: 28, latency: 85 },
  { id: 'eu-central', name: 'EU Central', country: 'Germany', city: 'Frankfurt', address: '10.0.0.4', load: 51, latency: 95 },
  { id: 'asia-east', name: 'Asia Pacific', country: 'Japan', city: 'Tokyo', address: '10.0.0.5', load: 67, latency: 145 },
  { id: 'uk', name: 'United Kingdom', country: 'United Kingdom', city: 'London', address: '10.0.0.6', load: 39, latency: 75 },
];

// ============================================================================
// INTERNAL STATE
// ============================================================================

let currentState: VPNConnectionInfo = {
  state: 'disconnected',
};

let connectionListeners: ((info: VPNConnectionInfo) => void)[] = [];
let selectedServer: VPNServer | null = null;

// ============================================================================
// PRIVATE HELPERS
// ============================================================================

const notifyListeners = () => {
  connectionListeners.forEach(listener => listener({ ...currentState }));
};

const updateState = (newState: Partial<VPNConnectionInfo>) => {
  currentState = { ...currentState, ...newState };
  notifyListeners();
  console.log(`[VPNService] State updated:`, currentState.state);
};

/**
 * Simulate VPN connection with realistic timing
 * This mock implementation simulates the connection process
 */
const mockConnect = async (server: VPNServer): Promise<void> => {
  console.log(`[VPNService] Mock mode: Connecting to ${server.name}...`);
  
  // Simulate connection handshake (2 second delay as specified)
  updateState({ 
    state: 'connecting',
    serverAddress: server.address,
    serverLocation: `${server.city}, ${server.country}`,
  });
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Simulate successful connection
  updateState({
    state: 'connected',
    connectedAt: Date.now(),
    bytesReceived: 0,
    bytesSent: 0,
  });
  
  console.log(`[VPNService] Mock mode: Connected to ${server.name}`);
};

const mockDisconnect = async (): Promise<void> => {
  console.log('[VPNService] Mock mode: Disconnecting...');
  
  updateState({ state: 'disconnecting' });
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  updateState({
    state: 'disconnected',
    serverAddress: undefined,
    serverLocation: undefined,
    connectedAt: undefined,
    bytesReceived: undefined,
    bytesSent: undefined,
  });
  
  console.log('[VPNService] Mock mode: Disconnected');
};

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Connect to VPN
 * In mock mode, simulates a 2-second connection delay
 * In native mode, will call the native VPN module
 * 
 * @param serverId - Optional server ID to connect to (defaults to fastest)
 * @returns Promise that resolves when connected
 */
export const connect = async (serverId?: string): Promise<void> => {
  if (currentState.state === 'connected' || currentState.state === 'connecting') {
    console.log('[VPNService] Already connected or connecting');
    return;
  }
  
  // Select server
  const server = serverId 
    ? MOCK_VPN_SERVERS.find(s => s.id === serverId) || MOCK_VPN_SERVERS[0]
    : MOCK_VPN_SERVERS.reduce((best, s) => s.latency < best.latency ? s : best);
  
  selectedServer = server;
  
  if (isMockMode()) {
    await mockConnect(server);
    return;
  }
  
  // Native implementation placeholder
  // This would call the native VPN module
  try {
    // const { NativeVPNModule } = require('./NativeVPNModule');
    // await NativeVPNModule.connect(server.address);
    console.log('[VPNService] Native VPN module not available, falling back to mock');
    await mockConnect(server);
  } catch (error: any) {
    updateState({ 
      state: 'error', 
      error: error?.message || 'Failed to connect to VPN' 
    });
    throw error;
  }
};

/**
 * Disconnect from VPN
 * 
 * @returns Promise that resolves when disconnected
 */
export const disconnect = async (): Promise<void> => {
  if (currentState.state === 'disconnected' || currentState.state === 'disconnecting') {
    console.log('[VPNService] Already disconnected or disconnecting');
    return;
  }
  
  if (isMockMode()) {
    await mockDisconnect();
    return;
  }
  
  // Native implementation placeholder
  try {
    // const { NativeVPNModule } = require('./NativeVPNModule');
    // await NativeVPNModule.disconnect();
    console.log('[VPNService] Native VPN module not available, falling back to mock');
    await mockDisconnect();
  } catch (error: any) {
    updateState({ 
      state: 'error', 
      error: error?.message || 'Failed to disconnect from VPN' 
    });
    throw error;
  }
};

/**
 * Get current VPN connection status
 * 
 * @returns Current connection info
 */
export const getConnectionStatus = (): VPNConnectionInfo => {
  return { ...currentState };
};

/**
 * Get the currently selected server
 * 
 * @returns Selected server or null
 */
export const getSelectedServer = (): VPNServer | null => {
  return selectedServer;
};

/**
 * Get available VPN servers
 * 
 * @returns Array of available servers
 */
export const getAvailableServers = (): VPNServer[] => {
  return [...MOCK_VPN_SERVERS];
};

/**
 * Subscribe to connection state changes
 * 
 * @param listener - Callback function for state changes
 * @returns Unsubscribe function
 */
export const addConnectionListener = (
  listener: (info: VPNConnectionInfo) => void
): (() => void) => {
  connectionListeners.push(listener);
  
  // Immediately notify with current state
  listener({ ...currentState });
  
  // Return unsubscribe function
  return () => {
    connectionListeners = connectionListeners.filter(l => l !== listener);
  };
};

/**
 * Check if VPN service is in mock mode
 * Useful for UI to show appropriate indicators
 * 
 * @returns Boolean indicating mock mode status
 */
export const isInMockMode = (): boolean => {
  return isMockMode();
};

/**
 * Toggle VPN connection
 * Convenience function that connects if disconnected, disconnects if connected
 * 
 * @returns Promise with the new state
 */
export const toggleConnection = async (): Promise<VPNConnectionState> => {
  if (currentState.state === 'connected') {
    await disconnect();
  } else if (currentState.state === 'disconnected' || currentState.state === 'error') {
    await connect();
  }
  return currentState.state;
};

// Export default object for convenience
export default {
  connect,
  disconnect,
  getConnectionStatus,
  getSelectedServer,
  getAvailableServers,
  addConnectionListener,
  isInMockMode,
  toggleConnection,
};
