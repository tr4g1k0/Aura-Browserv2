/**
 * Download Notification Service
 * 
 * Manages Android/iOS notifications for download progress:
 * - Persistent notification during active downloads
 * - Real-time progress updates with speed
 * - Completion/failure notifications with actions
 * - Permission handling with fallback to in-app UI
 */

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

// Safe AsyncStorage import
let AsyncStorage: any = null;
try {
  AsyncStorage = require('@react-native-async-storage/async-storage').default;
} catch (e) {
  console.log('[DownloadNotifications] AsyncStorage not available');
}

// ============================================================================
// TYPES
// ============================================================================

export interface DownloadNotificationData {
  downloadId: string;
  filename: string;
  progress: number;
  speed: number; // bytes per second
  totalBytes: number;
  downloadedBytes: number;
  status: 'downloading' | 'complete' | 'failed' | 'paused';
  filePath?: string;
  error?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const NOTIFICATION_CHANNEL_ID = 'downloads';
const PERMISSION_STORAGE_KEY = '@aura_notification_permission';

// ============================================================================
// SERVICE
// ============================================================================

class DownloadNotificationService {
  private isInitialized = false;
  private hasPermission = false;
  private activeNotifications: Map<string, string> = new Map(); // downloadId -> notificationId

  /**
   * Initialize the notification service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized || Platform.OS === 'web') return;

    try {
      // Configure notification handler
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: false,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });

      // Set up Android notification channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
          name: 'Downloads',
          importance: Notifications.AndroidImportance.LOW, // No sound, but visible
          vibrationPattern: [0],
          lightColor: '#00F2FF',
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          bypassDnd: false,
          showBadge: false,
        });
      }

      // Check stored permission state
      await this.checkStoredPermission();

      // Listen for notification responses (tap actions)
      Notifications.addNotificationResponseReceivedListener(this.handleNotificationResponse);

      this.isInitialized = true;
      console.log('[DownloadNotifications] Service initialized');
    } catch (error) {
      console.error('[DownloadNotifications] Failed to initialize:', error);
    }
  }

  /**
   * Check stored permission state
   */
  private async checkStoredPermission(): Promise<void> {
    try {
      if (AsyncStorage) {
        const stored = await AsyncStorage.getItem(PERMISSION_STORAGE_KEY);
        if (stored === 'granted') {
          this.hasPermission = true;
        }
      }
    } catch (error) {
      console.warn('[DownloadNotifications] Failed to check stored permission');
    }
  }

  /**
   * Request notification permission
   * Returns true if granted, false if denied
   */
  async requestPermission(): Promise<boolean> {
    if (Platform.OS === 'web') return false;

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      
      if (existingStatus === 'granted') {
        this.hasPermission = true;
        await this.storePermission('granted');
        return true;
      }

      const { status } = await Notifications.requestPermissionsAsync();
      this.hasPermission = status === 'granted';
      await this.storePermission(status);
      
      console.log(`[DownloadNotifications] Permission: ${status}`);
      return this.hasPermission;
    } catch (error) {
      console.error('[DownloadNotifications] Permission request failed:', error);
      return false;
    }
  }

  /**
   * Store permission state
   */
  private async storePermission(status: string): Promise<void> {
    try {
      if (AsyncStorage) {
        await AsyncStorage.setItem(PERMISSION_STORAGE_KEY, status);
      }
    } catch (error) {
      // Non-critical
    }
  }

  /**
   * Check if notifications are available
   */
  canShowNotifications(): boolean {
    return this.hasPermission && Platform.OS !== 'web';
  }

  /**
   * Show or update download progress notification
   */
  async showDownloadProgress(data: DownloadNotificationData): Promise<void> {
    if (!this.canShowNotifications()) return;

    try {
      const notificationId = this.activeNotifications.get(data.downloadId);
      const speedText = this.formatSpeed(data.speed);
      const progressText = `${data.progress}%`;
      const sizeText = this.formatSize(data.downloadedBytes, data.totalBytes);

      const content: Notifications.NotificationContentInput = {
        title: data.filename,
        body: `Downloading... ${progressText} • ${speedText}`,
        subtitle: sizeText,
        data: {
          type: 'download_progress',
          downloadId: data.downloadId,
          filePath: data.filePath,
        },
        sticky: true, // Cannot be swiped away
        autoDismiss: false,
        ...(Platform.OS === 'android' && {
          channelId: NOTIFICATION_CHANNEL_ID,
          color: '#00F2FF',
          ongoing: true, // Shows as ongoing download
          progress: {
            max: 100,
            current: data.progress,
            indeterminate: false,
          },
        }),
      };

      if (notificationId) {
        // Update existing notification
        await Notifications.scheduleNotificationAsync({
          identifier: notificationId,
          content,
          trigger: null, // Immediately
        });
      } else {
        // Create new notification
        const newId = await Notifications.scheduleNotificationAsync({
          content,
          trigger: null,
        });
        this.activeNotifications.set(data.downloadId, newId);
      }
    } catch (error) {
      console.error('[DownloadNotifications] Failed to show progress:', error);
    }
  }

  /**
   * Show download complete notification
   */
  async showDownloadComplete(data: DownloadNotificationData): Promise<void> {
    if (!this.canShowNotifications()) return;

    try {
      // Cancel existing progress notification
      await this.cancelNotification(data.downloadId);

      const content: Notifications.NotificationContentInput = {
        title: 'Download Complete',
        body: data.filename,
        data: {
          type: 'download_complete',
          downloadId: data.downloadId,
          filePath: data.filePath,
          filename: data.filename,
        },
        ...(Platform.OS === 'android' && {
          channelId: NOTIFICATION_CHANNEL_ID,
          color: '#10B981',
        }),
      };

      await Notifications.scheduleNotificationAsync({
        content,
        trigger: null,
      });

      console.log(`[DownloadNotifications] Complete: ${data.filename}`);
    } catch (error) {
      console.error('[DownloadNotifications] Failed to show complete:', error);
    }
  }

  /**
   * Show download failed notification
   */
  async showDownloadFailed(data: DownloadNotificationData): Promise<void> {
    if (!this.canShowNotifications()) return;

    try {
      // Cancel existing progress notification
      await this.cancelNotification(data.downloadId);

      const content: Notifications.NotificationContentInput = {
        title: 'Download Failed',
        body: `${data.filename} - Tap to retry`,
        data: {
          type: 'download_failed',
          downloadId: data.downloadId,
          filename: data.filename,
          error: data.error,
        },
        ...(Platform.OS === 'android' && {
          channelId: NOTIFICATION_CHANNEL_ID,
          color: '#EF4444',
        }),
      };

      await Notifications.scheduleNotificationAsync({
        content,
        trigger: null,
      });

      console.log(`[DownloadNotifications] Failed: ${data.filename}`);
    } catch (error) {
      console.error('[DownloadNotifications] Failed to show failure:', error);
    }
  }

  /**
   * Show download paused notification
   */
  async showDownloadPaused(data: DownloadNotificationData): Promise<void> {
    if (!this.canShowNotifications()) return;

    try {
      const notificationId = this.activeNotifications.get(data.downloadId);
      const sizeText = this.formatSize(data.downloadedBytes, data.totalBytes);

      const content: Notifications.NotificationContentInput = {
        title: `Paused: ${data.filename}`,
        body: `${data.progress}% complete • ${sizeText}`,
        subtitle: 'Tap to resume',
        data: {
          type: 'download_paused',
          downloadId: data.downloadId,
          filename: data.filename,
        },
        ...(Platform.OS === 'android' && {
          channelId: NOTIFICATION_CHANNEL_ID,
          color: '#F59E0B',
          ongoing: false, // Can be swiped away
          progress: {
            max: 100,
            current: data.progress,
            indeterminate: false,
          },
        }),
      };

      if (notificationId) {
        await Notifications.scheduleNotificationAsync({
          identifier: notificationId,
          content,
          trigger: null,
        });
      } else {
        const newId = await Notifications.scheduleNotificationAsync({
          content,
          trigger: null,
        });
        this.activeNotifications.set(data.downloadId, newId);
      }
    } catch (error) {
      console.error('[DownloadNotifications] Failed to show paused:', error);
    }
  }

  /**
   * Show downloads resuming notification
   */
  async showDownloadsResuming(count: number): Promise<void> {
    if (!this.canShowNotifications()) return;

    try {
      const content: Notifications.NotificationContentInput = {
        title: 'Connection Restored',
        body: `Resuming ${count} download${count > 1 ? 's' : ''}...`,
        data: { type: 'downloads_resuming' },
        ...(Platform.OS === 'android' && {
          channelId: NOTIFICATION_CHANNEL_ID,
          color: '#00F2FF',
        }),
      };

      await Notifications.scheduleNotificationAsync({
        content,
        trigger: null,
      });
    } catch (error) {
      console.error('[DownloadNotifications] Failed to show resuming:', error);
    }
  }

  /**
   * Cancel notification for a download
   */
  async cancelNotification(downloadId: string): Promise<void> {
    try {
      const notificationId = this.activeNotifications.get(downloadId);
      if (notificationId) {
        await Notifications.cancelScheduledNotificationAsync(notificationId);
        this.activeNotifications.delete(downloadId);
      }
    } catch (error) {
      console.warn('[DownloadNotifications] Failed to cancel:', error);
    }
  }

  /**
   * Cancel all download notifications
   */
  async cancelAllNotifications(): Promise<void> {
    try {
      for (const downloadId of this.activeNotifications.keys()) {
        await this.cancelNotification(downloadId);
      }
    } catch (error) {
      console.warn('[DownloadNotifications] Failed to cancel all:', error);
    }
  }

  /**
   * Handle notification tap response
   */
  private handleNotificationResponse = async (
    response: Notifications.NotificationResponse
  ): Promise<void> => {
    const data = response.notification.request.content.data;
    
    console.log('[DownloadNotifications] Response:', data);

    // Emit event for the app to handle
    // The app can listen to this via a callback or event emitter
    if (this.onNotificationTap) {
      this.onNotificationTap(data);
    }
  };

  // Callback for notification taps
  onNotificationTap: ((data: any) => void) | null = null;

  /**
   * Format download speed
   */
  private formatSpeed(bytesPerSec: number): string {
    if (!bytesPerSec || bytesPerSec <= 0) return '-- KB/s';
    if (bytesPerSec < 1024) return `${Math.round(bytesPerSec)} B/s`;
    if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
    return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
  }

  /**
   * Format size
   */
  private formatSize(downloaded: number, total: number): string {
    const formatBytes = (bytes: number): string => {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    };
    
    if (total > 0) {
      return `${formatBytes(downloaded)} / ${formatBytes(total)}`;
    }
    return formatBytes(downloaded);
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const downloadNotificationService = new DownloadNotificationService();

export default downloadNotificationService;
