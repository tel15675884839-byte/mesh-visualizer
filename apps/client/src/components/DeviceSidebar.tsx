
import React, { useMemo, useState, useRef } from 'react';
import { useTopologyStore } from '../store/useTopologyStore';
import { useSiteStore } from '../store/useSiteStore';
import { buildTopologyTree, filterTopologyNodes, validateMacConflicts } from '../utils/topologyTree';
import type { TopologyTreeNode, Device } from '../utils/topologyTree';
import { parseTopologyFile } from '../utils/fileParser';
import { ChevronRight, ChevronDown, Wifi, Signal, Search, Trash2, X, Plus, Upload, RefreshCw, Check, Play, Circle, Square, CheckSquare, AlertTriangle, PenTool } from 'lucide-react';
import axios from 'axios';

// --- Tree Node ---
const TreeNode = ({ node, selectedIds, toggleSelect, clearSelection, descriptionMap }: any) => {
  const { isNodeDeployed } = useSiteStore();
  const [isExpanded, setIsExpanded] = useState(node.forceExpand ?? (node.role === 'LEADER'));
  const isDeployed = isNodeDeployed(node.mac);
  const isSelected = selectedIds.has(node.mac);
  
  // Resolve Display Name: Description > MAC
  const customName = descriptionMap[node.mac];
  const displayName = customName ? customName : node.mac.slice(-4);

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
    if (isDeployed) { e.preventDefault(); return; }
    const effectivePayload = isSelected ? Array.from(selectedIds) : [node.mac];
    e.dataTransfer.setData('application/json', JSON.stringify({ ids: effectivePayload }));
  };

  return (
    <div className="flex flex-col select-none">
      <div 
        className={`flex items-center py-1.5 pr-2 pl-0 rounded-r-md transition-colors group 
            ${isSelected ? 'bg-indigo-50' : 'hover:bg-gray-100'} 
            ${isDeployed ? 'opacity-50 grayscale cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'}
        `}
        onClick={(e) => { 
            e.stopPropagation(); 
            setIsExpanded(!isExpanded);
        }}
        draggable={!isDeployed}
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
            <span className={`ml-1 ${customName ? 'text-indigo-600 font-bold' : 'text-gray-400'}`}>
                {displayName}
            </span>
            </span>
        </div>

        {(node.role === 'ROUTER' || node.role === 'LEADER') && node.children.length > 0 && (
            <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 rounded mr-1">
                {node.children.length}
            </span>
        )}

        {!isDeployed && (
            <div 
                className="mx-1 text-gray-400 hover:text-indigo-600 cursor-pointer p-1"
                onClick={(e) => {
                    e.stopPropagation();
                    toggleSelect(node);
                }}
            >
                {isSelected ? <CheckSquare size={16} className="text-indigo-600" /> : <Square size={16} />}
            </div>
        )}

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
                descriptionMap={descriptionMap} // Pass down
             />
          ))}
        </div>
      )}
    </div>
  );
};

const LoopItem = ({ loopId, devices, edges, searchQuery, allDevices, onImport, selectedIds, onToggleSelect, onDeleteLoop, descriptionMap }: any) => {
  const { setImportError, clearMissingNodes } = useTopologyStore();
  const { isNodeDeployed, removeNodesByDeviceIds } = useSiteStore();
  const [isExpanded, setIsExpanded] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeDevices = useMemo(() => devices.filter((d: any) => d.status !== 'missing'), [devices]);
  const missingDevices = useMemo(() => devices.filter((d: any) => d.status === 'missing'), [devices]);

  const deployedCount = devices.filter((d: any) => isNodeDeployed(d.mac) && d.status !== 'missing').length;
  const remainingCount = activeDevices.length - deployedCount;

  const { roots, orphans } = useMemo(() => {
    const rawTree = buildTopologyTree(activeDevices, edges);
    const sortedRoots = rawTree.roots.sort((a, b) => {
        if (a.role === 'LEADER') return -1;
        if (b.role === 'LEADER') return 1;
        return a.mac.localeCompare(b.mac);
    });
    return {
      roots: filterTopologyNodes(sortedRoots, searchQuery),
      orphans: filterTopologyNodes(rawTree.orphans, searchQuery)
    };
  }, [activeDevices, edges, searchQuery]);

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
           <span className="text-[10px] text-gray-400 bg-white px-1.5 rounded border border-gray-200" title="Total Active">
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
           <button onClick={(e)=>{e.stopPropagation(); if(confirm('Delete Loop?')) onDeleteLoop(loopId); }} className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 size={14}/></button>
           <input ref={fileInputRef} type="file" className="hidden" accept=".json,.html" onChange={handleFileChange} />
        </div>
      </div>
      
      {isExpanded && (
        <div className="p-2 min-h-[40px]" onDragStart={handleMultiDragStart}>
          <div className="space-y-1">
             {roots.map((root: any) => (
                 <TreeNode key={root.id} node={root} selectedIds={selectedIds} toggleSelect={onToggleSelect} descriptionMap={descriptionMap} />
             ))}
             {orphans.length > 0 && <div className="mt-2 text-[10px] text-amber-500 font-bold px-1">UNLINKED</div>}
             {orphans.map((orphan: any) => (
                 <TreeNode key={orphan.id} node={orphan} selectedIds={selectedIds} toggleSelect={onToggleSelect} descriptionMap={descriptionMap} />
             ))}

             {missingDevices.length > 0 && (
                 <div className="mt-4 pt-2 border-t border-gray-100 bg-red-50/30 -mx-2 px-2 pb-2">
                    <div className="flex items-center justify-between mb-2 mt-1">
                        <div className="flex items-center gap-1 text-[10px] font-bold text-red-400 uppercase">
                            <AlertTriangle size={10} />
                            Missing / Offline ({missingDevices.length})
                        </div>
                        <button onClick={handleClearMissing} className="text-[10px] text-red-500 hover:text-red-700 hover:bg-red-100 px-1.5 py-0.5 rounded transition-colors">Clear</button>
                    </div>
                    <div className="space-y-1 opacity-70">
                        {missingDevices.map((d: any) => (
                            <div key={d.mac} className="flex items-center px-1 py-0.5 text-xs text-gray-400 font-mono">
                                <span className="w-2 h-2 rounded-full bg-gray-300 mr-2"></span>
                                {d.mac.slice(-4)} 
                                <span className="ml-2 text-[10px] italic">(Offline)</span>
                            </div>
                        ))}
                    </div>
                 </div>
             )}
          </div>
        </div>
      )}
    </div>
  );
};

const AddLoopInput = ({ activeIds, onAdd, onCancel }: any) => {
    const [val, setVal] = useState('');
    const [error, setError] = useState<string|null>(null);
    const handleSubmit = () => {
        const id = parseInt(val);
        if (isNaN(id) || id < 1 || id > 24) { setError('1-24'); return; }
        if (activeIds.includes(id)) { setError('Exists'); return; }
        onAdd(id); setVal(''); onCancel();
    };
    return (
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded">
            <input autoFocus type="number" className="w-12 px-1 py-0.5 text-xs border rounded" value={val} onChange={e=>setVal(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleSubmit()} />
            <button onClick={handleSubmit} className="text-green-600"><Check size={14}/></button>
            <button onClick={onCancel} className="text-gray-500"><X size={14}/></button>
        </div>
    );
};

export const DeviceSidebar = () => {
  const { unassignedDevices, edges, activeLoopIds, addLoop, importLoopData, clearAll, removeLoop, selectedDeviceIds, setBulkSelection, clearDeviceSelection } = useTopologyStore();
  const { removeNodesByDeviceIds, getAllNodeDescriptions, buildings } = useSiteStore(); // Import Selector
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddingLoop, setIsAddingLoop] = useState(false);
  
  const selectedSet = new Set(selectedDeviceIds);
  
  // Subscribe to descriptions directly. 
  // Note: For large apps, we might use a selector with equality check, but here simple fetch is okay.
  // We need this to update when SiteStore updates (e.g. description changed in editor).
  const descriptionMap = getAllNodeDescriptions();

  const toggleSelect = (node: any) => {
      const idsToToggle = [node.mac];
      if (node.children && node.children.length > 0) {
          node.children.forEach((c: any) => idsToToggle.push(c.mac));
      }
      const isCurrentlySelected = selectedSet.has(node.mac);
      const targetState = !isCurrentlySelected;
      setBulkSelection(idsToToggle, targetState);
  };

  const clearSelection = () => {
      setSelectedIds(new Set());
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
    <div className="w-full h-full flex flex-col bg-white overflow-hidden" onClick={handleBgClick}>
      <div className="shrink-0 border-b border-gray-200 bg-white z-10 px-4 py-3">
        <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2"><Wifi size={18} className="text-indigo-600"/>Loops</h2>
            <div className="flex gap-1">
              {isAddingLoop ? <AddLoopInput activeIds={activeLoopIds} onAdd={addLoop} onCancel={()=>setIsAddingLoop(false)} /> : 
                <>
                <button onClick={()=>setIsAddingLoop(true)} disabled={activeLoopIds.length>=24} className="flex items-center gap-1 px-2 py-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700 disabled:opacity-50"><Plus size={14}/> Add Loop</button>
                <button onClick={()=>confirm('Clear?')&&clearAll()} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 size={16}/></button>
                </>
              }
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
                descriptionMap={descriptionMap} // Pass down map
             />
        ))}
      </div>
    </div>
  );
};
