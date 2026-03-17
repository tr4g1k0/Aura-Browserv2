import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

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

export interface DownloadProgress {
  totalBytesWritten: number;
  totalBytesExpectedToWrite: number;
  progress: number; // 0-100
}

export interface DownloadResult {
  success: boolean;
  localUri?: string;
  filename?: string;
  error?: string;
}

export type DownloadStatusCallback = (
  status: 'starting' | 'downloading' | 'complete' | 'error',
  progress?: number,
  filename?: string,
  error?: string
) => void;

/**
 * FileDownloadManager - Handles secure file downloads in the browser
 * 
 * Features:
 * - Detects downloadable URLs by extension and content type
 * - Downloads files to app's document directory
 * - Reports progress for UI feedback
 * - Triggers native sharing for saving files
 */
class FileDownloadManager {
  private activeDownloads: Map<string, FileSystem.DownloadResumable> = new Map();

  /**
   * Check if a URL should trigger a download based on its extension
   */
  isDownloadableUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname.toLowerCase();
      
      // Check for file extensions
      for (const ext of DOWNLOADABLE_EXTENSIONS) {
        if (pathname.endsWith(ext)) {
          return true;
        }
      }

      // Check for download query parameters
      const params = urlObj.searchParams;
      if (params.has('download') || params.has('dl')) {
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Extract filename from URL or Content-Disposition header
   */
  extractFilename(url: string, contentDisposition?: string): string {
    // Try to extract from Content-Disposition header first
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (filenameMatch && filenameMatch[1]) {
        return filenameMatch[1].replace(/['"]/g, '');
      }
    }

    // Extract from URL path
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const segments = pathname.split('/').filter(Boolean);
      
      if (segments.length > 0) {
        const lastSegment = segments[segments.length - 1];
        // Decode URI component and sanitize
        return decodeURIComponent(lastSegment).replace(/[<>:"/\\|?*]/g, '_');
      }
    } catch {}

    // Fallback to timestamp-based filename
    return `download_${Date.now()}`;
  }

  /**
   * Get file extension from filename or URL
   */
  getFileExtension(filename: string): string {
    const match = filename.match(/\.[a-zA-Z0-9]+$/);
    return match ? match[0] : '';
  }

  /**
   * Download a file from URL with progress tracking
   */
  async downloadFile(
    url: string,
    onStatusChange?: DownloadStatusCallback
  ): Promise<DownloadResult> {
    const filename = this.extractFilename(url);
    const localUri = `${FileSystem.documentDirectory}${filename}`;

    console.log(`[DownloadManager] Starting download: ${filename}`);
    onStatusChange?.('starting', 0, filename);

    try {
      // Create download resumable for progress tracking
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

      // Store for potential cancellation
      this.activeDownloads.set(url, downloadResumable);

      // Start download
      const result = await downloadResumable.downloadAsync();

      // Clean up
      this.activeDownloads.delete(url);

      if (result?.uri) {
        console.log(`[DownloadManager] Download complete: ${result.uri}`);
        onStatusChange?.('complete', 100, filename);

        return {
          success: true,
          localUri: result.uri,
          filename,
        };
      } else {
        throw new Error('Download failed - no URI returned');
      }
    } catch (error: any) {
      console.error(`[DownloadManager] Download error:`, error);
      this.activeDownloads.delete(url);
      
      onStatusChange?.('error', 0, filename, error.message || 'Download failed');

      return {
        success: false,
        error: error.message || 'Download failed',
      };
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
      // Check if sharing is available
      const isAvailable = await Sharing.isAvailableAsync();
      
      if (!isAvailable) {
        console.warn('[DownloadManager] Sharing not available on this device');
        return false;
      }

      await Sharing.shareAsync(localUri, {
        mimeType: this.getMimeType(localUri),
        dialogTitle: 'Save or Share File',
        UTI: this.getUTI(localUri), // iOS-specific
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
      // Small delay for UX before sharing
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const shared = await this.shareFile(result.localUri);
      if (!shared) {
        console.warn('[DownloadManager] Sharing not available, file saved locally');
      }
    }

    return result;
  }

  /**
   * Get MIME type based on file extension
   */
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
      '.txt': 'text/plain',
      '.csv': 'text/csv',
      '.json': 'application/json',
      '.xml': 'application/xml',
      '.zip': 'application/zip',
      '.rar': 'application/x-rar-compressed',
      '.7z': 'application/x-7z-compressed',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.mp4': 'video/mp4',
      '.mov': 'video/quicktime',
      '.avi': 'video/x-msvideo',
    };

    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Get UTI (Uniform Type Identifier) for iOS
   */
  private getUTI(filename: string): string {
    const ext = this.getFileExtension(filename).toLowerCase();
    
    const utis: Record<string, string> = {
      '.pdf': 'com.adobe.pdf',
      '.doc': 'com.microsoft.word.doc',
      '.docx': 'org.openxmlformats.wordprocessingml.document',
      '.xls': 'com.microsoft.excel.xls',
      '.xlsx': 'org.openxmlformats.spreadsheetml.sheet',
      '.jpg': 'public.jpeg',
      '.jpeg': 'public.jpeg',
      '.png': 'public.png',
      '.gif': 'com.compuserve.gif',
      '.mp3': 'public.mp3',
      '.mp4': 'public.mpeg-4',
      '.zip': 'public.zip-archive',
    };

    return utis[ext] || 'public.data';
  }

  /**
   * Check file info at local path
   */
  async getFileInfo(localUri: string): Promise<FileSystem.FileInfo | null> {
    try {
      const info = await FileSystem.getInfoAsync(localUri);
      return info;
    } catch {
      return null;
    }
  }

  /**
   * Delete a downloaded file
   */
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

  /**
   * List all downloaded files
   */
  async listDownloads(): Promise<string[]> {
    try {
      const directory = FileSystem.documentDirectory;
      if (!directory) return [];
      
      const files = await FileSystem.readDirectoryAsync(directory);
      return files;
    } catch {
      return [];
    }
  }
}

// Export singleton instance
export const downloadManager = new FileDownloadManager();
export default downloadManager;
