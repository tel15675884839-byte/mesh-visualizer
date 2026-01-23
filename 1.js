const fs = require('fs');
const path = require('path');

const clientPath = path.join(__dirname, 'apps', 'client', 'src');
const storePath = path.join(clientPath, 'store', 'useTopologyStore.ts');
const siteStorePath = path.join(clientPath, 'store', 'useSiteStore.ts');
const sidebarPath = path.join(clientPath, 'components', 'DeviceSidebar.tsx');

console.log('🔄 Applying Loop Cascade Fixes & UX Enhancements...');

// --- HELPER: Regex Replacement ---
function replaceFunction(content, funcName, newImpl) {
    const regex = new RegExp(`${funcName}:\\s*\\([\\s\\S]*?\\)\\s*=>\\s*set\\(\\(state\\)\\s*=>\\s*\\{([\\s\\S]*?)\\}\\),`, 'm');
    if (regex.test(content)) {
        return content.replace(regex, newImpl);
    }
    // Fallback for different formatting (e.g. one-liners or different args)
    // Trying a broader match for the function key
    const broadRegex = new RegExp(`${funcName}:\\s*\\(.*?\\)\\s*=>\\s*([\\s\\S]*?),\\n`, 'm');
    if (broadRegex.test(content)) {
        return content.replace(broadRegex, newImpl);
    }
    console.warn(`⚠️ Could not locate function "${funcName}" to replace.`);
    return content;
}

// --- 1. UPDATE useTopologyStore.ts ---
try {
    let content = fs.readFileSync(storePath, 'utf8');

    // 1.1 Add Import if missing
    if (!content.includes(`import { useSiteStore }`)) {
        content = `import { useSiteStore } from './useSiteStore';\n` + content;
    }

    // 1.2 Rewrite removeLoop (Cascade Delete)
    const newRemoveLoop = `removeLoop: (loopId) => {
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
      },`;
    
    // We use a specific replacer because the standard one expects 'set((state)...' structure
    // This action has a body before set, so we replace the key entirely.
    // Regex to find "removeLoop: (loopId) => set(..." block
    const removeLoopRegex = /removeLoop:\s*\(loopId\)\s*=>\s*set\(\(state\)\s*=>\s*\(\{[\s\S]*?\}\)\),/m;
    if (removeLoopRegex.test(content)) {
        content = content.replace(removeLoopRegex, newRemoveLoop);
    } else {
        // Try matching the previous simple implementation
        const altRegex = /removeLoop:\s*\(loopId\)\s*=>\s*set\(\(state\)\s*=>\s*[\s\S]*?\}\)\),/m;
        if(altRegex.test(content)) {
             content = content.replace(altRegex, newRemoveLoop);
        }
    }

    // 1.3 Rewrite importLoopData (Tag New Devices)
    const newImportLoopData = `importLoopData: (loopId, newDevices, newEdges, onRemoveNodes) => set((state) => {
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
      }),`;

    const importRegex = /importLoopData:\s*\(loopId,\s*newDevices,\s*newEdges,\s*onRemoveNodes\)\s*=>\s*set\(\(state\)\s*=>\s*\{[\s\S]*?\}\),/m;
    if (importRegex.test(content)) {
        content = content.replace(importRegex, newImportLoopData);
    }

    fs.writeFileSync(storePath, content);
    console.log('✅ useTopologyStore.ts updated.');

} catch (e) {
    console.error('❌ Error updating useTopologyStore.ts:', e);
}

// --- 2. UPDATE useSiteStore.ts ---
try {
    let content = fs.readFileSync(siteStorePath, 'utf8');
    
    // Ensure removeNodesByDeviceIds exists (it might be there from V11, but safety first)
    if (!content.includes('removeNodesByDeviceIds:')) {
        const insertPoint = 'isNodeDeployed: (nid)';
        const newAction = `
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
        `;
        content = content.replace(insertPoint, newAction + insertPoint);
        fs.writeFileSync(siteStorePath, content);
        console.log('✅ useSiteStore.ts updated (added helper).');
    } else {
        console.log('ℹ️ useSiteStore.ts already has helper.');
    }
} catch (e) {
    console.error('❌ Error updating useSiteStore.ts:', e);
}

// --- 3. UPDATE DeviceSidebar.tsx ---
try {
    let content = fs.readFileSync(sidebarPath, 'utf8');

    // Replace the TreeNode component entirely to handle the complex conditional rendering logic cleanly
    const newTreeNode = `const TreeNode = ({ node, selectedIds, toggleSelect, clearSelection, descriptionMap }: any) => {
  const { isNodeDeployed, findNodeLocation, setActiveView } = useSiteStore();
  const [isExpanded, setIsExpanded] = useState(node.forceExpand ?? (node.role === 'LEADER'));
  const isDeployed = isNodeDeployed(node.mac);
  const isSelected = selectedIds.has(node.mac);
  
  // Status Flags
  const isMissing = node.status === 'missing';
  const isNew = node.isNew && !isDeployed; // Only highlight if not yet placed

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
    if (isDeployed || isMissing) { e.preventDefault(); return; } // Block drag
    const effectivePayload = isSelected ? Array.from(selectedIds) : [node.mac];
    e.dataTransfer.setData('application/json', JSON.stringify({ ids: effectivePayload }));
  };

  const handleFocus = (e: React.MouseEvent) => {
      e.stopPropagation();
      const loc = findNodeLocation(node.mac);
      if (loc) {
          setActiveView(loc.buildingId, loc.floorId);
          window.dispatchEvent(new CustomEvent('FOCUS_NODE', { detail: { x: loc.x, y: loc.y } }));
      }
  };

  // Resolve Alias
  const customName = descriptionMap ? descriptionMap[node.mac] : null;
  const displayName = customName || (node.mac ? node.mac.slice(-4) : node.id);

  return (
    <div className="flex flex-col select-none">
      <div 
        className={\`flex items-center py-1.5 pr-2 pl-0 rounded-r-md transition-colors group 
            \${isSelected ? 'bg-indigo-50' : 'hover:bg-gray-100'} 
            \${(isDeployed || isMissing) ? 'opacity-70 cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'}
            \${isNew ? 'bg-yellow-50 border-l-2 border-yellow-400' : ''}
        \`}
        onClick={(e) => { 
            e.stopPropagation();
            // Block interaction for missing nodes
            if (!isMissing) {
                if (e.ctrlKey || e.metaKey) {
                    toggleSelect(node);
                } else {
                    if (selectedIds.size > 0) clearSelection();
                    setIsExpanded(!isExpanded);
                }
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
            <span className={\`ml-1 \${customName ? 'text-indigo-600 font-bold' : 'text-gray-400'}\`}>
                ({displayName})
            </span>
            {isNew && <span className="ml-2 text-[8px] bg-yellow-400 text-white px-1 rounded font-bold shadow-sm">NEW</span>}
            {isMissing && <span className="ml-2 text-[8px] bg-red-400 text-white px-1 rounded font-bold shadow-sm">MISSING</span>}
            </span>
        </div>

        {(node.role === 'ROUTER' || node.role === 'LEADER') && node.children.length > 0 && (
            <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 rounded mr-1">
                {node.children.length}
            </span>
        )}

        <div className="flex items-center gap-1">
            {isDeployed ? (
                <button onClick={handleFocus} className="p-1 text-gray-400 hover:text-indigo-600 rounded-full hover:bg-indigo-50 transition-colors" title="Locate on Map">
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
             />
          ))}
        </div>
      )}
    </div>
  );
};`;

    // Regex to capture the existing TreeNode component
    // Assuming it starts with "const TreeNode =" and ends before "const LoopItem =" or just replacing the block
    const treeNodeRegex = /const TreeNode = \(\{[\s\S]*?^};/m;
    
    // We try to match from 'const TreeNode' down to the closing brace before the next component
    // A robust way is to find the block.
    if (content.includes('const TreeNode =')) {
        // We will perform a string replacement using a known range or regex
        // Since component structure might vary, let's look for the start and the next component start
        const startIdx = content.indexOf('const TreeNode =');
        const endIdx = content.indexOf('const LoopItem =');
        
        if (startIdx !== -1 && endIdx !== -1) {
            const before = content.substring(0, startIdx);
            const after = content.substring(endIdx);
            fs.writeFileSync(sidebarPath, before + newTreeNode + '\n\n' + after);
            console.log('✅ DeviceSidebar.tsx updated (TreeNode logic).');
        } else {
            console.warn('⚠️ Could not safely locate TreeNode boundaries.');
        }
    }

} catch (e) {
    console.error('❌ Error updating DeviceSidebar.tsx:', e);
}