/**
 * Resumable Download Service
 * 
 * Implements resumable downloads using HTTP Range requests:
 * - Checks for partial files and resumes from where stopped
 * - Persists download state to AsyncStorage (survives app crashes)
 * - Auto-resumes when network reconnects
 * - Pause/resume controls
 * - File integrity verification
 */

import { Platform, AppState, AppStateStatus } from 'react-native';
import * as FileSystem from 'expo-file-system';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { downloadNotificationService } from './DownloadNotificationService';

// Safe AsyncStorage import
let AsyncStorage: any = null;
try {
  AsyncStorage = require('@react-native-async-storage/async-storage').default;
} catch (e) {
  console.log('[ResumableDownloads] AsyncStorage not available');
}

// ============================================================================
// TYPES
// ============================================================================

export type DownloadStatus = 'pending' | 'downloading' | 'paused' | 'completed' | 'failed';

export interface DownloadRecord {
  id: string;
  url: string;
  filename: string;
  filepath: string;
  partialPath: string; // Path for .partial file during download
  totalBytes: number;
  downloadedBytes: number;
  status: DownloadStatus;
  createdAt: number;
  updatedAt: number;
  error?: string;
  mimeType?: string;
  speed?: number;
  resumable?: boolean;
}

export interface DownloadProgress {
  downloadId: string;
  progress: number; // 0-100
  downloadedBytes: number;
  totalBytes: number;
  speed: number;
  filename: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const STORAGE_KEY = '@aura_download_records';
const SAVE_INTERVAL = 5000; // Save progress every 5 seconds
const DOWNLOADS_DIR = `${FileSystem.documentDirectory}downloads/`;

// ============================================================================
// SERVICE
// ============================================================================

class ResumableDownloadService {
  private downloadRecords: Map<string, DownloadRecord> = new Map();
  private activeDownloads: Map<string, FileSystem.DownloadResumable> = new Map();
  private progressCallbacks: Map<string, (progress: DownloadProgress) => void> = new Map();
  private saveTimeout: NodeJS.Timeout | null = null;
  private networkUnsubscribe: (() => void) | null = null;
  private appStateSubscription: any = null;
  private isOnline = true;
  private onGlobalProgress: ((progress: DownloadProgress) => void) | null = null;

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    if (Platform.OS === 'web') return;

    try {
      // Ensure downloads directory exists
      const dirInfo = await FileSystem.getInfoAsync(DOWNLOADS_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(DOWNLOADS_DIR, { intermediates: true });
      }

      // Load persisted download records
      await this.loadRecords();

      // Initialize notification service
      await downloadNotificationService.initialize();

      // Monitor network connectivity
      this.networkUnsubscribe = NetInfo.addEventListener(this.handleNetworkChange);

      // Monitor app state
      this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);

      // Check for interrupted downloads
      await this.checkInterruptedDownloads();

      console.log('[ResumableDownloads] Service initialized');
    } catch (error) {
      console.error('[ResumableDownloads] Failed to initialize:', error);
    }
  }

  /**
   * Clean up
   */
  destroy(): void {
    if (this.networkUnsubscribe) {
      this.networkUnsubscribe();
    }
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
    }
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.pauseAllDownloads();
  }

  /**
   * Handle network state changes
   */
  private handleNetworkChange = async (state: NetInfoState): Promise<void> => {
    const wasOffline = !this.isOnline;
    this.isOnline = state.isConnected ?? false;

    if (wasOffline && this.isOnline) {
      console.log('[ResumableDownloads] Network restored');
      await this.resumeInterruptedDownloads();
    } else if (!this.isOnline) {
      console.log('[ResumableDownloads] Network lost - pausing downloads');
      await this.pauseAllDownloads();
    }
  };

  /**
   * Handle app state changes
   */
  private handleAppStateChange = async (nextAppState: AppStateStatus): Promise<void> => {
    if (nextAppState === 'background' || nextAppState === 'inactive') {
      // Save progress when app goes to background
      await this.saveRecords();
    }
  };

  /**
   * Set global progress callback
   */
  setProgressCallback(callback: (progress: DownloadProgress) => void): void {
    this.onGlobalProgress = callback;
  }

  /**
   * Load download records from storage
   */
  private async loadRecords(): Promise<void> {
    try {
      if (!AsyncStorage) return;

      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) {
        const records: DownloadRecord[] = JSON.parse(data);
        records.forEach((record) => {
          this.downloadRecords.set(record.id, record);
        });
        console.log(`[ResumableDownloads] Loaded ${records.length} records`);
      }
    } catch (error) {
      console.error('[ResumableDownloads] Failed to load records:', error);
    }
  }

  /**
   * Save download records to storage (debounced)
   */
  private scheduleSave(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => this.saveRecords(), SAVE_INTERVAL);
  }

  /**
   * Save download records immediately
   */
  private async saveRecords(): Promise<void> {
    try {
      if (!AsyncStorage) return;

      const records = Array.from(this.downloadRecords.values());
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch (error) {
      console.error('[ResumableDownloads] Failed to save records:', error);
    }
  }

  /**
   * Check for interrupted downloads and offer to resume
   */
  private async checkInterruptedDownloads(): Promise<void> {
    const interrupted = Array.from(this.downloadRecords.values())
      .filter((r) => r.status === 'downloading' || r.status === 'paused');

    if (interrupted.length > 0) {
      console.log(`[ResumableDownloads] Found ${interrupted.length} interrupted downloads`);
      // Mark as paused (will be resumed when network available)
      for (const record of interrupted) {
        record.status = 'paused';
        record.updatedAt = Date.now();
        this.downloadRecords.set(record.id, record);
      }
      await this.saveRecords();
    }
  }

  /**
   * Resume all interrupted/paused downloads
   */
  private async resumeInterruptedDownloads(): Promise<void> {
    const paused = Array.from(this.downloadRecords.values())
      .filter((r) => r.status === 'paused');

    if (paused.length === 0) return;

    console.log(`[ResumableDownloads] Resuming ${paused.length} downloads`);
    
    // Show notification
    await downloadNotificationService.showDownloadsResuming(paused.length);

    for (const record of paused) {
      this.resumeDownload(record.id);
    }
  }

  /**
   * Start a new download or resume existing
   */
  async startDownload(
    url: string,
    filename: string,
    mimeType?: string,
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<string> {
    if (Platform.OS === 'web') {
      throw new Error('Downloads not supported on web');
    }

    // Check for existing download with same URL
    const existing = Array.from(this.downloadRecords.values())
      .find((r) => r.url === url && (r.status === 'paused' || r.status === 'downloading'));

    if (existing) {
      // Resume existing download
      if (onProgress) {
        this.progressCallbacks.set(existing.id, onProgress);
      }
      await this.resumeDownload(existing.id);
      return existing.id;
    }

    // Create new download record
    const id = `dl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const sanitizedFilename = this.sanitizeFilename(filename);
    const filepath = `${DOWNLOADS_DIR}${sanitizedFilename}`;
    const partialPath = `${filepath}.partial`;

    const record: DownloadRecord = {
      id,
      url,
      filename: sanitizedFilename,
      filepath,
      partialPath,
      totalBytes: 0,
      downloadedBytes: 0,
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      mimeType,
      resumable: false,
    };

    this.downloadRecords.set(id, record);

    if (onProgress) {
      this.progressCallbacks.set(id, onProgress);
    }

    // Request notification permission on first download
    await downloadNotificationService.requestPermission();

    // Start the download
    await this.executeDownload(record);

    return id;
  }

  /**
   * Execute download with resume support
   */
  private async executeDownload(record: DownloadRecord): Promise<void> {
    try {
      // Check if partial file exists
      const partialInfo = await FileSystem.getInfoAsync(record.partialPath);
      let resumeFrom = 0;
      
      if (partialInfo.exists && 'size' in partialInfo) {
        resumeFrom = partialInfo.size;
        record.downloadedBytes = resumeFrom;
        console.log(`[ResumableDownloads] Resuming from byte ${resumeFrom}`);
      }

      // Create download callback
      const callback = (progress: FileSystem.DownloadProgressData) => {
        this.handleProgress(record.id, progress);
      };

      // Prepare headers for range request
      const headers: Record<string, string> = {};
      if (resumeFrom > 0) {
        headers['Range'] = `bytes=${resumeFrom}-`;
      }

      // Create resumable download
      const downloadResumable = FileSystem.createDownloadResumable(
        record.url,
        record.partialPath,
        { headers },
        callback
      );

      this.activeDownloads.set(record.id, downloadResumable);

      // Update status
      record.status = 'downloading';
      record.updatedAt = Date.now();
      this.downloadRecords.set(record.id, record);
      await this.saveRecords();

      // Start download
      const result = await downloadResumable.downloadAsync();

      if (result) {
        // Download complete - move partial to final
        await this.finalizeDownload(record);
      }
    } catch (error: any) {
      // Check if it was cancelled/paused
      if (error.message?.includes('cancelled') || error.message?.includes('paused')) {
        console.log(`[ResumableDownloads] Download ${record.id} paused`);
        return;
      }

      console.error(`[ResumableDownloads] Download failed:`, error);
      await this.handleDownloadError(record.id, error.message || 'Download failed');
    }
  }

  /**
   * Handle download progress
   */
  private handleProgress(
    downloadId: string,
    progress: FileSystem.DownloadProgressData
  ): void {
    const record = this.downloadRecords.get(downloadId);
    if (!record) return;

    // Calculate speed
    const now = Date.now();
    const timeDiff = (now - record.updatedAt) / 1000;
    const bytesDiff = progress.totalBytesWritten - record.downloadedBytes;
    const speed = timeDiff > 0 ? bytesDiff / timeDiff : 0;

    // Update record
    record.downloadedBytes = progress.totalBytesWritten;
    record.totalBytes = progress.totalBytesExpectedToWrite;
    record.speed = speed;
    record.updatedAt = now;
    record.resumable = true;
    this.downloadRecords.set(downloadId, record);

    // Calculate progress percentage
    const progressPercent = record.totalBytes > 0
      ? Math.round((record.downloadedBytes / record.totalBytes) * 100)
      : 0;

    const progressData: DownloadProgress = {
      downloadId,
      progress: progressPercent,
      downloadedBytes: record.downloadedBytes,
      totalBytes: record.totalBytes,
      speed,
      filename: record.filename,
    };

    // Notify callbacks
    const callback = this.progressCallbacks.get(downloadId);
    if (callback) {
      callback(progressData);
    }
    if (this.onGlobalProgress) {
      this.onGlobalProgress(progressData);
    }

    // Show notification
    downloadNotificationService.showDownloadProgress({
      downloadId,
      filename: record.filename,
      progress: progressPercent,
      speed,
      totalBytes: record.totalBytes,
      downloadedBytes: record.downloadedBytes,
      status: 'downloading',
      filePath: record.filepath,
    });

    // Schedule save
    this.scheduleSave();
  }

  /**
   * Finalize completed download
   */
  private async finalizeDownload(record: DownloadRecord): Promise<void> {
    try {
      // Verify file integrity
      const partialInfo = await FileSystem.getInfoAsync(record.partialPath);
      
      if (!partialInfo.exists) {
        throw new Error('Downloaded file not found');
      }

      const fileSize = 'size' in partialInfo ? partialInfo.size : 0;

      // Check if size matches expected (if we knew total size)
      if (record.totalBytes > 0 && fileSize !== record.totalBytes) {
        console.warn(`[ResumableDownloads] Size mismatch: ${fileSize} vs ${record.totalBytes}`);
        // For resumable downloads, this can happen with partial responses
        // Only fail if significantly different
        if (Math.abs(fileSize - record.totalBytes) > 1024) {
          throw new Error('File integrity check failed - size mismatch');
        }
      }

      // Move partial file to final location
      await FileSystem.moveAsync({
        from: record.partialPath,
        to: record.filepath,
      });

      // Update record
      record.status = 'completed';
      record.downloadedBytes = fileSize;
      record.updatedAt = Date.now();
      this.downloadRecords.set(record.id, record);
      
      // Clean up
      this.activeDownloads.delete(record.id);
      this.progressCallbacks.delete(record.id);
      
      // Save and notify
      await this.saveRecords();
      
      await downloadNotificationService.showDownloadComplete({
        downloadId: record.id,
        filename: record.filename,
        progress: 100,
        speed: 0,
        totalBytes: record.totalBytes,
        downloadedBytes: record.downloadedBytes,
        status: 'complete',
        filePath: record.filepath,
      });

      console.log(`[ResumableDownloads] Complete: ${record.filename}`);
    } catch (error: any) {
      await this.handleDownloadError(record.id, error.message);
    }
  }

  /**
   * Handle download error
   */
  private async handleDownloadError(downloadId: string, error: string): Promise<void> {
    const record = this.downloadRecords.get(downloadId);
    if (!record) return;

    record.status = 'failed';
    record.error = error;
    record.updatedAt = Date.now();
    this.downloadRecords.set(downloadId, record);

    this.activeDownloads.delete(downloadId);
    this.progressCallbacks.delete(downloadId);

    await this.saveRecords();

    await downloadNotificationService.showDownloadFailed({
      downloadId: record.id,
      filename: record.filename,
      progress: 0,
      speed: 0,
      totalBytes: record.totalBytes,
      downloadedBytes: record.downloadedBytes,
      status: 'failed',
      error,
    });
  }

  /**
   * Pause a download
   */
  async pauseDownload(downloadId: string): Promise<void> {
    const download = this.activeDownloads.get(downloadId);
    const record = this.downloadRecords.get(downloadId);

    if (!download || !record) return;

    try {
      await download.pauseAsync();
      
      record.status = 'paused';
      record.updatedAt = Date.now();
      this.downloadRecords.set(downloadId, record);
      
      await this.saveRecords();

      await downloadNotificationService.showDownloadPaused({
        downloadId: record.id,
        filename: record.filename,
        progress: record.totalBytes > 0 
          ? Math.round((record.downloadedBytes / record.totalBytes) * 100) 
          : 0,
        speed: 0,
        totalBytes: record.totalBytes,
        downloadedBytes: record.downloadedBytes,
        status: 'paused',
      });

      console.log(`[ResumableDownloads] Paused: ${record.filename}`);
    } catch (error) {
      console.error('[ResumableDownloads] Failed to pause:', error);
    }
  }

  /**
   * Resume a paused download
   */
  async resumeDownload(downloadId: string): Promise<void> {
    const record = this.downloadRecords.get(downloadId);
    if (!record || record.status === 'completed') return;

    if (!this.isOnline) {
      console.log('[ResumableDownloads] Cannot resume - offline');
      return;
    }

    // Re-execute download (will resume from partial file)
    await this.executeDownload(record);
  }

  /**
   * Pause all active downloads
   */
  async pauseAllDownloads(): Promise<void> {
    for (const downloadId of this.activeDownloads.keys()) {
      await this.pauseDownload(downloadId);
    }
  }

  /**
   * Cancel and delete a download
   */
  async cancelDownload(downloadId: string): Promise<void> {
    const download = this.activeDownloads.get(downloadId);
    const record = this.downloadRecords.get(downloadId);

    if (download) {
      try {
        await download.cancelAsync();
      } catch (error) {
        // Ignore
      }
    }

    if (record) {
      // Delete partial file
      try {
        const partialInfo = await FileSystem.getInfoAsync(record.partialPath);
        if (partialInfo.exists) {
          await FileSystem.deleteAsync(record.partialPath, { idempotent: true });
        }
      } catch (error) {
        // Ignore
      }

      this.downloadRecords.delete(downloadId);
    }

    this.activeDownloads.delete(downloadId);
    this.progressCallbacks.delete(downloadId);
    
    await this.saveRecords();
    await downloadNotificationService.cancelNotification(downloadId);
  }

  /**
   * Retry a failed download
   */
  async retryDownload(downloadId: string): Promise<void> {
    const record = this.downloadRecords.get(downloadId);
    if (!record) return;

    // Delete corrupted partial file
    try {
      await FileSystem.deleteAsync(record.partialPath, { idempotent: true });
    } catch (error) {
      // Ignore
    }

    // Reset record
    record.downloadedBytes = 0;
    record.status = 'pending';
    record.error = undefined;
    record.updatedAt = Date.now();
    this.downloadRecords.set(downloadId, record);

    // Start fresh
    await this.executeDownload(record);
  }

  /**
   * Get all download records
   */
  getAllRecords(): DownloadRecord[] {
    return Array.from(this.downloadRecords.values())
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * Get active downloads
   */
  getActiveDownloads(): DownloadRecord[] {
    return this.getAllRecords()
      .filter((r) => r.status === 'downloading' || r.status === 'paused');
  }

  /**
   * Get completed downloads
   */
  getCompletedDownloads(): DownloadRecord[] {
    return this.getAllRecords()
      .filter((r) => r.status === 'completed');
  }

  /**
   * Get download record by ID
   */
  getRecord(downloadId: string): DownloadRecord | undefined {
    return this.downloadRecords.get(downloadId);
  }

  /**
   * Delete completed download record
   */
  async deleteRecord(downloadId: string): Promise<void> {
    const record = this.downloadRecords.get(downloadId);
    if (!record) return;

    // Delete file
    try {
      await FileSystem.deleteAsync(record.filepath, { idempotent: true });
    } catch (error) {
      // Ignore
    }

    this.downloadRecords.delete(downloadId);
    await this.saveRecords();
  }

  /**
   * Clear all failed downloads
   */
  async clearFailedDownloads(): Promise<void> {
    const failed = Array.from(this.downloadRecords.values())
      .filter((r) => r.status === 'failed');

    for (const record of failed) {
      await this.deleteRecord(record.id);
    }
  }

  /**
   * Sanitize filename
   */
  private sanitizeFilename(filename: string): string {
    return filename
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, '_')
      .substring(0, 200);
  }

  /**
   * Check if download exists and is resumable
   */
  isResumable(downloadId: string): boolean {
    const record = this.downloadRecords.get(downloadId);
    return record?.resumable === true && record.status === 'paused';
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const resumableDownloadService = new ResumableDownloadService();

export default resumableDownloadService;
