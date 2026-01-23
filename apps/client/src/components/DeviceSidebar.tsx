
import React, { useMemo, useState, useRef } from 'react';
import { useTopologyStore } from '../store/useTopologyStore';
import { useSiteStore } from '../store/useSiteStore';
import { buildTopologyTree, filterTopologyNodes, validateMacConflicts } from '../utils/topologyTree';
import type { TopologyTreeNode, Device } from '../utils/topologyTree';
import { parseTopologyFile } from '../utils/fileParser';
import { ChevronRight, ChevronDown, Wifi, Signal, Search, Trash2, X, Plus, Upload, RefreshCw, Check, Play, Circle, Box as BoxIcon, Square, CheckSquare, AlertTriangle, Eye } from 'lucide-react';
import axios from 'axios';

// --- Tree Node ---
const TreeNode = ({ node, selectedIds, toggleSelect, clearSelection, descriptionMap, forceDisabled }: any) => {
  const { isNodeDeployed, findNodeLocation, setActiveView } = useSiteStore();
  const [isExpanded, setIsExpanded] = useState(node.forceExpand ?? (node.role === 'LEADER'));
  const isDeployed = isNodeDeployed(node.mac);
  const isSelected = selectedIds.has(node.mac);
  
  const isMissing = node.status === 'missing' || forceDisabled;
  const isNew = node.isNew && !isDeployed;

  React.useEffect(() => {
    if (node.forceExpand) setIsExpanded(true);
  }, [node.forceExpand]);

  const hasChildren = node.children && node.children.length > 0;

  const renderIcon = () => {
      if (node.role === 'LEADER') return <Circle size={10} className="fill-red-500 text-red-600" />;
      if (node.role === 'ROUTER') return <Circle size={10} className="fill-blue-500 text-blue-600" />;
      return <Circle size={10} className="fill-green-500 text-green-600" />;
  };

  const handleDragStart = (e: React.DragEvent) => {
    if (isDeployed || isMissing) { e.preventDefault(); return; }
    const effectivePayload = isSelected ? Array.from(selectedIds) : [node.mac];
    e.dataTransfer.setData('application/json', JSON.stringify({ ids: effectivePayload }));
  };

  const handleFocus = (e: React.MouseEvent) => {
      e.stopPropagation();
      const loc = findNodeLocation(node.mac);
      if (loc) {
          setActiveView(loc.buildingId, loc.floorId);
          window.dispatchEvent(new CustomEvent('FOCUS_NODE', { detail: { x: loc.x, y: loc.y, id: node.mac } }));
      } else {
          // If node is "missing" but we can't find it on map, it means it was deleted from map manually.
          // In that case, we can't focus.
          alert("Device location not found on map.");
      }
  };

  const customName = descriptionMap ? descriptionMap[node.mac] : null;
  const displayName = customName || (node.mac ? node.mac.slice(-4) : node.id);

  return (
    <div className="flex flex-col select-none">
      <div 
        className={`flex items-center py-1.5 pr-2 pl-0 rounded-r-md transition-colors group relative
            ${isSelected ? 'bg-indigo-50' : 'hover:bg-gray-100'} 
            ${(isDeployed || isMissing) ? 'opacity-100' : ''} 
            ${(!isDeployed && !isMissing) ? 'cursor-grab active:cursor-grabbing' : ''}
            ${isNew ? 'bg-yellow-50 border-l-2 border-yellow-400' : ''}
            ${isMissing ? 'bg-gray-50/50' : ''} 
        `}
        onClick={(e) => { 
            e.stopPropagation();
            if (!isMissing && !isDeployed) {
                if (e.ctrlKey || e.metaKey) toggleSelect(node);
                else {
                    if (selectedIds.size > 0) clearSelection();
                    setIsExpanded(!isExpanded);
                }
            } else {
                setIsExpanded(!isExpanded);
            }
        }}
        draggable={!isDeployed && !isMissing}
        onDragStart={handleDragStart}
      >
        <div className="w-6 flex justify-center shrink-0 text-gray-400 hover:text-gray-600" onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}>
          {hasChildren ? (
            isExpanded ? 
                <ChevronDown size={14} className={node.role === 'LEADER' ? 'text-red-500' : ''} /> : 
                <div className="flex items-center"><Play size={10} className="fill-gray-400 text-gray-400" /></div>
          ) : <span className="w-3" />}
        </div>

        <div className="mr-2 shrink-0 flex items-center justify-center">
            {renderIcon()}
        </div>

        <div className="flex flex-col truncate flex-1">
            <span className="text-xs font-mono font-medium text-gray-700 truncate group-hover:text-gray-900">
            {node.role === 'CHILD' ? 'Child' : (node.role === 'LEADER' ? 'Leader' : 'Router')} 
            <span className={`ml-1 ${customName ? 'text-indigo-600 font-bold' : (isMissing ? 'text-gray-400 italic line-through' : 'text-gray-400')}`}>
                ({displayName})
            </span>
            {isNew && <span className="ml-2 text-[8px] bg-yellow-400 text-white px-1 rounded font-bold shadow-sm">NEW</span>}
            </span>
        </div>

        {(node.role === 'ROUTER' || node.role === 'LEADER') && node.children.length > 0 && (
            <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 rounded mr-1">
                {node.children.length}
            </span>
        )}

        <div className="flex items-center gap-1 z-10"> 
            {/* Logic Update: Show Eye if Deployed OR Missing (since Missing nodes are still on map as ghosts) */}
            {(isDeployed || isMissing) ? (
                <button 
                    onClick={handleFocus}
                    className={`p-1 rounded-full transition-colors ${isMissing ? 'text-red-400 hover:text-red-600 hover:bg-red-50' : 'text-gray-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
                    title="Locate on Map"
                >
                    <Eye size={14} />
                </button>
            ) : (
                <div className="mx-1 text-gray-400 hover:text-indigo-600 cursor-pointer p-1" onClick={(e) => { e.stopPropagation(); toggleSelect(node); }}>
                    {isSelected ? <CheckSquare size={16} className="text-indigo-600" /> : <Square size={16} />}
                </div>
            )}
        </div>

        {node.uplinkRssi !== undefined && (
            <div className="ml-1 flex items-center gap-1 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">
                <Signal size={10} className="text-gray-400" />
                <span className="text-[10px] text-gray-500 font-mono">{node.uplinkRssi}</span>
            </div>
        )}
      </div>

      {isExpanded && hasChildren && (
        <div className="flex flex-col ml-3 pl-3 border-l border-gray-200/60">
          {node.children.map((child: any) => (
             <TreeNode 
                key={child.id} 
                node={child} 
                selectedIds={selectedIds}
                toggleSelect={toggleSelect}
                clearSelection={clearSelection}
                descriptionMap={descriptionMap}
                forceDisabled={forceDisabled}
             />
          ))}
        </div>
      )}
    </div>
  );
};

const LoopItem = ({ loopId, devices, edges, searchQuery, allDevices, onImport, selectedIds, onToggleSelect, onDeleteLoop, onClearSelect, descriptionMap }: any) => {
  const { setImportError, clearMissingNodes } = useTopologyStore();
  const { isNodeDeployed, removeNodesByDeviceIds, findNodeLocation, setActiveView } = useSiteStore();
  const [isExpanded, setIsExpanded] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeDevices = useMemo(() => devices.filter((d: any) => d.status !== 'missing'), [devices]);
  const missingDevices = useMemo(() => devices.filter((d: any) => d.status === 'missing'), [devices]);

  const deployedCount = activeDevices.filter((d: any) => isNodeDeployed(d.mac)).length;
  const remainingCount = activeDevices.length - deployedCount;

  const { roots, orphans } = useMemo(() => {
    const rawTree = buildTopologyTree(activeDevices, edges);
    const sortedRoots = rawTree.roots.sort((a, b) => {
        if (a.role === 'LEADER') return -1;
        if (b.role === 'LEADER') return 1;
        return a.mac.localeCompare(b.mac);
    });
    return {
      roots: filterTopologyNodes(sortedRoots, searchQuery, descriptionMap),
      orphans: filterTopologyNodes(rawTree.orphans, searchQuery, descriptionMap)
    };
  }, [activeDevices, edges, searchQuery, descriptionMap]);

  const handleMultiDragStart = (e: React.DragEvent) => {
      const ids = Array.from(selectedIds) as string[];
      if (ids.length > 0) {
        e.dataTransfer.setData('application/json', JSON.stringify({ ids }));
      }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
            const content = event.target?.result as string;
            const { devices: parsedDevices, edges: parsedEdges } = parseTopologyFile(content, file.name);
            if (parsedDevices.length === 0) throw new Error("No devices found.");
            const formattedDevices = parsedDevices.map(d => ({
                ...d,
                type: (d.role || d.type || 'CHILD').toUpperCase().includes('LEADER') ? 'LEADER' : 
                    (d.role || d.type || '').toUpperCase().includes('ROUTER') ? 'ROUTER' : 'CHILD',
                status: 'UNASSIGNED',
                loopId: loopId
            }));
            const conflictError = validateMacConflicts(allDevices, formattedDevices, loopId);
            if (conflictError) { alert(conflictError); return; }
            await axios.post('http://localhost:3000/api/topology/sync', { devices: formattedDevices, edges: parsedEdges }).catch(e=>{});
            onImport(loopId, formattedDevices, parsedEdges);
        } catch (err: any) {
            setImportError(err.message);
            alert(`Import Failed: ${err.message}`);
        } finally { if (fileInputRef.current) fileInputRef.current.value = ''; }
      };
      reader.readAsText(file);
  };

  const handleClearMissing = (e: React.MouseEvent) => {
      e.stopPropagation();
      if(confirm(`Delete ${missingDevices.length} missing devices?`)) {
          clearMissingNodes(loopId, (ids) => removeNodesByDeviceIds(ids));
      }
  };

  return (
    <div className="mb-4 border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm" draggable={selectedIds.size > 0}>
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 cursor-pointer hover:bg-gray-100" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-center gap-2">
           {isExpanded ? <ChevronDown size={14} className="text-gray-500" /> : <ChevronRight size={14} className="text-gray-500" />}
           <span className="font-semibold text-xs text-gray-700">LOOP {loopId}</span>
           <span className="text-[10px] text-gray-400 bg-white px-1.5 rounded border border-gray-200" title="Active Devices">
             {activeDevices.length}
           </span>
           {remainingCount > 0 && (
               <span className="text-[10px] text-white bg-indigo-500 px-1.5 rounded border border-indigo-600 font-medium">
                 {remainingCount} Left
               </span>
           )}
        </div>
        <div className="flex items-center gap-1">
           <button onClick={(e)=>{e.stopPropagation();fileInputRef.current?.click()}} className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"><Upload size={14}/></button>
           <button onClick={(e)=>{e.stopPropagation(); if(confirm('Delete Loop? Devices on map will be removed.')) onDeleteLoop(loopId); }} className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 size={14}/></button>
           <input ref={fileInputRef} type="file" className="hidden" accept=".json,.html" onChange={handleFileChange} />
        </div>
      </div>
      
      {isExpanded && (
        <div className="p-2 min-h-[40px]" onDragStart={handleMultiDragStart}>
          <div className="space-y-1">
             {roots.map((root: any) => (
                 <TreeNode key={root.id} node={root} selectedIds={selectedIds} toggleSelect={onToggleSelect} clearSelection={onClearSelect} descriptionMap={descriptionMap} />
             ))}
             
             {orphans.length > 0 && (
                <div className="mt-2 text-[10px] text-gray-400 font-bold px-1 uppercase tracking-wider border-t border-gray-100 pt-2">
                    Missing Devices
                </div>
             )}
             {orphans.map((orphan: any) => (
                 <TreeNode 
                    key={orphan.id} 
                    node={orphan} 
                    selectedIds={selectedIds} 
                    toggleSelect={onToggleSelect} 
                    clearSelection={onClearSelect} 
                    descriptionMap={descriptionMap}
                    forceDisabled={true}
                 />
             ))}

             {missingDevices.length > 0 && (
                 <div className="mt-4 pt-2 border-t border-gray-100 bg-red-50/30 -mx-2 px-2 pb-2">
                    <div className="flex items-center justify-between mb-2 mt-1">
                        <div className="flex items-center gap-1 text-[10px] font-bold text-red-400 uppercase">
                            <AlertTriangle size={10} />
                            Removed / Offline ({missingDevices.length})
                        </div>
                        <button 
                            onClick={handleClearMissing}
                            className="text-[10px] text-red-500 hover:text-red-700 hover:bg-red-100 px-1.5 py-0.5 rounded transition-colors"
                        >
                            Clear
                        </button>
                    </div>
                    <div className="space-y-1 opacity-70">
                        {missingDevices.map((d: any) => {
                             const customName = descriptionMap ? descriptionMap[d.mac] : null;
                             const displayName = customName || d.mac.slice(-4);
                             return (
                                <div key={d.mac} className="flex items-center justify-between px-1 py-1 text-xs text-gray-400 font-mono cursor-not-allowed border border-transparent hover:border-red-100 rounded group">
                                    <div className="flex items-center">
                                        <div className="w-4 flex justify-center"><Circle size={8} className="fill-gray-300 text-gray-400" /></div>
                                        <span className="line-through">{displayName}</span>
                                    </div>
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const loc = findNodeLocation(d.mac);
                                            if (loc) {
                                                setActiveView(loc.buildingId, loc.floorId);
                                                window.dispatchEvent(new CustomEvent('FOCUS_NODE', { detail: { x: loc.x, y: loc.y, id: d.mac } }));
                                            } else {
                                                alert("Ghost node not found on map.");
                                            }
                                        }}
                                        className="p-1 text-gray-400 hover:text-indigo-600 rounded-full hover:bg-indigo-50 transition-colors opacity-0 group-hover:opacity-100"
                                        title="Locate Missing Device"
                                    >
                                        <Eye size={12} />
                                    </button>
                                </div>
                             );
                        })}
                    </div>
                 </div>
             )}
          </div>
        </div>
      )}
    </div>
  );
};

// --- NEW: Add Loop Modal ---
const AddLoopModal = ({ activeIds, onAdd, onClose }: any) => {
    const [val, setVal] = useState('');
    const [error, setError] = useState<string|null>(null);

    const handleSubmit = () => {
        const id = parseInt(val);
        if (isNaN(id)) { setError('Please enter a number'); return; }
        if (id < 1 || id > 24) { setError('Loop ID must be between 1 and 24'); return; }
        if (activeIds.includes(id)) { setError('Loop ID already exists'); return; }
        onAdd(id);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-80 animate-in fade-in zoom-in duration-200">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Add New Loop</h3>
                <div className="space-y-3">
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">Loop ID (1-24)</label>
                        <input 
                            autoFocus
                            type="number" 
                            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            placeholder="e.g. 1"
                            value={val}
                            onChange={(e) => { setVal(e.target.value); setError(null); }}
                            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                        />
                        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <button onClick={onClose} className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
                        <button onClick={handleSubmit} className="px-3 py-2 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700">Confirm</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const DeviceSidebar = () => {
  const { unassignedDevices, edges, activeLoopIds, addLoop, importLoopData, clearAll, removeLoop, selectedDeviceIds, setBulkSelection, clearDeviceSelection } = useTopologyStore();
  const { removeNodesByDeviceIds, getAllNodeDescriptions } = useSiteStore();
  const descriptionMap = getAllNodeDescriptions();
  
  const [searchQuery, setSearchQuery] = useState('');
  // Replaced inline state with modal state
  const [showAddModal, setShowAddModal] = useState(false);
  
  const selectedSet = new Set(selectedDeviceIds);

  const toggleSelect = (node: any) => {
      const idsToToggle = [node.mac];
      if (node.children && node.children.length > 0) {
          node.children.forEach((c: any) => idsToToggle.push(c.mac));
      }
      const isCurrentlySelected = selectedSet.has(node.mac);
      const targetState = !isCurrentlySelected;
      setBulkSelection(idsToToggle, targetState);
  };

  const handleDeleteLoop = (loopId: number) => {
      const devicesToDelete = unassignedDevices.filter(d => d.loopId === loopId).map(d => d.mac);
      removeNodesByDeviceIds(devicesToDelete);
      removeLoop(loopId);
  };

  const handleImportLoop = (loopId: number, devices: any[], edges: any[]) => {
      importLoopData(loopId, devices, edges, (droppedIds) => {
          removeNodesByDeviceIds(droppedIds);
      });
  };

  const handleBgClick = (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) clearDeviceSelection();
  };

  return (
    <>
        <div className="w-full h-full flex flex-col bg-white overflow-hidden" onClick={handleBgClick}>
        <div className="shrink-0 border-b border-gray-200 bg-white z-10 px-4 py-3">
            <div className="flex items-center justify-between mb-2">
                <h2 className="font-semibold text-gray-800 flex items-center gap-2"><Wifi size={18} className="text-indigo-600"/>Loops</h2>
                <div className="flex gap-1">
                    <button 
                        onClick={() => setShowAddModal(true)} 
                        disabled={activeLoopIds.length>=24} 
                        className="flex items-center gap-1 px-2 py-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700 disabled:opacity-50"
                    >
                        <Plus size={14}/> Add Loop
                    </button>
                    <button onClick={()=>confirm('Clear?')&&clearAll()} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 size={16}/></button>
                </div>
            </div>
            <div className="relative">
                <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400"/>
                <input type="text" placeholder="Search..." className="w-full pl-8 py-1.5 text-xs border rounded" value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}/>
            </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 custom-scrollbar bg-gray-50/30">
            {activeLoopIds.map(loopId => (
                <LoopItem 
                    key={loopId} 
                    loopId={loopId} 
                    devices={unassignedDevices.filter(d=>d.loopId===loopId)} 
                    edges={edges} 
                    allDevices={unassignedDevices} 
                    searchQuery={searchQuery} 
                    onImport={handleImportLoop} 
                    selectedIds={selectedSet}
                    onToggleSelect={toggleSelect}
                    onDeleteLoop={handleDeleteLoop}
                    onClearSelect={clearDeviceSelection}
                    descriptionMap={descriptionMap}
                />
            ))}
        </div>
        </div>

        {/* Modal Portal */}
        {showAddModal && (
            <AddLoopModal 
                activeIds={activeLoopIds} 
                onAdd={addLoop} 
                onClose={() => setShowAddModal(false)} 
            />
        )}
    </>
  );
};
