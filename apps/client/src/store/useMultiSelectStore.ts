
import { create } from 'zustand';

interface MultiSelectStore {
  selectedNodeIds: string[];
  setSelectedNodeIds: (ids: string[]) => void;
  addSelectedNodeId: (id: string) => void;
  removeSelectedNodeId: (id: string) => void;
  clearSelectedNodeIds: () => void;
}

export const useMultiSelectStore = create<MultiSelectStore>((set) => ({
  selectedNodeIds: [],
  setSelectedNodeIds: (ids) => set({ selectedNodeIds: ids }),
  addSelectedNodeId: (id) => set((state) => ({ selectedNodeIds: [...state.selectedNodeIds, id] })),
  removeSelectedNodeId: (id) => set((state) => ({ selectedNodeIds: state.selectedNodeIds.filter((nodeId) => nodeId !== id) })),
  clearSelectedNodeIds: () => set({ selectedNodeIds: [] }),
}));
