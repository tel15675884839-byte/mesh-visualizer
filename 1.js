const fs = require('fs');
const path = require('path');

const clientPath = path.join(__dirname, 'apps', 'client', 'src');
const componentsPath = path.join(clientPath, 'components');
const storePath = path.join(clientPath, 'store');

console.log('🧹 Applying Fixes V19: Residual Edges, Missing Focus, Auto-Exit Delete...');

// 1. UPDATE useTopologyStore.ts (Deep Edge Cleanup)
try {
    const storeFilePath = path.join(storePath, 'useTopologyStore.ts');
    let storeCode = fs.readFileSync(storeFilePath, 'utf8');

    // Rewrite removeLoop to be more aggressive
    // We look for the removeLoop action definition
    const removeLoopRegex = /removeLoop:\s*\(loopId\)\s*=>\s*set\(\(state\)\s*=>\s*\{([\s\S]*?)\}\),/;
    
    const newRemoveLoopLogic = `removeLoop: (loopId) => set((state) => {
        // 1. Identify devices being removed
        const loopDevices = state.unassignedDevices.filter(d => d.loopId === loopId);
        const loopDeviceIds = new Set(loopDevices.map(d => d.mac));

        // 2. Filter Devices
        const remainingDevices = state.unassignedDevices.filter(d => d.loopId !== loopId);

        // 3. Filter Edges (Aggressive Cleanup)
        // Remove edge if it matches loopId OR if it connects to a removed device
        const remainingEdges = state.edges.filter(e => {
            if (e.loopId === loopId) return false;
            // Fallback for legacy edges without loopId: check endpoints
            const u = String(e.from ?? e.sourceId);
            const v = String(e.to ?? e.targetId);
            if (loopDeviceIds.has(u) || loopDeviceIds.has(v)) return false;
            return true;
        });

        return {
            activeLoopIds: state.activeLoopIds.filter(id => id !== loopId),
            unassignedDevices: remainingDevices,
            edges: remainingEdges,
        };
      }),`;

    if (removeLoopRegex.test(storeCode)) {
        storeCode = storeCode.replace(removeLoopRegex, newRemoveLoopLogic);
        fs.writeFileSync(storeFilePath, storeCode);
        console.log('✅ useTopologyStore.ts: Aggressive Edge Cleanup applied.');
    } else {
        console.warn('⚠️ Could not locate removeLoop in TopologyStore.');
    }

} catch (e) {
    console.error('❌ Error updating useTopologyStore.ts:', e);
}


// 2. UPDATE DeviceSidebar.tsx (Enable Eye for Missing)
try {
    const sidebarFilePath = path.join(componentsPath, 'DeviceSidebar.tsx');
    let sidebarCode = fs.readFileSync(sidebarFilePath, 'utf8');

    // We need to ensure the click handler on the row doesn't block the button.
    // In V18 we added logic, but let's refine the pointer-events.
    
    // Look for the TreeNode return JSX
    // specifically the main container div className logic
    // We want to ensure it's NOT "pointer-events-none" or "cursor-not-allowed" for the whole row IF we want buttons to work.
    // Actually, "cursor-not-allowed" is fine, but we must not stop events on children.
    
    // The previous TreeNode code for isMissing style:
    // ${isMissing ? 'bg-gray-50/50' : ''}
    
    // And the click handler:
    // onClick={(e) => { e.stopPropagation(); if (!isMissing) ... }} 
    
    // The button itself:
    // <button onClick={handleFocus} ... title={isMissing ? "Locate Missing Device" : ...}>
    
    // The issue might be that `isDeployed` check inside TreeNode needs to be robust for missing nodes.
    // Missing nodes are DEPLOYED (in SiteStore). 
    // Let's Force the Eye button to be clickable by stopping propagation explicitly on it (which is already there).
    
    // If user says it's not working, maybe the `isDeployed` check is failing?
    // isNodeDeployed checks if node exists in SiteStore.
    // If "Missing" means "Removed from Topology but still in SiteStore", isNodeDeployed should be TRUE.
    
    // Let's just make sure the Eye button Z-Index or placement is safe.
    // I will rewrite the TreeNode component one last time to be absolutely sure.
    
    const treeNodeRegex = /const TreeNode = \(\{[\s\S]*?^};/m;
    const newTreeNode = `const TreeNode = ({ node, selectedIds, toggleSelect, clearSelection, descriptionMap, forceDisabled }: any) => {
  const { isNodeDeployed, findNodeLocation, setActiveView } = useSiteStore();
  const [isExpanded, setIsExpanded] = useState(node.forceExpand ?? (node.role === 'LEADER'));
  const isDeployed = isNodeDeployed(node.mac);
  const isSelected = selectedIds.has(node.mac);
  
  // Status Flags
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
      e.stopPropagation(); // Critical: Stop row click event
      const loc = findNodeLocation(node.mac);
      if (loc) {
          setActiveView(loc.buildingId, loc.floorId);
          window.dispatchEvent(new CustomEvent('FOCUS_NODE', { detail: { x: loc.x, y: loc.y, id: node.mac } }));
      } else {
          // If not found (maybe phantom state), try to find by ID
          alert("Could not locate device on map.");
      }
  };

  const customName = descriptionMap ? descriptionMap[node.mac] : null;
  const displayName = customName || (node.mac ? node.mac.slice(-4) : node.id);

  return (
    <div className="flex flex-col select-none">
      <div 
        className={\`flex items-center py-1.5 pr-2 pl-0 rounded-r-md transition-colors group relative
            \${isSelected ? 'bg-indigo-50' : 'hover:bg-gray-100'} 
            \${(isDeployed && !isMissing) ? 'opacity-100' : ''} 
            \${(!isDeployed && !isMissing) ? 'cursor-grab active:cursor-grabbing' : ''}
            \${isNew ? 'bg-yellow-50 border-l-2 border-yellow-400' : ''}
            \${isMissing ? 'bg-gray-50/50' : ''} 
        \`}
        onClick={(e) => { 
            e.stopPropagation();
            if (!isMissing && !isDeployed) {
                if (e.ctrlKey || e.metaKey) toggleSelect(node);
                else {
                    if (selectedIds.size > 0) clearSelection();
                    setIsExpanded(!isExpanded);
                }
            } else {
                // Allow expand for Deployed/Missing
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
            <span className={\`ml-1 \${customName ? 'text-indigo-600 font-bold' : (isMissing ? 'text-gray-400 italic line-through' : 'text-gray-400')}\`}>
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
            {/* Z-Index to ensure clickable */}
            {isDeployed ? (
                <button 
                    onClick={handleFocus}
                    className={\`p-1 rounded-full transition-colors \${isMissing ? 'text-red-500 hover:text-red-700 hover:bg-red-100' : 'text-gray-400 hover:text-indigo-600 hover:bg-indigo-50'}\`}
                    title={isMissing ? "Locate Missing Device" : "Locate on Map"}
                >
                    <Eye size={14} />
                </button>
            ) : (
                !isMissing && (
                    <div className="mx-1 text-gray-400 hover:text-indigo-600 cursor-pointer p-1" onClick={(e) => { e.stopPropagation(); toggleSelect(node); }}>
                        {isSelected ? <CheckSquare size={16} className="text-indigo-600" /> : <Square size={16} />}
                    </div>
                )
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
};`;

    if (treeNodeRegex.test(sidebarCode)) {
        sidebarCode = sidebarCode.replace(treeNodeRegex, newTreeNode);
        fs.writeFileSync(sidebarFilePath, sidebarCode);
        console.log('✅ DeviceSidebar.tsx: Updated TreeNode to allow Focus on Missing.');
    }

} catch (e) {
    console.error('❌ Error updating DeviceSidebar.tsx:', e);
}


// 3. UPDATE FloorPlanEditor.tsx (Auto-Exit Delete Mode)
try {
    const editorFilePath = path.join(componentsPath, 'FloorPlanEditor.tsx');
    let editorCode = fs.readFileSync(editorFilePath, 'utf8');

    // 1. Box Selection MouseUp
    // Look for `setSelectionBox(null);` in `handleMouseUp`
    const mouseUpTarget = `if (nodesToRemove.length > 0 && confirm(\`Delete \${nodesToRemove.length} items?\`)) nodesToRemove.forEach(id => removeNodeFromFloor(activeFloor.id, id));
    setSelectionBox(null);`;
    
    const mouseUpReplace = `if (nodesToRemove.length > 0 && confirm(\`Delete \${nodesToRemove.length} items?\`)) nodesToRemove.forEach(id => removeNodeFromFloor(activeFloor.id, id));
    setSelectionBox(null);
    setIsDeleteMode(false); // AUTO-EXIT`;

    if (editorCode.includes('setSelectionBox(null);') && !editorCode.includes('setIsDeleteMode(false); // AUTO-EXIT')) {
        // We use string replacement for safety
        editorCode = editorCode.replace('setSelectionBox(null);', 'setSelectionBox(null); setIsDeleteMode(false); // AUTO-EXIT');
    }

    // 2. Single Node Click (Delete)
    // Look for `onRemove(activeFloor.id, node.id);` in Nodes component
    const nodeClickTarget = `onRemove(activeFloor.id, node.id);`;
    const nodeClickReplace = `onRemove(activeFloor.id, node.id); setIsDeleteMode(false);`; // We need access to setIsDeleteMode?
    
    // Wait, `Nodes` component receives `isDeleteMode` prop but NOT `setIsDeleteMode`.
    // It only receives `onRemove`.
    // To implement auto-exit on single click, we need to pass a callback or handle it in parent.
    
    // Easier: In `FloorPlanEditor`, the `Nodes` component is rendered. 
    // We can wrap the `onRemove` prop passed to Nodes.
    
    const onRemovePropRegex = /onRemove=\{removeNodeFromFloor\}/;
    const newOnRemoveProp = `onRemove={(fid: string, nid: string) => { removeNodeFromFloor(fid, nid); setIsDeleteMode(false); }}`;
    
    if (onRemovePropRegex.test(editorCode)) {
        editorCode = editorCode.replace(onRemovePropRegex, newOnRemoveProp);
        console.log('✅ FloorPlanEditor.tsx: Added Auto-Exit on Single Delete.');
    }
    
    // Also need to handle the box select one which is inside FloorPlanEditor main body
    // The first replacement above handled handleMouseUp (Box).

    fs.writeFileSync(editorFilePath, editorCode);
    console.log('✅ FloorPlanEditor.tsx: Added Auto-Exit on Batch Delete.');

} catch (e) {
    console.error('❌ Error updating FloorPlanEditor.tsx:', e);
}