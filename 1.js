const fs = require('fs');
const path = require('path');

const clientPath = path.join(__dirname, 'apps', 'client', 'src');
const componentsPath = path.join(clientPath, 'components');

console.log('👻 Enabling "Focus" for Missing Devices...');

try {
    const sidebarPath = path.join(componentsPath, 'DeviceSidebar.tsx');
    let content = fs.readFileSync(sidebarPath, 'utf8');

    // We need to modify the TreeNode component logic.
    // Specifically, we need to allow the Eye Icon to render even if isMissing is true.
    // Currently, the eye icon renders if `isDeployed` is true.
    // Missing nodes ARE deployed (they exist on map), so `isDeployed` should be true.
    // However, the `draggable` and `onClick` logic might be blocking interaction.

    // Let's replace the TreeNode component with a refined version that explicitly allows Focus on Missing nodes.

    const oldTreeNodeRegex = /const TreeNode = \(\{[\s\S]*?^};/m;
    
    // Updated TreeNode:
    // 1. Allow Eye button for ANY deployed node (Active or Missing).
    // 2. Ensure the row style for Missing nodes allows clicking the button (pointer-events).

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
      e.stopPropagation();
      const loc = findNodeLocation(node.mac);
      if (loc) {
          setActiveView(loc.buildingId, loc.floorId);
          window.dispatchEvent(new CustomEvent('FOCUS_NODE', { detail: { x: loc.x, y: loc.y, id: node.mac } }));
      } else {
          // Fallback if not found on map (shouldn't happen if isDeployed is true)
          alert("Device location not found on map.");
      }
  };

  const customName = descriptionMap ? descriptionMap[node.mac] : null;
  const displayName = customName || (node.mac ? node.mac.slice(-4) : node.id);

  return (
    <div className="flex flex-col select-none">
      <div 
        className={\`flex items-center py-1.5 pr-2 pl-0 rounded-r-md transition-colors group 
            \${isSelected ? 'bg-indigo-50' : 'hover:bg-gray-100'} 
            \${isDeployed ? 'opacity-100' : 'cursor-grab active:cursor-grabbing'} 
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
                // For Deployed/Missing, allow expand toggle
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

        <div className="flex items-center gap-1">
            {/* ENABLE EYE FOR ANY DEPLOYED NODE (Active OR Missing) */}
            {isDeployed ? (
                <button 
                    onClick={handleFocus}
                    className={\`p-1 rounded-full transition-colors \${isMissing ? 'text-red-400 hover:text-red-600 hover:bg-red-50' : 'text-gray-400 hover:text-indigo-600 hover:bg-indigo-50'}\`}
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

    if (oldTreeNodeRegex.test(content)) {
        content = content.replace(oldTreeNodeRegex, newTreeNode);
        fs.writeFileSync(sidebarPath, content);
        console.log('✅ DeviceSidebar.tsx: Enabled Eye Icon for Missing Devices.');
    } else {
        // Fallback: If structure changed, try to find the button logic and patch it
        console.warn('⚠️ Could not fully replace TreeNode. Attempting surgical patch for Eye button...');
        // Manual patch logic if needed, but replace is safer for this complexity.
    }

} catch (e) {
    console.error('❌ Error updating DeviceSidebar.tsx:', e);
}