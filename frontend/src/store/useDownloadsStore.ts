import { create } from 'zustand';

export interface ActiveDownload {
  id: string;
  filename: string;
  url: string;
  progress: number;
  status: 'starting' | 'downloading' | 'complete' | 'error';
  error?: string;
  startedAt: number;
  bytesDownloaded?: number;
  totalBytes?: number;
}

interface DownloadsStore {
  activeDownloads: Record<string, ActiveDownload>;
  completedCount: number; // Badge count for UI
  totalStorageUsed: number; // Bytes used by downloads
  startDownload: (url: string, filename: string) => string;
  updateProgress: (id: string, progress: number, bytesDownloaded?: number, totalBytes?: number) => void;
  completeDownload: (id: string, fileSize?: number) => void;
  failDownload: (id: string, error: string) => void;
  removeActive: (id: string) => void;
  clearCompleted: () => void;
  resetCompletedCount: () => void;
  updateStorageUsed: (bytes: number) => void;
  isDuplicate: (url: string) => boolean;
}

let idCounter = 0;
const downloadHistory = new Set<string>(); // Track downloaded URLs for duplicate detection

export const useDownloadsStore = create<DownloadsStore>((set, get) => ({
  activeDownloads: {},
  completedCount: 0,
  totalStorageUsed: 0,

  startDownload: (url: string, filename: string) => {
    const id = `dl_${Date.now()}_${++idCounter}`;
    set((state) => ({
      activeDownloads: {
        ...state.activeDownloads,
        [id]: { 
          id, 
          filename, 
          url, 
          progress: 0, 
          status: 'starting', 
          startedAt: Date.now(),
          bytesDownloaded: 0,
          totalBytes: 0,
        },
      },
    }));
    return id;
  },

  updateProgress: (id: string, progress: number, bytesDownloaded?: number, totalBytes?: number) => {
    set((state) => {
      const dl = state.activeDownloads[id];
      if (!dl) return state;
      return {
        activeDownloads: {
          ...state.activeDownloads,
          [id]: { 
            ...dl, 
            progress, 
            status: 'downloading',
            bytesDownloaded: bytesDownloaded ?? dl.bytesDownloaded,
            totalBytes: totalBytes ?? dl.totalBytes,
          },
        },
      };
    });
  },

  completeDownload: (id: string, fileSize?: number) => {
    const dl = get().activeDownloads[id];
    if (dl) {
      // Add to download history for duplicate detection
      downloadHistory.add(dl.url);
    }
    
    set((state) => {
      const dl = state.activeDownloads[id];
      if (!dl) return state;
      return {
        activeDownloads: {
          ...state.activeDownloads,
          [id]: { ...dl, progress: 100, status: 'complete' },
        },
        completedCount: state.completedCount + 1,
        totalStorageUsed: state.totalStorageUsed + (fileSize || 0),
      };
    });
    // Auto-remove from active after 3s
    setTimeout(() => get().removeActive(id), 3000);
  },

  failDownload: (id: string, error: string) => {
    set((state) => {
      const dl = state.activeDownloads[id];
      if (!dl) return state;
      return {
        activeDownloads: {
          ...state.activeDownloads,
          [id]: { ...dl, status: 'error', error },
        },
      };
    });
    setTimeout(() => get().removeActive(id), 5000);
  },

  removeActive: (id: string) => {
    set((state) => {
      const { [id]: _, ...rest } = state.activeDownloads;
      return { activeDownloads: rest };
    });
  },

  clearCompleted: () => {
    set((state) => {
      const filtered: Record<string, ActiveDownload> = {};
      for (const [k, v] of Object.entries(state.activeDownloads)) {
        if (v.status !== 'complete') filtered[k] = v;
      }
      return { activeDownloads: filtered };
    });
  },

  resetCompletedCount: () => {
    set({ completedCount: 0 });
  },

  updateStorageUsed: (bytes: number) => {
    set({ totalStorageUsed: bytes });
  },

  isDuplicate: (url: string) => {
    return downloadHistory.has(url);
  },
}));
