const fs = require('fs');
const path = require('path');

const clientPath = path.join(__dirname, 'apps', 'client', 'src');
const componentsPath = path.join(clientPath, 'components');
const editorPath = path.join(componentsPath, 'FloorPlanEditor.tsx');

console.log('🚑 Applying V22: Fixing Sticky Drag & Icon Refresh...');

try {
    let editorCode = fs.readFileSync(editorPath, 'utf8');

    // 我们将完全替换 SingleDeviceNode 和 Nodes 组件。
    // 这次我们移除复杂的自定义 Memo 比较器，改用标准的 React.memo。
    
    const newComponents = `
// --- Sub-Component: Single Device Node (V22 Stable) ---
const SingleDeviceNode = React.memo(({ 
    node, 
    activeFloorId,
    role, 
    status, 
    nodeScale, 
    currentScale, 
    baseFontSize, 
    isDeleteMode,
    highlightedId,
    layerRef, 
    // Actions
    onRemove,
    onContextMenu,
    onDragStart,
    onDragMove,
    onDragEnd,
    updatePosition
}: any) => {
    
    const isMissing = status === 'missing';
    const isHighlighted = node.id === highlightedId;
    const baseRadius = 10 * nodeScale;
    const constantTextScale = (1 / currentScale);
    const labelText = node.description ? node.description : node.id.slice(-4);

    // --- Visual Logic ---
    let iconName = null;
    let strokeColor = '#000000'; 
    let fillColor = '#22c55e';
    let borderThickness = 1;
    let showBorder = true; 

    const r = role.toLowerCase();
    
    if (r.includes('leader')) {
        iconName = 'Leader.svg'; 
        strokeColor = '#ef4444'; 
        showBorder = false; 
    } else if (r.includes('router')) {
        iconName = 'Router.svg';
        strokeColor = '#3b82f6'; 
        showBorder = false; 
    } else {
        // Child Logic
        if (node.category) {
            iconName = \`\${node.category}.svg\`; 
        }
    }

    // Force border if special state
    if (isDeleteMode || isHighlighted || isMissing) {
        showBorder = true;
    }

    // Load SVG
    const [image] = useImage(iconName ? \`/assets/icons/\${iconName}\` : '', 'anonymous');

    // Dynamic Stroke Logic
    const finalStroke = isDeleteMode ? 'red' : (isHighlighted ? '#06b6d4' : (isMissing ? '#4b5563' : strokeColor));
    const finalStrokeWidth = showBorder ? ((isDeleteMode ? 3 : (isHighlighted ? 5 : borderThickness)) / currentScale) : 0;

    // Imperative Line Update
    const handleDragMove = (e: any) => {
      e.cancelBubble = true;
      if (isMissing) return;

      const newX = e.target.x();
      const newY = e.target.y();
      
      // Update Lines Imperatively
      const layer = layerRef.current;
      if (layer) {
          const groups = layer.find('Group'); 
          for (const group of groups) {
              const id = group.id();
              if (id && id.startsWith('edge-') && id.includes(node.id)) {
                  const outline = group.findOne('.outline-line');
                  const colorLine = group.findOne('.color-line');
                  if (!colorLine) continue;

                  const oldPoints = colorLine.points();
                  const newPoints = [...oldPoints];
                  const isStart = id.startsWith(\`edge-\${node.id}-\`);
                  const isEnd = id.endsWith(\`-\${node.id}\`);

                  if (isStart) { newPoints[0] = newX; newPoints[1] = newY; } 
                  else if (isEnd) { newPoints[2] = newX; newPoints[3] = newY; } 
                  else continue;

                  if(outline) outline.points(newPoints);
                  if(colorLine) colorLine.points(newPoints);
              }
          }
      }
      // Call parent handler if needed (optional)
      if (onDragMove) onDragMove(node.id, newX, newY);
    };

    return (
        <Group
            id={\`node-\${node.id}\`}
            x={node.x}
            y={node.y}
            draggable={!isDeleteMode && !isMissing}
            opacity={isMissing ? 0.6 : 1}
            onClick={(e) => { 
                if (isDeleteMode) { e.cancelBubble = true; onRemove(activeFloorId, node.id); } 
            }}
            onContextMenu={(e) => { 
                e.evt.preventDefault(); 
                e.cancelBubble = true; 
                onContextMenu(e.evt, node.id, node.description, node.category); 
            }}
            onDragStart={(e) => { 
                e.cancelBubble = true; 
                if(!isMissing) onDragStart(node.id); 
            }}
            onDragMove={handleDragMove}
            onDragEnd={(e) => { 
                e.cancelBubble = true; 
                if(!isMissing) {
                    onDragEnd(); 
                    updatePosition(activeFloorId, node.id, e.target.x(), e.target.y());
                }
            }}
            onMouseEnter={(e) => { 
                if (isDeleteMode) { const c = e.target.getStage()?.container(); if(c) c.style.cursor = 'crosshair'; }
                else if (isMissing) { const c = e.target.getStage()?.container(); if(c) c.style.cursor = 'not-allowed'; }
            }}
            onMouseLeave={(e) => { const c = e.target.getStage()?.container(); if(c) c.style.cursor = 'default'; }}
        >
            {iconName && image ? (
                <KonvaImage
                    image={image}
                    width={baseRadius * 2}
                    height={baseRadius * 2}
                    offset={{ x: baseRadius, y: baseRadius }} 
                    stroke={finalStroke}
                    strokeWidth={finalStrokeWidth}
                    strokeEnabled={showBorder} 
                    shadowColor={isHighlighted ? '#06b6d4' : 'black'}
                    shadowBlur={(isHighlighted ? 20 : (isMissing ? 0 : 2)) / currentScale}
                    shadowOpacity={isHighlighted ? 0.8 : 0.3}
                    perfectDrawEnabled={false}
                    listening={true} 
                />
            ) : (
                <Circle 
                    radius={baseRadius} 
                    fill={isMissing ? '#9ca3af' : fillColor} 
                    stroke={finalStroke}
                    strokeWidth={finalStrokeWidth}
                    strokeEnabled={showBorder}
                    shadowColor={isHighlighted ? '#06b6d4' : 'black'}
                    shadowBlur={(isHighlighted ? 20 : (isMissing ? 0 : 2)) / currentScale} 
                    shadowOpacity={isHighlighted ? 0.8 : 0.3}
                    perfectDrawEnabled={false}
                    dash={isMissing ? [5, 5] : undefined}
                />
            )}
            
            <Text 
                y={baseRadius + (5 / currentScale)} 
                text={labelText} 
                fontSize={baseFontSize}
                scaleX={constantTextScale}
                scaleY={constantTextScale}
                fill={isMissing ? '#9ca3af' : '#111'}
                fontStyle={isMissing ? 'italic' : 'bold'}
                align="center"
                width={200}
                offsetX={100}
                perfectDrawEnabled={false}
                listening={false} 
            />
            {isMissing && <Text y={-baseRadius - (15/currentScale)} text="?" fontSize={14/currentScale} fill="red" fontStyle="bold" align="center" offsetX={4} perfectDrawEnabled={false} listening={false} />}
        </Group>
    );
}); // REMOVED CUSTOM COMPARATOR: Let React handle diffs to ensure Icon/Props updates propagate

// --- Wrapper Nodes Component ---
const Nodes = React.memo(({ 
    activeFloor, 
    updatePosition, 
    nodeScale, 
    currentScale, 
    baseFontSize, 
    unassignedDevices,
    layerRef,
    isDeleteMode,
    highlightedId,
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

  return (
    <Group>
      {activeFloor.nodes.map((node: any) => (
         <SingleDeviceNode 
            key={node.id}
            node={node}
            activeFloorId={activeFloor.id}
            role={getRole(node.id)}
            status={getStatus(node.id)}
            nodeScale={nodeScale}
            currentScale={currentScale}
            baseFontSize={baseFontSize}
            isDeleteMode={isDeleteMode}
            highlightedId={highlightedId}
            layerRef={layerRef}
            onRemove={onRemove}
            onContextMenu={onContextMenu}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd} 
            updatePosition={updatePosition}
         />
      ))}
    </Group>
  );
});
`;

    // Strategy: Look for "const SingleDeviceNode = " and replace everything until "export const FloorPlanEditor"
    // Because we need to replace SingleDeviceNode AND Nodes.
    
    const startMarker = 'const SingleDeviceNode = React.memo(({';
    const endMarker = 'export const FloorPlanEditor = () => {';
    
    const startIdx = editorCode.indexOf(startMarker);
    const endIdx = editorCode.indexOf(endMarker);
    
    if (startIdx !== -1 && endIdx !== -1) {
        const before = editorCode.substring(0, startIdx);
        const after = editorCode.substring(endIdx);
        
        editorCode = before + newComponents + '\n\n' + after;
        
        fs.writeFileSync(editorPath, editorCode);
        console.log('✅ FloorPlanEditor.tsx: Successfully fixed Sticky Drag & Icon Refresh.');
    } else {
        console.error('❌ Could not locate component block to replace. Please check file structure.');
    }

} catch (e) {
    console.error('❌ Error patching FloorPlanEditor:', e);
}