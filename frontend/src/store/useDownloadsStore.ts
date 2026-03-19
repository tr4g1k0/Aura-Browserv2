import { create } from 'zustand';

export interface ActiveDownload {
  id: string;
  filename: string;
  url: string;
  progress: number;
  status: 'starting' | 'downloading' | 'complete' | 'error';
  error?: string;
  startedAt: number;
}

interface DownloadsStore {
  activeDownloads: Record<string, ActiveDownload>;
  startDownload: (url: string, filename: string) => string;
  updateProgress: (id: string, progress: number) => void;
  completeDownload: (id: string) => void;
  failDownload: (id: string, error: string) => void;
  removeActive: (id: string) => void;
  clearCompleted: () => void;
}

let idCounter = 0;

export const useDownloadsStore = create<DownloadsStore>((set, get) => ({
  activeDownloads: {},

  startDownload: (url: string, filename: string) => {
    const id = `dl_${Date.now()}_${++idCounter}`;
    set((state) => ({
      activeDownloads: {
        ...state.activeDownloads,
        [id]: { id, filename, url, progress: 0, status: 'starting', startedAt: Date.now() },
      },
    }));
    return id;
  },

  updateProgress: (id: string, progress: number) => {
    set((state) => {
      const dl = state.activeDownloads[id];
      if (!dl) return state;
      return {
        activeDownloads: {
          ...state.activeDownloads,
          [id]: { ...dl, progress, status: 'downloading' },
        },
      };
    });
  },

  completeDownload: (id: string) => {
    set((state) => {
      const dl = state.activeDownloads[id];
      if (!dl) return state;
      return {
        activeDownloads: {
          ...state.activeDownloads,
          [id]: { ...dl, progress: 100, status: 'complete' },
        },
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
}));
