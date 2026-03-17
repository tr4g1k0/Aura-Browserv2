// AI Context Provider
// Provides AI services and settings to React components

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { hybridAIRouter, AISource } from '../ai/HybridAIRouter';
import { modelDownloadManager } from '../ai/ModelDownloadManager';
import { aiModelManager } from '../ai/AIModelManager';
import { AISettings, DEFAULT_AI_SETTINGS, ModelDownloadProgress, ModelStatus } from '../ai/types';
import { MODEL_REGISTRY, DEFAULT_MODELS } from '../ai/models.config';
import { liveCaptioningService, CaptionSegment } from '../services/LiveCaptioningService';
import { ambientAwarenessService, AmbientAlert } from '../services/AmbientAwarenessService';

interface ModelInfo {
  id: string;
  name: string;
  type: string;
  size: number;
  status: ModelStatus;
  downloadProgress?: number;
}

interface AIContextType {
  // Settings
  settings: AISettings;
  updateSettings: (newSettings: Partial<AISettings>) => void;
  
  // Model management
  models: ModelInfo[];
  downloadModel: (modelId: string) => Promise<void>;
  deleteModel: (modelId: string) => Promise<void>;
  isDownloading: boolean;
  downloadProgress: Record<string, number>;
  
  // Live captioning
  isCaptioningActive: boolean;
  startCaptioning: () => Promise<boolean>;
  stopCaptioning: () => void;
  captions: CaptionSegment[];
  captioningStatus: 'idle' | 'listening' | 'processing' | 'error';
  
  // Ambient awareness
  isAmbientActive: boolean;
  startAmbientAwareness: () => Promise<boolean>;
  stopAmbientAwareness: () => void;
  ambientAlerts: AmbientAlert[];
  clearAmbientAlerts: () => void;
  
  // Status
  isOnnxAvailable: boolean;
  memoryUsage: { used: number; max: number; percentage: number };
  preferredSource: AISource;
}

const AIContext = createContext<AIContextType | null>(null);

export const useAI = (): AIContextType => {
  const context = useContext(AIContext);
  if (!context) {
    throw new Error('useAI must be used within an AIProvider');
  }
  return context;
};

interface AIProviderProps {
  children: ReactNode;
}

export const AIProvider: React.FC<AIProviderProps> = ({ children }) => {
  const [settings, setSettings] = useState<AISettings>(DEFAULT_AI_SETTINGS);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});
  
  const [isCaptioningActive, setIsCaptioningActive] = useState(false);
  const [captions, setCaptions] = useState<CaptionSegment[]>([]);
  const [captioningStatus, setCaptioningStatus] = useState<'idle' | 'listening' | 'processing' | 'error'>('idle');
  
  const [isAmbientActive, setIsAmbientActive] = useState(false);
  const [ambientAlerts, setAmbientAlerts] = useState<AmbientAlert[]>([]);
  
  const [memoryUsage, setMemoryUsage] = useState({ used: 0, max: 512 * 1024 * 1024, percentage: 0 });

  // Initialize models list
  useEffect(() => {
    const initModels = async () => {
      const modelList: ModelInfo[] = [];
      for (const [id, config] of Object.entries(MODEL_REGISTRY)) {
        const status = await modelDownloadManager.getModelStatus(id);
        modelList.push({
          id,
          name: config.name,
          type: config.type,
          size: config.size,
          status,
        });
      }
      setModels(modelList);
    };
    initModels();
  }, []);

  // Subscribe to captioning service
  useEffect(() => {
    const unsubCaption = liveCaptioningService.onCaption((segment) => {
      setCaptions(prev => [...prev.slice(-9), segment]); // Keep last 10
    });
    
    const unsubStatus = liveCaptioningService.onStatus((status) => {
      setCaptioningStatus(status);
    });

    return () => {
      unsubCaption();
      unsubStatus();
    };
  }, []);

  // Subscribe to ambient awareness service
  useEffect(() => {
    const unsubAlert = ambientAwarenessService.onAlert((alert) => {
      setAmbientAlerts(prev => [...prev.slice(-4), alert]); // Keep last 5
    });

    return () => {
      unsubAlert();
    };
  }, []);

  // Update settings
  const updateSettings = useCallback((newSettings: Partial<AISettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      hybridAIRouter.updateSettings(updated);
      return updated;
    });
  }, []);

  // Download model
  const downloadModel = useCallback(async (modelId: string) => {
    setIsDownloading(true);
    
    try {
      await modelDownloadManager.downloadModel(modelId, (progress) => {
        setDownloadProgress(prev => ({
          ...prev,
          [modelId]: progress.progress,
        }));
      });

      // Update model status
      setModels(prev => prev.map(m => 
        m.id === modelId ? { ...m, status: 'ready' } : m
      ));
    } catch (error) {
      console.error('Failed to download model:', error);
      setModels(prev => prev.map(m => 
        m.id === modelId ? { ...m, status: 'error' } : m
      ));
    } finally {
      setIsDownloading(false);
      setDownloadProgress(prev => {
        const { [modelId]: _, ...rest } = prev;
        return rest;
      });
    }
  }, []);

  // Delete model
  const deleteModel = useCallback(async (modelId: string) => {
    try {
      await aiModelManager.unloadModel(modelId);
      await modelDownloadManager.deleteModel(modelId);
      
      setModels(prev => prev.map(m => 
        m.id === modelId ? { ...m, status: 'not_downloaded' } : m
      ));
    } catch (error) {
      console.error('Failed to delete model:', error);
    }
  }, []);

  // Start captioning
  const startCaptioning = useCallback(async () => {
    const success = await liveCaptioningService.start();
    setIsCaptioningActive(success);
    return success;
  }, []);

  // Stop captioning
  const stopCaptioning = useCallback(() => {
    liveCaptioningService.stop();
    setIsCaptioningActive(false);
  }, []);

  // Start ambient awareness
  const startAmbientAwareness = useCallback(async () => {
    const success = await ambientAwarenessService.start();
    setIsAmbientActive(success);
    return success;
  }, []);

  // Stop ambient awareness
  const stopAmbientAwareness = useCallback(() => {
    ambientAwarenessService.stop();
    setIsAmbientActive(false);
  }, []);

  // Clear ambient alerts
  const clearAmbientAlerts = useCallback(() => {
    setAmbientAlerts([]);
  }, []);

  // Determine preferred source
  const preferredSource: AISource = settings.strictLocalProcessing 
    ? 'local' 
    : (aiModelManager.isAvailable() ? 'local' : 'cloud');

  const value: AIContextType = {
    settings,
    updateSettings,
    models,
    downloadModel,
    deleteModel,
    isDownloading,
    downloadProgress,
    isCaptioningActive,
    startCaptioning,
    stopCaptioning,
    captions,
    captioningStatus,
    isAmbientActive,
    startAmbientAwareness,
    stopAmbientAwareness,
    ambientAlerts,
    clearAmbientAlerts,
    isOnnxAvailable: aiModelManager.isAvailable(),
    memoryUsage,
    preferredSource,
  };

  return (
    <AIContext.Provider value={value}>
      {children}
    </AIContext.Provider>
  );
};
