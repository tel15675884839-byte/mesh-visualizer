import { useSiteStore } from './useSiteStore';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface TopologyStore {
  unassignedDevices: any[]; 
  edges: any[];
  activeLoopIds: number[]; 
  importError: string | null;
  highlightedId: string | null;
  selectedDeviceIds: string[]; 

  setUnassignedDevices: (devices: any[]) => void;
  setEdges: (edges: any[]) => void;
  setImportError: (error: string | null) => void;
  setHighlightedId: (id: string | null) => void;
  setTopologyData: (devices: any[], edges: any[]) => void;
  
  addLoop: (id: number) => void;
  removeLoop: (loopId: number) => void;
  
  // Updated for Diff System
  importLoopData: (
      loopId: number, 
      newDevices: any[], 
      newEdges: any[], 
      onRemoveNodes?: (ids: string[]) => void
  ) => void;
  
  // New Action to explicitly clear missing nodes
  clearMissingNodes: (loopId: number, onRemoveNodes: (ids: string[]) => void) => void;
  
  clearAll: () => void;
  removeNodesById: (ids: string[]) => void;
  reset: () => void;
  toggleDeviceSelection: (id: string, multi: boolean) => void;
  setBulkSelection: (ids: string[], isSelected: boolean) => void;
  clearDeviceSelection: () => void;
}

export const useTopologyStore = create<TopologyStore>()(
  persist(
    (set, get) => ({
      unassignedDevices: [],
      edges: [],
      activeLoopIds: [],
      importError: null,
      highlightedId: null,
      selectedDeviceIds: [], 

      setUnassignedDevices: (devices) => set({ unassignedDevices: devices }),
      setEdges: (edges) => set({ edges }),
      setImportError: (error) => set({ importError: error }),
      setHighlightedId: (id) => set({ highlightedId: id }),

      setTopologyData: (devices, edges) => set({ unassignedDevices: devices, edges: edges, importError: null }),

      addLoop: (id) => set((state) => {
        if (state.activeLoopIds.includes(id)) return state;
        if (state.activeLoopIds.length >= 24) return state;
        return { activeLoopIds: [...state.activeLoopIds, id].sort((a, b) => a - b) };
      }),

      removeLoop: (loopId) => {
        const state = get();
        // 1. Identify devices to remove
        const devicesToRemove = state.unassignedDevices.filter(d => d.loopId === loopId);
        const deviceIds = devicesToRemove.map(d => d.mac);

        // 2. Remove from Site Store (Map)
        // Access via static method to avoid hook rules in vanilla JS action
        useSiteStore.getState().removeNodesByDeviceIds(deviceIds);

        // 3. Remove from Topology
        set((state) => ({
          activeLoopIds: state.activeLoopIds.filter(id => id !== loopId),
          unassignedDevices: state.unassignedDevices.filter(d => d.loopId !== loopId),
          edges: state.edges.filter(e => e.loopId !== loopId),
        }));
      },

      // DIFF ALGORITHM IMPLEMENTATION
      importLoopData: (loopId, newDevices, newEdges, onRemoveNodes) => set((state) => {
        const oldLoopDevices = state.unassignedDevices.filter(d => d.loopId === loopId);
        const otherLoopDevices = state.unassignedDevices.filter(d => d.loopId !== loopId);
        
        const oldMacs = new Set(oldLoopDevices.map(d => d.mac));
        const newMacs = new Set(newDevices.map(d => d.mac));
        
        // Identify Dropped (Ghost Mode candidates)
        const droppedMacs = oldLoopDevices.filter(d => !newMacs.has(d.mac)).map(d => d.mac);
        if (droppedMacs.length > 0 && onRemoveNodes) onRemoveNodes(droppedMacs);

        // Identify Missing (Keep them, mark as missing)
        const missingDevices = oldLoopDevices
            .filter(d => !newMacs.has(d.mac))
            .map(d => ({ ...d, status: 'missing' }));

        // Process New/Updated Devices
        const processedNewDevices = newDevices.map(d => ({
            ...d,
            loopId,
            isNew: !oldMacs.has(d.mac), // Tag as new if not in old set
            status: 'active'
        }));

        const otherEdges = state.edges.filter(e => e.loopId !== loopId);
        const taggedEdges = newEdges.map(e => ({ ...e, loopId }));

        return {
          unassignedDevices: [...otherLoopDevices, ...processedNewDevices, ...missingDevices],
          edges: [...otherEdges, ...taggedEdges],
          importError: null
        };
      }),

      // Action to manually clear missing nodes
      clearMissingNodes: (loopId, onRemoveNodes) => set((state) => {
        const loopDevices = state.unassignedDevices.filter(d => d.loopId === loopId);
        const missingNodes = loopDevices.filter(d => d.status === 'missing');
        
        if (missingNodes.length > 0) {
            const idsToRemove = missingNodes.map(d => d.mac);
            // Trigger Cascade Delete in SiteStore
            onRemoveNodes(idsToRemove);
            
            // Remove from Topology
            const remainingDevices = state.unassignedDevices.filter(d => !idsToRemove.includes(d.mac));
            return { unassignedDevices: remainingDevices };
        }
        return state;
      }),

      clearAll: () => set({ unassignedDevices: [], edges: [], activeLoopIds: [], importError: null, selectedDeviceIds: [] }),

      removeNodesById: (ids) => set((state) => ({
        unassignedDevices: state.unassignedDevices.filter(d => !ids.includes(d.mac || d.id))
      })),

      reset: () => set({ unassignedDevices: [], edges: [], activeLoopIds: [], importError: null, highlightedId: null, selectedDeviceIds: [] }),

      toggleDeviceSelection: (id, multi) => set((state) => {
        const current = new Set(state.selectedDeviceIds);
        if (current.has(id)) current.delete(id);
        else current.add(id);
        return { selectedDeviceIds: Array.from(current) };
      }),

      setBulkSelection: (ids, isSelected) => set((state) => {
        const current = new Set(state.selectedDeviceIds);
        ids.forEach(id => {
            if (isSelected) current.add(id);
            else current.delete(id);
        });
        return { selectedDeviceIds: Array.from(current) };
      }),

      clearDeviceSelection: () => set({ selectedDeviceIds: [] }),
    }),
    {
        name: 'mesh-topology-storage',
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
            unassignedDevices: state.unassignedDevices,
            edges: state.edges,
            activeLoopIds: state.activeLoopIds
        })
    }
  )
);
