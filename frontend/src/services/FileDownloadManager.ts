import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { downloadNotificationService } from './DownloadNotificationService';
import { resumableDownloadService, DownloadRecord } from './ResumableDownloadService';

// Type aliases for expo-file-system legacy API
const documentDirectory = (FileSystem as any).documentDirectory as string | null;
type DownloadResumable = any;

// Common downloadable file extensions
const DOWNLOADABLE_EXTENSIONS = [
  // Documents
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.rtf', '.csv',
  // Images
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico', '.heic',
  // Archives
  '.zip', '.rar', '.7z', '.tar', '.gz', '.bz2',
  // Audio
  '.mp3', '.wav', '.aac', '.flac', '.ogg', '.m4a',
  // Video
  '.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v',
  // Other
  '.apk', '.ipa', '.dmg', '.exe', '.json', '.xml',
];

// Content-Disposition header patterns that indicate a download
const DOWNLOAD_CONTENT_TYPES = [
  'application/octet-stream',
  'application/pdf',
  'application/zip',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats',
  'image/',
  'audio/',
  'video/',
];

// ============================================================
// AUTO-CATEGORIZATION
// ============================================================
export type DownloadCategory = 'Documents' | 'Images' | 'Media' | 'Archives' | 'Other';

const CATEGORY_FOLDER_MAP: Record<DownloadCategory, string[]> = {
  Documents: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf', 'csv', 'json', 'xml'],
  Images: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'heic'],
  Media: ['mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a', 'mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v'],
  Archives: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2'],
  Other: ['apk', 'ipa', 'dmg', 'exe'],
};

const CATEGORY_ICONS: Record<DownloadCategory, string> = {
  Documents: 'document-text',
  Images: 'image',
  Media: 'musical-notes',
  Archives: 'archive',
  Other: 'ellipsis-horizontal-circle',
};

const CATEGORY_COLORS: Record<DownloadCategory, string> = {
  Documents: '#3B82F6',
  Images: '#8B5CF6',
  Media: '#EC4899',
  Archives: '#6366F1',
  Other: '#6B7280',
};

/**
 * Determine the download category for a filename based on its extension.
 */
export function getCategoryForFile(filename: string): DownloadCategory {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  for (const [category, exts] of Object.entries(CATEGORY_FOLDER_MAP)) {
    if (exts.includes(ext)) return category as DownloadCategory;
  }
  return 'Other';
}

export { CATEGORY_ICONS, CATEGORY_COLORS };

// ============================================================
// TYPES
// ============================================================
export interface DownloadProgress {
  totalBytesWritten: number;
  totalBytesExpectedToWrite: number;
  progress: number; // 0-100
}

export interface DownloadResult {
  success: boolean;
  localUri?: string;
  filename?: string;
  category?: DownloadCategory;
  error?: string;
}

export type DownloadStatusCallback = (
  status: 'starting' | 'downloading' | 'complete' | 'error',
  progress?: number,
  filename?: string,
  error?: string
) => void;

// ============================================================
// FILE DOWNLOAD MANAGER
// ============================================================
class FileDownloadManager {
  private activeDownloads: Map<string, DownloadResumable> = new Map();
  private directoriesReady = false;
  private isInitialized = false;

  /**
   * Initialize the download manager and related services
   */
  async initialize(): Promise<void> {
    if (this.isInitialized || Platform.OS === 'web') return;

    try {
      // Initialize notification service
      await downloadNotificationService.initialize();
      
      // Initialize resumable download service
      await resumableDownloadService.initialize();
      
      // Ensure category directories exist
      await this.ensureCategoryDirectories();
      
      this.isInitialized = true;
      console.log('[DownloadManager] Initialized with notifications and resumable downloads');
    } catch (error) {
      console.error('[DownloadManager] Failed to initialize:', error);
    }
  }

  /**
   * Ensure category subdirectories exist under documentDirectory.
   * Called once lazily on first download.
   */
  private async ensureCategoryDirectories(): Promise<void> {
    if (this.directoriesReady || Platform.OS === 'web') return;
    const base = documentDirectory;
    if (!base) return;

    const folders: DownloadCategory[] = ['Documents', 'Images', 'Media', 'Archives', 'Other'];
    for (const folder of folders) {
      const dirUri = `${base}${folder}/`;
      try {
        const info = await FileSystem.getInfoAsync(dirUri);
        if (!info.exists) {
          await FileSystem.makeDirectoryAsync(dirUri, { intermediates: true });
          console.log(`[DownloadManager] Created category folder: ${folder}/`);
        }
      } catch (e) {
        console.warn(`[DownloadManager] Could not create folder ${folder}:`, e);
      }
    }
    this.directoriesReady = true;
  }

  /**
   * Check if a URL should trigger a download based on its extension
   */
  isDownloadableUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname.toLowerCase();
      for (const ext of DOWNLOADABLE_EXTENSIONS) {
        if (pathname.endsWith(ext)) return true;
      }
      const params = urlObj.searchParams;
      if (params.has('download') || params.has('dl')) return true;
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Extract filename from URL or Content-Disposition header
   */
  extractFilename(url: string, contentDisposition?: string): string {
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (filenameMatch && filenameMatch[1]) {
        return filenameMatch[1].replace(/['"]/g, '');
      }
    }
    try {
      const urlObj = new URL(url);
      const segments = urlObj.pathname.split('/').filter(Boolean);
      if (segments.length > 0) {
        return decodeURIComponent(segments[segments.length - 1]).replace(/[<>:"/\\|?*]/g, '_');
      }
    } catch {}
    return `download_${Date.now()}`;
  }

  /**
   * Get file extension from filename
   */
  getFileExtension(filename: string): string {
    const match = filename.match(/\.[a-zA-Z0-9]+$/);
    return match ? match[0] : '';
  }

  /**
   * Build the local URI for a file, routed to its category subfolder.
   */
  private buildCategoryUri(filename: string): { uri: string; category: DownloadCategory } {
    const category = getCategoryForFile(filename);
    const base = documentDirectory;
    return {
      uri: `${base}${category}/${filename}`,
      category,
    };
  }

  /**
   * Download a file from URL with progress tracking.
   * Files are auto-categorised into subdirectories.
   */
  async downloadFile(
    url: string,
    onStatusChange?: DownloadStatusCallback
  ): Promise<DownloadResult> {
    await this.ensureCategoryDirectories();

    const filename = this.extractFilename(url);
    const { uri: localUri, category } = this.buildCategoryUri(filename);

    console.log(`[DownloadManager] Starting download: ${filename} -> ${category}/`);
    onStatusChange?.('starting', 0, filename);

    try {
      const downloadResumable = FileSystem.createDownloadResumable(
        url,
        localUri,
        {},
        (downloadProgress) => {
          const progress = downloadProgress.totalBytesExpectedToWrite > 0
            ? Math.round((downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite) * 100)
            : 0;
          onStatusChange?.('downloading', progress, filename);
        }
      );

      this.activeDownloads.set(url, downloadResumable);
      const result = await downloadResumable.downloadAsync();
      this.activeDownloads.delete(url);

      if (result?.uri) {
        console.log(`[DownloadManager] Download complete: ${result.uri} [${category}]`);
        onStatusChange?.('complete', 100, filename);
        return { success: true, localUri: result.uri, filename, category };
      } else {
        throw new Error('Download failed - no URI returned');
      }
    } catch (error: any) {
      console.error(`[DownloadManager] Download error:`, error);
      this.activeDownloads.delete(url);
      onStatusChange?.('error', 0, filename, error.message || 'Download failed');
      return { success: false, error: error.message || 'Download failed' };
    }
  }

  /**
   * Cancel an active download
   */
  async cancelDownload(url: string): Promise<void> {
    const download = this.activeDownloads.get(url);
    if (download) {
      try {
        await download.pauseAsync();
        this.activeDownloads.delete(url);
        console.log(`[DownloadManager] Download cancelled: ${url}`);
      } catch (error) {
        console.error(`[DownloadManager] Cancel error:`, error);
      }
    }
  }

  /**
   * Share a downloaded file using native sharing
   */
  async shareFile(localUri: string): Promise<boolean> {
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        console.warn('[DownloadManager] Sharing not available on this device');
        return false;
      }
      await Sharing.shareAsync(localUri, {
        mimeType: this.getMimeType(localUri),
        dialogTitle: 'Save or Share File',
        UTI: this.getUTI(localUri),
      });
      console.log(`[DownloadManager] File shared successfully: ${localUri}`);
      return true;
    } catch (error: any) {
      console.error(`[DownloadManager] Share error:`, error);
      return false;
    }
  }

  /**
   * Download and immediately share a file
   */
  async downloadAndShare(
    url: string,
    onStatusChange?: DownloadStatusCallback
  ): Promise<DownloadResult> {
    const result = await this.downloadFile(url, onStatusChange);
    if (result.success && result.localUri) {
      await new Promise(resolve => setTimeout(resolve, 500));
      const shared = await this.shareFile(result.localUri);
      if (!shared) {
        console.warn('[DownloadManager] Sharing not available, file saved locally');
      }
    }
    return result;
  }

  private getMimeType(filename: string): string {
    const ext = this.getFileExtension(filename).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.txt': 'text/plain', '.csv': 'text/csv',
      '.json': 'application/json', '.xml': 'application/xml',
      '.zip': 'application/zip',
      '.rar': 'application/x-rar-compressed',
      '.7z': 'application/x-7z-compressed',
      '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
      '.png': 'image/png', '.gif': 'image/gif',
      '.webp': 'image/webp', '.svg': 'image/svg+xml',
      '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
      '.mp4': 'video/mp4', '.mov': 'video/quicktime',
      '.avi': 'video/x-msvideo',
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  private getUTI(filename: string): string {
    const ext = this.getFileExtension(filename).toLowerCase();
    const utis: Record<string, string> = {
      '.pdf': 'com.adobe.pdf',
      '.doc': 'com.microsoft.word.doc',
      '.docx': 'org.openxmlformats.wordprocessingml.document',
      '.xls': 'com.microsoft.excel.xls',
      '.xlsx': 'org.openxmlformats.spreadsheetml.sheet',
      '.jpg': 'public.jpeg', '.jpeg': 'public.jpeg',
      '.png': 'public.png', '.gif': 'com.compuserve.gif',
      '.mp3': 'public.mp3', '.mp4': 'public.mpeg-4',
      '.zip': 'public.zip-archive',
    };
    return utis[ext] || 'public.data';
  }

  async getFileInfo(localUri: string): Promise<FileSystem.FileInfo | null> {
    try {
      return await FileSystem.getInfoAsync(localUri);
    } catch {
      return null;
    }
  }

  async deleteFile(localUri: string): Promise<boolean> {
    try {
      await FileSystem.deleteAsync(localUri, { idempotent: true });
      console.log(`[DownloadManager] File deleted: ${localUri}`);
      return true;
    } catch (error) {
      console.error(`[DownloadManager] Delete error:`, error);
      return false;
    }
  }

  async listDownloads(): Promise<string[]> {
    try {
      const directory = documentDirectory;
      if (!directory) return [];
      return await FileSystem.readDirectoryAsync(directory);
    } catch {
      return [];
    }
  }

  // ============================================================
  // RESUMABLE DOWNLOAD METHODS
  // ============================================================

  /**
   * Start a resumable download with notification support
   */
  async startResumableDownload(
    url: string,
    filename?: string,
    onStatusChange?: DownloadStatusCallback
  ): Promise<string | null> {
    if (Platform.OS === 'web') {
      console.warn('[DownloadManager] Resumable downloads not supported on web');
      return null;
    }

    await this.initialize();

    const finalFilename = filename || this.extractFilename(url);
    
    try {
      const downloadId = await resumableDownloadService.startDownload(
        url,
        finalFilename,
        this.getMimeType(finalFilename),
        (progress) => {
          // Map progress to status callback
          onStatusChange?.('downloading', progress.progress, progress.filename);
        }
      );

      onStatusChange?.('starting', 0, finalFilename);
      return downloadId;
    } catch (error: any) {
      onStatusChange?.('error', 0, finalFilename, error.message);
      return null;
    }
  }

  /**
   * Pause a resumable download
   */
  async pauseResumableDownload(downloadId: string): Promise<void> {
    await resumableDownloadService.pauseDownload(downloadId);
  }

  /**
   * Resume a paused download
   */
  async resumeResumableDownload(downloadId: string): Promise<void> {
    await resumableDownloadService.resumeDownload(downloadId);
  }

  /**
   * Cancel a resumable download
   */
  async cancelResumableDownload(downloadId: string): Promise<void> {
    await resumableDownloadService.cancelDownload(downloadId);
  }

  /**
   * Retry a failed download
   */
  async retryDownload(downloadId: string): Promise<void> {
    await resumableDownloadService.retryDownload(downloadId);
  }

  /**
   * Get all download records from resumable service
   */
  getAllDownloadRecords(): DownloadRecord[] {
    return resumableDownloadService.getAllRecords();
  }

  /**
   * Get active downloads
   */
  getActiveDownloadRecords(): DownloadRecord[] {
    return resumableDownloadService.getActiveDownloads();
  }

  /**
   * Get completed downloads
   */
  getCompletedDownloadRecords(): DownloadRecord[] {
    return resumableDownloadService.getCompletedDownloads();
  }

  /**
   * Check if a download can be resumed
   */
  canResumeDownload(downloadId: string): boolean {
    return resumableDownloadService.isResumable(downloadId);
  }

  /**
   * Set global progress callback for all downloads
   */
  setGlobalProgressCallback(callback: (progress: { downloadId: string; progress: number; speed: number; filename: string }) => void): void {
    resumableDownloadService.setProgressCallback(callback);
  }
}

// Export singleton instance
export const downloadManager = new FileDownloadManager();
export default downloadManager;
