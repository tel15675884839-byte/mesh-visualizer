
import { create } from 'zustand';
import { api } from '../lib/api';
import type { NetworkTopology } from '@mesh/shared';

interface AppState {
  topology: NetworkTopology | null;
  isLoading: boolean;
  error: string | null;
  fetchTopology: () => Promise<void>;
  syncTopology: (data: NetworkTopology) => Promise<void>;
  deployDevice: (mac: string, x: number, y: number, floorId: string) => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
  topology: null,
  isLoading: false,
  error: null,

  fetchTopology: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await api.get('/topology');
      // @ts-ignore
      set({ topology: data, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  syncTopology: async (data) => {
    set({ isLoading: true });
    try {
      await api.post('/topology/sync', data);
      await get().fetchTopology();
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  deployDevice: async (mac, x, y, floorId) => {
    try {
      await api.post('/topology/deploy', { mac, x, y, floorId });
      await get().fetchTopology();
    } catch (err: any) {
      console.error(err);
    }
  }
}));
