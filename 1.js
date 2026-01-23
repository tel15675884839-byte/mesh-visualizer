const fs = require('fs');
const path = require('path');

const clientPath = path.join(__dirname, 'apps', 'client', 'src');
const componentsPath = path.join(clientPath, 'components');

console.log('👁️ Enabling "Focus" for All Devices (Safe Update)...');

const sidebarPath = path.join(componentsPath, 'DeviceSidebar.tsx');

try {
    let content = fs.readFileSync(sidebarPath, 'utf8');

    // 1. UPDATE TreeNode: Allow Eye Icon for any Deployed Node (Active or Missing)
    // We replace the TreeNode component to ensure the button logic covers missing nodes.
    const treeNodeRegex = /const TreeNode = \(\{[\s\S]*?^};/m;
    
    // This revised component keeps ALL your existing logic (Checkbox, Drag Block, etc.)
    const newTreeNode = `const TreeNode = ({ node, selectedIds, toggleSelect, clearSelection, descriptionMap, forceDisabled }: any) => {
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
        className={\`flex items-center py-1.5 pr-2 pl-0 rounded-r-md transition-colors group relative
            \${isSelected ? 'bg-indigo-50' : 'hover:bg-gray-100'} 
            \${(isDeployed || isMissing) ? 'opacity-100' : ''} 
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
            {/* Logic Update: Show Eye if Deployed OR Missing (since Missing nodes are still on map as ghosts) */}
            {(isDeployed || isMissing) ? (
                <button 
                    onClick={handleFocus}
                    className={\`p-1 rounded-full transition-colors \${isMissing ? 'text-red-400 hover:text-red-600 hover:bg-red-50' : 'text-gray-400 hover:text-indigo-600 hover:bg-indigo-50'}\`}
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
};`;

    if (treeNodeRegex.test(content)) {
        content = content.replace(treeNodeRegex, newTreeNode);
        console.log('✅ DeviceSidebar: TreeNode updated successfully (Safe Replacement).');
    } else {
        console.error('❌ Failed to locate TreeNode. Code structure might have changed.');
    }

    // 2. UPDATE LoopItem: Add Eye Button to the "Missing Devices" bottom list
    // We look for the missing devices mapping block
    const missingListRegex = /{missingDevices\.map\(\(d: any\) => \{[\s\S]*?return \(\s*<div key=\{d\.mac\}[\s\S]*?<\/div>\s*\);\s*\}\)}/m;

    const newMissingList = `{missingDevices.map((d: any) => {
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
                        })}`;

    if (missingListRegex.test(content)) {
        content = content.replace(missingListRegex, newMissingList);
        console.log('✅ DeviceSidebar: LoopItem Missing List updated with Eye Icon.');
    } else {
        console.warn('⚠️ Could not locate missing devices list block. It might already be updated.');
    }

    // 3. Ensure Hooks are destructured in LoopItem
    // We need findNodeLocation and setActiveView in LoopItem
    const loopItemHookRegex = /const \{ isNodeDeployed, removeNodesByDeviceIds \} = useSiteStore\(\);/;
    const newLoopItemHook = `const { isNodeDeployed, removeNodesByDeviceIds, findNodeLocation, setActiveView } = useSiteStore();`;
    
    if (loopItemHookRegex.test(content)) {
        content = content.replace(loopItemHookRegex, newLoopItemHook);
    }

    fs.writeFileSync(sidebarPath, content);

} catch (e) {
    console.error('❌ Error updating DeviceSidebar.tsx:', e);
}