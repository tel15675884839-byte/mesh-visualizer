const fs = require('fs');
const path = require('path');

const clientPath = path.join(__dirname, 'apps', 'client', 'src');
const componentsPath = path.join(clientPath, 'components');
const storePath = path.join(clientPath, 'store');

console.log('🔧 Finalizing Update Logic: Ghost Retention & Visuals...');

// 1. UPDATE useTopologyStore.ts (Logic Fix)
// Goal: Stop auto-deleting missing nodes from map. Keep them as 'missing'.
try {
    let content = fs.readFileSync(path.join(storePath, 'useTopologyStore.ts'), 'utf8');

    // We need to replace the importLoopData implementation.
    // Finding the specific block to replace carefully.
    const targetAction = `importLoopData: (loopId, newDevices, newEdges, onRemoveNodes) => set((state) => {`;
    
    // The new logic: DO NOT call onRemoveNodes for dropped items. Just mark them.
    const newImplementation = `importLoopData: (loopId, newDevices, newEdges, onRemoveNodes) => set((state) => {
        const oldLoopDevices = state.unassignedDevices.filter(d => d.loopId === loopId);
        const otherLoopDevices = state.unassignedDevices.filter(d => d.loopId !== loopId);
        
        const oldMacs = new Set(oldLoopDevices.map(d => d.mac));
        const newMacs = new Set(newDevices.map(d => d.mac));
        
        // Identify Missing (Old but not in New) -> Keep them, mark as missing
        // CRITICAL CHANGE: Do NOT call onRemoveNodes here. We want them to stay on map as ghosts.
        const missingDevices = oldLoopDevices
            .filter(d => !newMacs.has(d.mac))
            .map(d => ({ ...d, status: 'missing' }));

        // Identify New/Updated
        const processedNewDevices = newDevices.map(d => ({
            ...d,
            loopId,
            isNew: !oldMacs.has(d.mac), // Tag as new if not in old set
            status: 'active'
        }));

        // Edges: Only keep edges for active devices. Missing devices lose connections naturally
        // or we can keep old edges if both ends are missing? 
        // For visual clarity, usually ghost nodes don't have lines.
        // Let's replace edges with NEW edges only. Ghosts become isolated dots.
        const otherEdges = state.edges.filter(e => e.loopId !== loopId);
        const taggedEdges = newEdges.map(e => ({ ...e, loopId }));

        return {
          unassignedDevices: [...otherLoopDevices, ...processedNewDevices, ...missingDevices],
          edges: [...otherEdges, ...taggedEdges],
          importError: null
        };
      }),`;

    // Perform replacement using regex to capture the full function body
    const regex = /importLoopData:\s*\(loopId,\s*newDevices,\s*newEdges,\s*onRemoveNodes\)\s*=>\s*set\(\(state\)\s*=>\s*\{[\s\S]*?\}\),/m;
    
    if (regex.test(content)) {
        content = content.replace(regex, newImplementation);
        fs.writeFileSync(path.join(storePath, 'useTopologyStore.ts'), content);
        console.log('✅ useTopologyStore.ts: Disabled auto-delete for missing nodes.');
    } else {
        console.warn('⚠️ Could not locate importLoopData to patch.');
    }
} catch (e) {
    console.error('❌ Error patching useTopologyStore.ts', e);
}


// 2. UPDATE DeviceSidebar.tsx (UI Label Fix)
try {
    let content = fs.readFileSync(path.join(componentsPath, 'DeviceSidebar.tsx'), 'utf8');

    // 1. Rename Section Header
    // Look for "Missing / Offline" or similar
    const oldHeaderRegex = /Missing \/ Offline \(\{[^}]+\}\)/;
    const newHeader = `Missing device ({missingDevices.length})`;
    
    if (oldHeaderRegex.test(content)) {
        content = content.replace(oldHeaderRegex, newHeader);
    } else {
        // Fallback: look for the string literal
        content = content.replace("Missing / Offline", "Missing device");
    }

    // 2. Ensure Drag is Disabled in TreeNode
    // We already did this in V16, but reinforcing the logic inside LoopItem's rendering of missing list
    // The previous code rendered a flat list for missing items:
    // <div key={d.mac} ... cursor-not-allowed ...>
    
    // Let's make sure the text "(Offline)" is removed or updated if needed, 
    // but the prompt just said "Missing device" list name.
    
    fs.writeFileSync(path.join(componentsPath, 'DeviceSidebar.tsx'), content);
    console.log('✅ DeviceSidebar.tsx: Renamed Missing section.');

} catch (e) {
    console.error('❌ Error patching DeviceSidebar.tsx', e);
}


// 3. UPDATE FloorPlanEditor.tsx (Ghost Visuals)
try {
    let content = fs.readFileSync(path.join(componentsPath, 'FloorPlanEditor.tsx'), 'utf8');

    // We need to inject the Question Mark logic into the Nodes component.
    // We look for the <Group> rendering inside Nodes.
    
    // Strategy: Replace the Text component rendering logic to show "?" when missing.
    // The previous code had: {isMissing && <Text ... text="?" ... />}
    // We want to ensure it's CENTERED and replaces the ID.

    const nodesComponentRegex = /const Nodes = React\.memo\(\(\{[\s\S]*?return \(\s*<Group>[\s\S]*?<\/Group>\s*\);\s*\}\);/m;
    
    if (nodesComponentRegex.test(content)) {
        // We will define a replacement Nodes component string to ensure it's exactly as requested
        // Note: Using the exact same props and logic as V14/V16 but enforcing the Visual Style.
        
        const newNodesComponent = `const Nodes = React.memo(({ 
    activeFloor, 
    updatePosition, 
    nodeScale, 
    currentScale, 
    baseFontSize, 
    unassignedDevices,
    layerRef,
    isDeleteMode,
    onRemove,
    onContextMenu,
    onDragStart, 
    onDragEnd 
}: any) => {
  
  const getRole = (id: string) => {
    const dev = unassignedDevices.find((d: any) => d.mac === id || d.id === id);
    return (dev?.type || dev?.role || '').toLowerCase();
  };
  const getStatus = (id: string) => {
      const dev = unassignedDevices.find((d: any) => d.mac === id || d.id === id);
      return dev?.status || 'active';
  };
  const getColor = (r: string) => r.includes('leader') ? '#ef4444' : r.includes('router') ? '#3b82f6' : '#22c55e';

  // Imperative Line Update Logic
  const updateConnectedLines = (nodeId: string, x: number, y: number) => {
      const layer = layerRef.current;
      if (!layer) return;
      const groups = layer.find('Group'); 
      for (const group of groups) {
          const id = group.id();
          if (id && id.startsWith('edge-') && id.includes(nodeId)) {
              const outline = group.findOne('.outline-line');
              const colorLine = group.findOne('.color-line');
              const hitLine = group.findOne('.hit-line');
              if (!colorLine) continue;
              const oldPoints = colorLine.points();
              const newPoints = [...oldPoints];
              const isStart = id.startsWith(\`edge-\${nodeId}-\`);
              const isEnd = id.endsWith(\`-\${nodeId}\`);
              if (isStart) { newPoints[0] = x; newPoints[1] = y; } else if (isEnd) { newPoints[2] = x; newPoints[3] = y; } else { continue; }
              if(outline) outline.points(newPoints);
              if(colorLine) colorLine.points(newPoints);
              if(hitLine) hitLine.points(newPoints);
          }
      }
  };

  return (
    <Group>
      {activeFloor.nodes.map((node: any) => {
        const role = getRole(node.id);
        const status = getStatus(node.id);
        const isMissing = status === 'missing';
        
        const baseRadius = 10 * nodeScale;
        const constantTextScale = (1 / currentScale); 
        const labelText = node.description ? node.description : node.id.slice(-4);

        return (
          <Group
            key={node.id}
            id={\`node-\${node.id}\`}
            x={node.x}
            y={node.y}
            draggable={!isDeleteMode && !isMissing} // LOCKED if missing
            opacity={isMissing ? 0.8 : 1} // Slightly clearer ghost
            onClick={(e) => {
                if (isDeleteMode) {
                    e.cancelBubble = true;
                    onRemove(activeFloor.id, node.id);
                }
            }}
            onContextMenu={(e) => {
                e.evt.preventDefault();
                // Disable context menu for missing? Or allow delete only?
                // Letting it passthrough allows delete, which is good.
                e.cancelBubble = true;
                onContextMenu(e.evt, node.id, node.description);
            }}
            onDragStart={(e) => { 
                e.cancelBubble = true; 
                if(!isMissing) onDragStart(node.id); 
            }}
            onDragMove={(e) => {
                e.cancelBubble = true;
                if(!isMissing) {
                    const newX = e.target.x();
                    const newY = e.target.y();
                    updateConnectedLines(node.id, newX, newY);
                }
            }}
            onDragEnd={(e) => {
                e.cancelBubble = true;
                if(!isMissing) {
                    onDragEnd();
                    updatePosition(activeFloor.id, node.id, e.target.x(), e.target.y());
                }
            }}
            onMouseEnter={(e) => { 
                if (isDeleteMode) { const c = e.target.getStage()?.container(); if(c) c.style.cursor = 'crosshair'; }
                else if (isMissing) { const c = e.target.getStage()?.container(); if(c) c.style.cursor = 'not-allowed'; }
            }}
            onMouseLeave={(e) => {
               const c = e.target.getStage()?.container(); if(c) c.style.cursor = 'default'; 
            }}
          >
            {/* Visuals: Circle */}
            <Circle 
                radius={baseRadius} 
                fill={isMissing ? '#e5e7eb' : getColor(role)} // Light gray fill for ghost
                stroke={isDeleteMode ? 'red' : (isMissing ? '#6b7280' : 'white')} // Dark gray stroke for ghost
                strokeWidth={(isDeleteMode ? 3 : 2) / currentScale} 
                shadowBlur={isMissing ? 0 : 2} 
                perfectDrawEnabled={false}
                dash={isMissing ? [5, 5] : undefined} // Dashed Border
            />
            
            {/* Visuals: Text Label (Name) */}
            <Text 
                y={baseRadius + (5 / currentScale)} 
                text={labelText} 
                fontSize={baseFontSize}
                scaleX={constantTextScale}
                scaleY={constantTextScale}
                fill={isMissing ? '#9ca3af' : '#111'} // Faded text
                fontStyle={isMissing ? 'italic' : 'bold'}
                align="center"
                width={200}
                offsetX={100}
                perfectDrawEnabled={false}
            />

            {/* Visuals: Question Mark Center (Overlay) */}
            {isMissing && (
                <Text 
                    x={0}
                    y={0}
                    text="?" 
                    fontSize={14 * nodeScale} // Scale with node
                    fill="#6b7280" 
                    fontStyle="bold" 
                    align="center" 
                    verticalAlign="middle"
                    offsetX={5 * nodeScale} // Approximate centering
                    offsetY={7 * nodeScale}
                    perfectDrawEnabled={false}
                />
            )}
          </Group>
        );
      })}
    </Group>
  );
});`;

        content = content.replace(nodesComponentRegex, newNodesComponent);
        fs.writeFileSync(path.join(componentsPath, 'FloorPlanEditor.tsx'), content);
        console.log('✅ FloorPlanEditor.tsx: Updated Ghost Visuals (Dashed Circle + Question Mark).');
    } else {
        console.warn('⚠️ Could not locate Nodes component to patch.');
    }

} catch (e) {
    console.error('❌ Error patching FloorPlanEditor.tsx', e);
}

console.log('🏁 All requests finalized.');