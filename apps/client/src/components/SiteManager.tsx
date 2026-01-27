import { WindowModal } from './ui/WindowModal';

import React, { useState, useEffect, useRef } from 'react';
import { useSiteStore } from '../store/useSiteStore';
import { getImage } from '../utils/storage';
import { X, Plus, Trash2, Upload, Map, Building as BuildingIcon, Layers } from 'lucide-react';

interface SiteManagerProps {
  onClose: () => void;
}

export const SiteManager: React.FC<SiteManagerProps> = ({ onClose }) => {
  const { 
    buildings, 
    activeBuildingId, 
    activeFloorId,
    addBuilding, 
    removeBuilding,
    addFloor, 
    removeFloor,
    updateFloor, 
    setFloorMap,
    setActiveView 
  } = useSiteStore();

  const [selBuildingId, setSelBuildingId] = useState<string | null>(activeBuildingId);
  const [selFloorId, setSelFloorId] = useState<string | null>(activeFloorId);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (activeBuildingId) setSelBuildingId(activeBuildingId); }, [activeBuildingId]);
  useEffect(() => { if (activeFloorId) setSelFloorId(activeFloorId); }, [activeFloorId]);

  const selectedBuilding = buildings.find(b => b.id === selBuildingId);
  const selectedFloor = selectedBuilding?.floors.find(f => f.id === selFloorId);

  useEffect(() => {
    setPreviewUrl(null); 
    if (!selectedFloor?.mapId) return;

    let active = true;
    getImage(selectedFloor.mapId).then((blob) => {
      if (active && blob) {
        setPreviewUrl(URL.createObjectURL(blob));
      }
    });

    return () => {
      active = false;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [selectedFloor?.mapId]); 

  const handleAddBuilding = () => {
    const name = prompt("Enter Building Name:", `Building ${buildings.length + 1}`);
    if (name !== null) addBuilding(name || undefined);
  };

  const handleAddFloor = () => {
    if (!selBuildingId) return;
    const name = prompt("Enter Floor Name:", "1F");
    if (name !== null) addFloor(selBuildingId, name || undefined);
  };

  const triggerFileUpload = () => {
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
        fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && selBuildingId && selFloorId) {
      await setFloorMap(selBuildingId, selFloorId, e.target.files[0]);
    }
  };

  const handleDeleteFloor = () => {
      if(selBuildingId && selFloorId && confirm('Delete Floor?')) {
          removeFloor(selBuildingId, selFloorId);
          setSelFloorId(null);
      }
  };

  return (
    <WindowModal 
        title="Site Manager" 
        onClose={onClose} 
        icon={<Map size={18}/>} 
        initialWidth={960} 
        initialHeight={600}
    >
        <div className="flex flex-1 overflow-hidden">
          
          {/* Column 1: Buildings */}
          <div className="w-1/4 border-r border-gray-200 bg-gray-50 flex flex-col">
            <div className="p-3 border-b border-gray-200 flex justify-between items-center bg-gray-100/50">
              <span className="text-xs font-bold text-gray-500 uppercase">Buildings</span>
              <button onClick={handleAddBuilding} className="p-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors">
                <Plus size={14} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {buildings.map(b => (
                <div 
                  key={b.id}
                  onClick={() => { setSelBuildingId(b.id); setSelFloorId(null); }}
                  className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all border ${selBuildingId === b.id ? 'bg-white border-indigo-200 shadow-sm ring-1 ring-indigo-500/20' : 'bg-transparent border-transparent hover:bg-gray-200/50 hover:border-gray-200'}`}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <BuildingIcon size={16} className={`shrink-0 ${selBuildingId === b.id ? 'text-indigo-600' : 'text-gray-400'}`} />
                    <span className="text-sm font-medium text-gray-700 truncate">{b.name}</span>
                  </div>
                  {selBuildingId === b.id && (
                    <button onClick={(e) => { e.stopPropagation(); if(confirm('Delete Building?')) removeBuilding(b.id); }} className="text-gray-300 hover:text-red-500">
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Column 2: Floors */}
          <div className="w-1/4 border-r border-gray-200 bg-white flex flex-col">
            <div className="p-3 border-b border-gray-200 flex justify-between items-center bg-white">
              <span className="text-xs font-bold text-gray-500 uppercase">Floors</span>
              <button 
                onClick={handleAddFloor} 
                disabled={!selBuildingId}
                className="p-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                <Plus size={14} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {!selBuildingId ? <div className="text-center text-xs text-gray-300 py-10">Select a building</div> : 
               selectedBuilding?.floors.length === 0 ? <div className="text-center text-xs text-gray-400 py-8 italic">No floors added</div> : (
                selectedBuilding?.floors.slice().reverse().map(f => (
                  <div 
                    key={f.id}
                    onClick={() => setSelFloorId(f.id)}
                    className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all border ${selFloorId === f.id ? 'bg-indigo-50 border-indigo-200' : 'bg-gray-50 border-transparent hover:bg-gray-100'}`}
                  >
                    <div className="flex items-center gap-3">
                      <Layers size={16} className={`shrink-0 ${selFloorId === f.id ? 'text-indigo-600' : 'text-gray-400'}`} />
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-700">{f.name}</span>
                        <span className="text-[10px] text-gray-400">{f.height}cm</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Column 3: Details */}
          <div className="flex-1 bg-gray-50/30 flex flex-col">
             {!selFloorId || !selectedFloor ? (
               <div className="flex-1 flex flex-col items-center justify-center text-gray-300">
                 <Map size={48} className="mb-4 opacity-20" />
                 <p className="text-sm">Select a floor to edit details</p>
               </div>
             ) : (
               <div className="p-6 h-full flex flex-col">
                 <div className="flex items-center justify-between mb-6">
                   <h3 className="text-md font-bold text-gray-800">Floor Settings</h3>
                   <button 
                      onClick={handleDeleteFloor}
                      className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 px-3 py-1.5 rounded-md hover:bg-red-50 transition-colors"
                   >
                     <Trash2 size={12} /> Delete
                   </button>
                 </div>
                 
                 <div className="grid grid-cols-2 gap-4 mb-6">
                   <div className="space-y-1">
                     <label className="text-xs font-semibold text-gray-500">Name</label>
                     <input type="text" value={selectedFloor.name} onChange={(e) => updateFloor(selBuildingId!, selFloorId, { name: e.target.value })} className="w-full text-sm p-2 border border-gray-300 rounded" />
                   </div>
                   <div className="space-y-1">
                     <label className="text-xs font-semibold text-gray-500">Height (cm)</label>
                     <input type="number" value={selectedFloor.height} onChange={(e) => updateFloor(selBuildingId!, selFloorId, { height: Number(e.target.value) })} className="w-full text-sm p-2 border border-gray-300 rounded" />
                   </div>
                 </div>

                 <div className="space-y-2 flex-1">
                   <label className="text-xs font-semibold text-gray-500">Floor Plan</label>
                   <input 
                      ref={fileInputRef}
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={handleFileChange} 
                   />
                   <div 
                      onClick={triggerFileUpload}
                      className="relative group border-2 border-dashed border-gray-300 rounded-xl bg-white h-[200px] flex items-center justify-center overflow-hidden hover:border-indigo-400 transition-colors cursor-pointer"
                   >
                      {previewUrl ? (
                        <div className="relative w-full h-full flex items-center justify-center bg-gray-100">
                          <img src={previewUrl} alt="Plan" className="max-w-full max-h-[100%] object-contain" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-sm">Click to Replace</div>
                        </div>
                      ) : (
                        <div className="text-center p-6 text-gray-400">
                          <Upload size={32} className="mx-auto mb-2 opacity-50" />
                          <p className="text-sm">Click to Upload Image</p>
                        </div>
                      )}
                   </div>
                 </div>

                 {/* BUTTON MOVED TO BOTTOM */}
                 <div className="mt-auto pt-4 border-t border-gray-200">
                     <button 
                        onClick={() => { setActiveView(selBuildingId, selFloorId); onClose(); }}
                        className="w-full bg-indigo-600 text-white px-4 py-3 rounded-lg hover:bg-indigo-700 transition-colors font-semibold flex items-center justify-center gap-2"
                     >
                       <Map size={18} /> Open in Editor
                     </button>
                 </div>
               </div>
             )}
          </div>
        </div>
      
    </WindowModal>
  );
};
