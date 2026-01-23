
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { saveImage } from '../utils/storage';
import { v4 as uuidv4 } from 'uuid';

export interface NodePosition { 
  id: string; 
  x: number; 
  y: number; 
  description?: string; 
}

export interface Floor {
  id: string; name: string; levelIndex: number; height: number;
  mapId?: string; width?: number; heightPx?: number; scaleRatio: number;
  nodes: NodePosition[];
}
export interface Building { id: string; name: string; floors: Floor[]; }

interface SiteStore {
  buildings: Building[];
  activeBuildingId: string | null;
  activeFloorId: string | null;
  nodeScale: number;
  baseFontSize: number; // NEW: Font Size State
  viewState: { x: number; y: number; scale: number };

  addBuilding: (name?: string) => void;
  removeBuilding: (buildingId: string) => void;
  addFloor: (buildingId: string, name?: string) => void;
  removeFloor: (buildingId: string, floorId: string) => void;
  updateFloor: (buildingId: string, floorId: string, data: Partial<Floor>) => void;
  setFloorMap: (buildingId: string, floorId: string, file: File) => Promise<void>;
  
  updateNodePosition: (floorId: string, nodeId: string, x: number, y: number) => void;
  updateNodeDescription: (floorId: string, nodeId: string, description: string) => void;
  removeNodeFromFloor: (floorId: string, nodeId: string) => void;
  removeNodesByDeviceIds: (nodeIds: string[]) => void;
  
  isNodeDeployed: (nodeId: string) => boolean;
  setActiveView: (buildingId: string | null, floorId: string | null) => void;
  setNodeScale: (scale: number) => void;
  setBaseFontSize: (size: number) => void; // NEW Action
  setViewState: (x: number, y: number, scale: number) => void;
  getActiveFloor: () => Floor | undefined;
  findNodeDescription: (nodeId: string) => string | undefined;
  getAllNodeDescriptions: () => Record<string, string>;
  
  reset: () => void;
  loadState: (state: any) => void;
}

export const useSiteStore = create<SiteStore>()(
  persist(
    (set, get) => ({
      buildings: [],
      activeBuildingId: null,
      activeFloorId: null,
      nodeScale: 1.0,
      baseFontSize: 14, // Default 14px
      viewState: { x: 0, y: 0, scale: 1 },

      addBuilding: (name) => set((state) => {
        const newId = uuidv4();
        return {
          buildings: [...state.buildings, { id: newId, name: name || `Building ${state.buildings.length + 1}`, floors: [] }],
          activeBuildingId: newId,
          activeFloorId: null,
          viewState: { x: 0, y: 0, scale: 1 }
        };
      }),

      removeBuilding: (bid) => set(s => ({ buildings: s.buildings.filter(b => b.id !== bid), activeBuildingId: s.activeBuildingId === bid ? null : s.activeBuildingId })),
      
      addFloor: (bid, name) => set(s => {
        const bIdx = s.buildings.findIndex(b => b.id === bid);
        if(bIdx === -1) return s;
        const b = s.buildings[bIdx];
        let nextLvl = 0; if(b.floors.length) nextLvl = Math.max(...b.floors.map(f => f.levelIndex)) + 1;
        const fName = `${nextLvl + 1}F`; 
        const newF: Floor = { id: uuidv4(), name: name || fName, levelIndex: nextLvl, height: 300, scaleRatio: 1.0, nodes:[] };
        const newBs = [...s.buildings];
        newBs[bIdx] = { ...b, floors: [...b.floors, newF] };
        return { buildings: newBs, activeBuildingId: bid, activeFloorId: newF.id, viewState: { x: 0, y: 0, scale: 1 } };
      }),

      removeFloor: (bid, fid) => set(s => {
        const newBs = s.buildings.map(b => (b.id !== bid ? b : { ...b, floors: b.floors.filter(f => f.id !== fid) }));
        return { buildings: newBs, activeFloorId: s.activeFloorId === fid ? null : s.activeFloorId };
      }),

      updateFloor: (bid, fid, data) => set(s => ({
        buildings: s.buildings.map(b => (b.id !== bid ? b : { ...b, floors: b.floors.map(f => f.id === fid ? { ...f, ...data } : f) }))
      })),

      setFloorMap: async (bid, fid, file) => {
        if (!bid || !fid) return;
        let w=0, h=0; 
        try { const bmp = await createImageBitmap(file); w=bmp.width; h=bmp.height; bmp.close(); } catch(e){}
        const mapId = uuidv4();
        await saveImage(mapId, file);
        set(s => ({
          buildings: s.buildings.map(b => (b.id !== bid ? b : { ...b, floors: b.floors.map(f => f.id !== fid ? f : { ...f, mapId, width: w, heightPx: h }) }))
        }));
      },

      updateNodePosition: (fid, nid, x, y) => set(s => ({
        buildings: s.buildings.map(b => ({ ...b, floors: b.floors.map(f => {
            if(f.id !== fid) return f;
            const idx = f.nodes.findIndex(n => n.id === nid);
            const newN = [...f.nodes];
            if(idx > -1) newN[idx] = { ...newN[idx], x, y };
            else newN.push({ id: nid, x, y });
            return { ...f, nodes: newN };
        })}))
      })),

      updateNodeDescription: (fid, nid, description) => set(s => ({
        buildings: s.buildings.map(b => ({ ...b, floors: b.floors.map(f => {
            if(f.id !== fid) return f;
            const idx = f.nodes.findIndex(n => n.id === nid);
            if (idx === -1) return f;
            const newN = [...f.nodes];
            newN[idx] = { ...newN[idx], description };
            return { ...f, nodes: newN };
        })}))
      })),

      removeNodeFromFloor: (fid, nid) => set(s => ({
        buildings: s.buildings.map(b => ({ ...b, floors: b.floors.map(f => f.id !== fid ? f : { ...f, nodes: f.nodes.filter(n => n.id !== nid) }) }))
      })),

      removeNodesByDeviceIds: (nodeIds) => set(s => {
        if (nodeIds.length === 0) return s;
        const idSet = new Set(nodeIds);
        const newBuildings = s.buildings.map(b => ({
            ...b,
            floors: b.floors.map(f => ({
                ...f,
                nodes: f.nodes.filter(n => !idSet.has(n.id))
            }))
        }));
        return { buildings: newBuildings };
      }),

      isNodeDeployed: (nid) => get().buildings.some(b => b.floors.some(f => f.nodes.some(n => n.id === nid))),
      setActiveView: (bid, fid) => set({ activeBuildingId: bid, activeFloorId: fid, viewState: { x: 0, y: 0, scale: 1 } }),
      setNodeScale: (sc) => set({ nodeScale: sc }),
      setBaseFontSize: (sz) => set({ baseFontSize: sz }), // Setter
      setViewState: (x, y, scale) => set({ viewState: { x, y, scale } }),
      getActiveFloor: () => {
        const s = get();
        if(!s.activeBuildingId || !s.activeFloorId) return undefined;
        return s.buildings.find(b => b.id === s.activeBuildingId)?.floors.find(f => f.id === s.activeFloorId);
      },
      getAllNodeDescriptions: () => {
          const map: Record<string, string> = {};
          const { buildings } = get();
          buildings.forEach(b => {
              b.floors.forEach(f => {
                  f.nodes.forEach(n => {
                      if (n.description) map[n.id] = n.description;
                  });
              });
          });
          return map;
      },
      findNodeDescription: (nodeId) => {
        const { buildings } = get();
        for (const b of buildings) {
          for (const f of b.floors) {
            const node = f.nodes.find((n) => n.id === nodeId);
            if (node && node.description) return node.description;
          }
        }
        return undefined;
      },

      reset: () => set({ buildings: [], activeBuildingId: null, activeFloorId: null, nodeScale: 1.0, baseFontSize: 14, viewState: { x:0, y:0, scale:1 } }),
      loadState: (state) => set({ 
        buildings: state.buildings || [], 
        activeBuildingId: state.activeBuildingId || null, 
        activeFloorId: state.activeFloorId || null,
        nodeScale: state.nodeScale || 1.0,
        baseFontSize: state.baseFontSize || 14,
        viewState: state.viewState || { x: 0, y: 0, scale: 1 }
      }),
    }),
    {
      name: 'mesh-site-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ 
          buildings: state.buildings, 
          activeBuildingId: state.activeBuildingId, 
          activeFloorId: state.activeFloorId, 
          nodeScale: state.nodeScale, 
          baseFontSize: state.baseFontSize, // Persist Font Size
          viewState: state.viewState 
      }),
    }
  )
);
