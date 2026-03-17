// Model Download Manager
// Handles downloading, caching, and managing ONNX model files

import * as FileSystem from 'expo-file-system/legacy';
import { ModelConfig, ModelDownloadProgress, ModelStatus } from './types';
import { MODEL_REGISTRY, getModelById } from './models.config';

const MODELS_DIRECTORY = `${FileSystem.documentDirectory}models/`;

export class ModelDownloadManager {
  private downloadCallbacks: Map<string, ((progress: ModelDownloadProgress) => void)[]> = new Map();
  private modelStatus: Map<string, ModelStatus> = new Map();
  private activeDownloads: Map<string, FileSystem.DownloadResumable> = new Map();

  constructor() {
    this.initializeModelsDirectory();
  }

  private async initializeModelsDirectory(): Promise<void> {
    try {
      const dirInfo = await FileSystem.getInfoAsync(MODELS_DIRECTORY);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(MODELS_DIRECTORY, { intermediates: true });
      }
    } catch (error) {
      console.error('[ModelDownloadManager] Failed to initialize directory:', error);
    }
  }

  /**
   * Get the local path for a model file
   */
  getModelPath(modelId: string): string {
    const config = getModelById(modelId);
    if (!config) {
      throw new Error(`Unknown model: ${modelId}`);
    }
    return `${MODELS_DIRECTORY}${config.filename}`;
  }

  /**
   * Check if a model is downloaded and ready
   */
  async isModelReady(modelId: string): Promise<boolean> {
    try {
      const path = this.getModelPath(modelId);
      const info = await FileSystem.getInfoAsync(path);
      return info.exists;
    } catch {
      return false;
    }
  }

  /**
   * Get the status of a model
   */
  async getModelStatus(modelId: string): Promise<ModelStatus> {
    // Check if currently downloading
    if (this.activeDownloads.has(modelId)) {
      return 'downloading';
    }
    
    // Check if file exists
    const isReady = await this.isModelReady(modelId);
    return isReady ? 'ready' : 'not_downloaded';
  }

  /**
   * Get all model statuses
   */
  async getAllModelStatuses(): Promise<Record<string, ModelStatus>> {
    const statuses: Record<string, ModelStatus> = {};
    for (const modelId of Object.keys(MODEL_REGISTRY)) {
      statuses[modelId] = await this.getModelStatus(modelId);
    }
    return statuses;
  }

  /**
   * Download a model from URL
   */
  async downloadModel(
    modelId: string,
    onProgress?: (progress: ModelDownloadProgress) => void
  ): Promise<string> {
    const config = getModelById(modelId);
    if (!config) {
      throw new Error(`Unknown model: ${modelId}`);
    }

    // Check if already downloaded
    const isReady = await this.isModelReady(modelId);
    if (isReady) {
      console.log(`[ModelDownloadManager] Model ${modelId} already downloaded`);
      return this.getModelPath(modelId);
    }

    // Check if already downloading
    if (this.activeDownloads.has(modelId)) {
      throw new Error(`Model ${modelId} is already downloading`);
    }

    const localPath = this.getModelPath(modelId);
    const totalBytes = config.size * 1024 * 1024; // Convert MB to bytes

    console.log(`[ModelDownloadManager] Starting download: ${modelId}`);
    console.log(`[ModelDownloadManager] URL: ${config.downloadUrl}`);
    console.log(`[ModelDownloadManager] Local path: ${localPath}`);

    // Create download callback
    const downloadCallback = (downloadProgress: FileSystem.DownloadProgressData) => {
      const progress: ModelDownloadProgress = {
        modelId,
        progress: Math.round((downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite) * 100),
        downloadedBytes: downloadProgress.totalBytesWritten,
        totalBytes: downloadProgress.totalBytesExpectedToWrite,
        status: 'downloading',
      };
      
      onProgress?.(progress);
      this.notifyProgressCallbacks(modelId, progress);
    };

    try {
      // Create resumable download
      const downloadResumable = FileSystem.createDownloadResumable(
        config.downloadUrl,
        localPath,
        {},
        downloadCallback
      );

      this.activeDownloads.set(modelId, downloadResumable);

      // Start download
      const result = await downloadResumable.downloadAsync();
      
      this.activeDownloads.delete(modelId);

      if (result?.uri) {
        console.log(`[ModelDownloadManager] Download complete: ${modelId}`);
        return result.uri;
      } else {
        throw new Error('Download failed - no URI returned');
      }
    } catch (error) {
      this.activeDownloads.delete(modelId);
      console.error(`[ModelDownloadManager] Download failed: ${modelId}`, error);
      throw error;
    }
  }

  /**
   * Cancel an active download
   */
  async cancelDownload(modelId: string): Promise<void> {
    const download = this.activeDownloads.get(modelId);
    if (download) {
      await download.pauseAsync();
      this.activeDownloads.delete(modelId);
      
      // Delete partial file
      try {
        const path = this.getModelPath(modelId);
        await FileSystem.deleteAsync(path, { idempotent: true });
      } catch {}
    }
  }

  /**
   * Delete a downloaded model
   */
  async deleteModel(modelId: string): Promise<void> {
    try {
      const path = this.getModelPath(modelId);
      await FileSystem.deleteAsync(path, { idempotent: true });
      console.log(`[ModelDownloadManager] Deleted model: ${modelId}`);
    } catch (error) {
      console.error(`[ModelDownloadManager] Failed to delete model: ${modelId}`, error);
      throw error;
    }
  }

  /**
   * Get total disk usage of downloaded models
   */
  async getTotalDiskUsage(): Promise<number> {
    let totalBytes = 0;
    
    for (const modelId of Object.keys(MODEL_REGISTRY)) {
      try {
        const path = this.getModelPath(modelId);
        const info = await FileSystem.getInfoAsync(path);
        if (info.exists && 'size' in info) {
          totalBytes += info.size || 0;
        }
      } catch {}
    }
    
    return totalBytes;
  }

  /**
   * Subscribe to download progress
   */
  subscribeToProgress(modelId: string, callback: (progress: ModelDownloadProgress) => void): () => void {
    if (!this.downloadCallbacks.has(modelId)) {
      this.downloadCallbacks.set(modelId, []);
    }
    this.downloadCallbacks.get(modelId)!.push(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.downloadCallbacks.get(modelId);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }

  private notifyProgressCallbacks(modelId: string, progress: ModelDownloadProgress): void {
    const callbacks = this.downloadCallbacks.get(modelId);
    if (callbacks) {
      callbacks.forEach(cb => cb(progress));
    }
  }
}

// Singleton instance
export const modelDownloadManager = new ModelDownloadManager();
