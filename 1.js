const fs = require('fs');
const path = require('path');

const clientPath = path.join(__dirname, 'apps', 'client', 'src');
const componentsPath = path.join(clientPath, 'components');
const editorPath = path.join(componentsPath, 'FloorPlanEditor.tsx');

console.log('🎨 Surgically Fixing Icons & UI (Anchor Slicing Mode)...');

try {
    let editorCode = fs.readFileSync(editorPath, 'utf8');

    // --- 1. 定义新的 SingleDeviceNode 代码 ---
    // 修复点：
    // - showBorder 默认为 false (Child 不再有边框)
    // - 仅在特殊状态 (Delete/Highlight/Missing) 下显示边框
    const newSingleDeviceNodeCode = `// --- Sub-Component: Single Device Node (Surgically Fixed) ---
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

    // --- Visual Logic (Separated Fill & Border) ---
    let iconName = null;
    let strokeColor = '#000000'; 
    let fillColor = '#22c55e';   // Default: Green fill
    let borderThickness = 1;     
    let showBorder = false;      // FIXED: Default NO BORDER for everyone (including Child)

    const r = role.toLowerCase();
    
    if (r.includes('leader')) {
        iconName = 'Leader.svg'; 
        strokeColor = '#ef4444'; 
    } else if (r.includes('router')) {
        iconName = 'Router.svg'; 
        strokeColor = '#3b82f6'; 
    } else {
        // Child Logic
        if (node.category) {
            iconName = \`\${node.category}.svg\`; 
        }
    }

    // Force border ONLY if special state
    if (isDeleteMode || isHighlighted || isMissing) {
        showBorder = true;
    }

    // Load SVG
    const [image] = useImage(iconName ? \`/assets/icons/\${iconName}\` : '', 'anonymous');

    const finalStroke = isDeleteMode ? 'red' : (isHighlighted ? '#06b6d4' : (isMissing ? '#4b5563' : strokeColor));
    const finalStrokeWidth = showBorder ? ((isDeleteMode ? 3 : (isHighlighted ? 5 : borderThickness)) / currentScale) : 0;

    const handleDragMove = (e: any) => {
      e.cancelBubble = true;
      if (isMissing) return;
      const newX = e.target.x();
      const newY = e.target.y();
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
            onDragStart={(e) => { e.cancelBubble = true; if(!isMissing) onDragStart(node.id); }}
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
});`;

    // --- 2. 执行替换 (SingleDeviceNode) ---
    const startIdx = editorCode.indexOf('const SingleDeviceNode = React.memo(({');
    const endIdx = editorCode.indexOf('const Nodes = React.memo(({');

    if (startIdx !== -1 && endIdx !== -1) {
        const before = editorCode.substring(0, startIdx);
        const after = editorCode.substring(endIdx);
        editorCode = before + newSingleDeviceNodeCode + '\n\n' + after;
        console.log('✅ Replaced SingleDeviceNode (Borders Removed).');
    } else {
        console.error('❌ Could not find "SingleDeviceNode" or "Nodes" anchor. Manual check needed.');
    }

    // --- 3. 确保按钮文本是 Confirm ---
    if (editorCode.includes('>Close</button>')) {
        editorCode = editorCode.replace('>Close</button>', '>Confirm</button>');
    }

    fs.writeFileSync(editorPath, editorCode);
    console.log('🏁 Surgical patch complete.');

} catch (e) {
    console.error('❌ Error patching FloorPlanEditor:', e);
}