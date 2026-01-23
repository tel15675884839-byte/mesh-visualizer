
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Stage, Layer, Image as KonvaImage, Circle, Line, Text, Group, Label, Tag, Rect } from 'react-konva';
import Konva from 'konva';
import useImage from 'use-image';
import { useSiteStore } from '../store/useSiteStore';
import { useTopologyStore } from '../store/useTopologyStore';
import { getImage } from '../utils/storage';
import { Layers, ZoomIn, Trash2, Eraser, X, Pencil, Type } from 'lucide-react';

const STAGE_WIDTH_OFFSET = 350;
const DEBOUNCE_MS = 500;

function useDebounceCallback<T extends (...args: any[]) => void>(callback: T, delay: number) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  return useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      callback(...args);
    }, delay);
  }, [callback, delay]);
}

const FloorImage = React.memo(({ mapId }: { mapId: string }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    getImage(mapId).then((blob) => { if (active && blob) setImageUrl(URL.createObjectURL(blob)); });
    return () => { active = false; if (imageUrl) URL.revokeObjectURL(imageUrl); };
  }, [mapId]);
  const [image] = useImage(imageUrl || '');
  return image ? <KonvaImage image={image} listening={false} perfectDrawEnabled={false} /> : null;
}, (prev, next) => prev.mapId === next.mapId);

const Connections = React.memo(({ activeFloor, currentScale, layerRef }: { activeFloor: any, currentScale: number, layerRef: React.RefObject<Konva.Layer> }) => {
  const { edges, unassignedDevices } = useTopologyStore();
  const [tooltip, setTooltip] = useState<{ x: number, y: number, text: string } | null>(null);

  const connectionData = useMemo(() => {
    const nodeSet = new Set(activeFloor.nodes.map((n: any) => n.id));
    const localIdToMac = new Map<string, string>();
    activeFloor.nodes.forEach((n: any) => {
        const dev = unassignedDevices.find((d: any) => d.mac === n.id);
        if (dev && dev.status !== 'missing') {
            localIdToMac.set(dev.mac, dev.mac);
            if (dev.id) localIdToMac.set(String(dev.id), dev.mac);
        }
    });

    const validEdges: any[] = [];
    edges.forEach((e: any) => {
        const uRaw = String(e.from ?? e.sourceId);
        const vRaw = String(e.to ?? e.targetId);
        const u = localIdToMac.get(uRaw);
        const v = localIdToMac.get(vRaw);

        if (u && v && nodeSet.has(u) && nodeSet.has(v)) {
            const getRole = (id: string) => {
                const dev = unassignedDevices.find((d: any) => d.mac === id);
                return (dev?.type || dev?.role || '').toLowerCase();
            };
            const r1 = getRole(u);
            const r2 = getRole(v);
            let color = '#3b82f6';
            if (r1.includes('leader') || r2.includes('leader')) color = '#ef4444';
            else if (r1.includes('child') || r2.includes('child')) color = '#22c55e';

            let rssiVal = 'N/A';
            if (e.rssi !== undefined) rssiVal = e.rssi;
            else if (e.linkQuality !== undefined) rssiVal = e.linkQuality;
            else if (e.title) {
                const match = e.title.match(/(-?\d+\s*dBm)/i) || e.title.match(/(?:RSSI|Signal)[:\s]*(-?\d+)/i);
                if (match) rssiVal = match[1];
            } else if (e.label) rssiVal = e.label;

            let displaySignal = String(rssiVal);
            if (!displaySignal.includes('dBm') && !isNaN(parseInt(displaySignal))) displaySignal += ' dBm';

            validEdges.push({ id: `edge-${u}-${v}`, u, v, color, rssi: displaySignal });
        }
    });
    return validEdges;
  }, [edges, activeFloor.nodes, unassignedDevices]);

  const getPos = (id: string) => activeFloor.nodes.find((n: any) => n.id === id) || { x: 0, y: 0 };
  const strokeWidth = Math.max(0.3, 0.5 / currentScale);

  return (
    <Group>
      {connectionData.map((edge) => {
        const p1 = getPos(edge.u);
        const p2 = getPos(edge.v);
        const points = [p1.x, p1.y, p2.x, p2.y];

        return (
          <Group key={edge.id} id={edge.id}>
             <Line points={points} stroke="transparent" strokeWidth={15 / currentScale} onMouseEnter={(e) => { const c = e.target.getStage()?.container(); if(c) c.style.cursor = 'pointer'; }} onMouseLeave={(e) => { const c = e.target.getStage()?.container(); if(c) c.style.cursor = 'default'; }} onClick={(e) => { e.cancelBubble = true; const stage = e.target.getStage(); const pointer = stage?.getPointerPosition(); if (pointer) { const transform = stage.getAbsoluteTransform().copy(); transform.invert(); const pos = transform.point(pointer); if (tooltip?.text === edge.rssi) setTooltip(null); else setTooltip({ x: pos.x, y: pos.y, text: edge.rssi }); } }} name="hit-line" />
             <Line points={points} stroke="white" strokeWidth={strokeWidth + 2} opacity={0.8} listening={false} perfectDrawEnabled={false} name="outline-line" />
             <Line points={points} stroke={edge.color} strokeWidth={strokeWidth} listening={false} perfectDrawEnabled={false} name="color-line" dash={[undefined]} />
             {tooltip && tooltip.text === edge.rssi && <Label x={tooltip.x} y={tooltip.y} listening={false}><Tag fill="#1f2937" pointerDirection="down" pointerWidth={10/currentScale} pointerHeight={10/currentScale} cornerRadius={4/currentScale} opacity={0.9} /><Text text={tooltip.text} fontSize={12/currentScale} padding={6/currentScale} fill="white" align="center" /></Label>}
          </Group>
        );
      })}
    </Group>
  );
});

// --- Sub-Component: Single Device Node (V23 Fixed) ---
// --- Sub-Component: Single Device Node (Surgically Fixed) ---
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
            iconName = `${node.category}.svg`; 
        }
    }

    // Force border ONLY if special state
    if (isDeleteMode || isHighlighted || isMissing) {
        showBorder = true;
    }

    // Load SVG
    const [image] = useImage(iconName ? `/assets/icons/${iconName}` : '', 'anonymous');

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
                  const isStart = id.startsWith(`edge-${node.id}-`);
                  const isEnd = id.endsWith(`-${node.id}`);
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
            id={`node-${node.id}`}
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
});

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
            key={`${node.id}-${node.category || ""}`}
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

export const FloorPlanEditor = () => {
  const { buildings, activeBuildingId, activeFloorId, setActiveView, getActiveFloor, updateNodePosition, updateNodeDescription, updateNodeCategory, removeNodeFromFloor, nodeScale, setNodeScale, baseFontSize, setBaseFontSize, viewState, setViewState } = useSiteStore();
  const { unassignedDevices, clearDeviceSelection } = useTopologyStore();
  const activeFloor = getActiveFloor();
  const stageRef = useRef<Konva.Stage>(null);
  const layerRef = useRef<Konva.Layer>(null);
  const dragTargetRef = useRef<string | null>(null);

  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [selectionBox, setSelectionBox] = useState<{ startX: number, startY: number, endX: number, endY: number, visible: boolean } | null>(null);
  const [propertyModal, setPropertyModal] = useState<{ visible: boolean, x: number, y: number, nodeId: string | null, currentDesc?: string, currentCategory?: string }>({ visible: false, x: 0, y: 0, nodeId: null });
  // Removed isDraggingNode state to prevent parent re-renders during drag
  // We rely on imperative updates and refs now.

  const debouncedSetView = useDebounceCallback((x: number, y: number, scale: number) => { setViewState(x, y, scale); }, DEBOUNCE_MS);
  const { x: stageX, y: stageY, scale: stageScale } = viewState;

  // Global Drag Reset
  const handleGlobalEnd = () => {
      dragTargetRef.current = null;
  };

  // Initialization Effect
  useEffect(() => {
      if (stageRef.current) {
          const { x, y, scale } = useSiteStore.getState().viewState;
          stageRef.current.position({ x, y });
          stageRef.current.scale({ x: scale, y: scale });
          stageRef.current.batchDraw();
      }
  }, [activeFloor?.id]); 

  // FOCUS NODE Listener
  useEffect(() => {
      const handleFocusEvent = (e: any) => {
          const stage = stageRef.current;
          if (!stage) return;
          const targetNodeX = e.detail.x;
          const targetNodeY = e.detail.y;
          const targetScale = 1.5;
          const duration = 800;
          const stageWidth = stage.width();
          const stageHeight = stage.height();
          const targetStageX = (stageWidth / 2) - (targetNodeX * targetScale);
          const targetStageY = (stageHeight / 2) - (targetNodeY * targetScale);
          const startScale = stage.scaleX();
          const startX = stage.x();
          const startY = stage.y();
          const startTime = performance.now();
          const animate = (time: number) => {
              const elapsed = time - startTime;
              const progress = Math.min(elapsed / duration, 1);
              const ease = 1 - Math.pow(1 - progress, 3);
              const newScale = startScale + (targetScale - startScale) * ease;
              const newX = startX + (targetStageX - startX) * ease;
              const newY = startY + (targetStageY - startY) * ease;
              stage.scale({ x: newScale, y: newScale });
              stage.position({ x: newX, y: newY });
              stage.batchDraw();
              if (progress < 1) requestAnimationFrame(animate);
              else setViewState(newX, newY, newScale);
          };
          requestAnimationFrame(animate);
      };
      window.addEventListener('FOCUS_NODE', handleFocusEvent);
      return () => window.removeEventListener('FOCUS_NODE', handleFocusEvent);
  }, [setViewState]);

  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const scaleBy = 1.1;
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const mousePointTo = { x: (pointer.x - stage.x()) / oldScale, y: (pointer.y - stage.y()) / oldScale };
    const newScale = Math.max(0.05, Math.min(e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy, 20));
    const newPos = { x: pointer.x - mousePointTo.x * newScale, y: pointer.y - mousePointTo.y * newScale };
    stage.scale({ x: newScale, y: newScale });
    stage.position(newPos);
    stage.batchDraw();
    debouncedSetView(newPos.x, newPos.y, newScale);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!activeFloor || !stageRef.current) return;
    let ids: string[] = [];
    try { ids = JSON.parse(e.dataTransfer.getData('application/json')).ids || []; } catch(e) {}
    if (ids.length === 0) return;
    stageRef.current.setPointersPositions(e);
    const pointer = stageRef.current.getPointerPosition();
    if (!pointer) return;
    const stage = stageRef.current;
    const canvasX = (pointer.x - stage.x()) / stage.scaleX();
    const canvasY = (pointer.y - stage.y()) / stage.scaleY();
    const cols = 5;
    const spacing = 50 * nodeScale;
    ids.forEach((id, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const offsetX = (Math.min(ids.length, cols) * spacing) / 2;
      const offsetY = (Math.ceil(ids.length / cols) * spacing) / 2;
      updateNodePosition(activeFloor.id, id, canvasX + (col * spacing) - offsetX, canvasY + (row * spacing) - offsetY);
    });
    clearDeviceSelection();
  };

  const handleMouseDown = (e: any) => {
    // If clicked on Stage, global reset
    if (e.target === stageRef.current) handleGlobalEnd();

    if (!isDeleteMode) return;
    const stage = e.target.getStage();
    const pointer = stage?.getPointerPosition();
    if (pointer) {
        const transform = stage.getAbsoluteTransform().copy();
        transform.invert();
        const pos = transform.point(pointer);
        setSelectionBox({ startX: pos.x, startY: pos.y, endX: pos.x, endY: pos.y, visible: true });
    }
  };

  const handleMouseMove = (e: any) => {
    if (!isDeleteMode || !selectionBox?.visible) return;
    const stage = e.target.getStage();
    const pointer = stage?.getPointerPosition();
    if (pointer) {
        const transform = stage.getAbsoluteTransform().copy();
        transform.invert();
        const pos = transform.point(pointer);
        setSelectionBox({ ...selectionBox, endX: pos.x, endY: pos.y });
    }
  };

  const handleMouseUp = (e: any) => {
    handleGlobalEnd();
    if (!isDeleteMode || !selectionBox?.visible) return;
    const x1 = Math.min(selectionBox.startX, selectionBox.endX);
    const x2 = Math.max(selectionBox.startX, selectionBox.endX);
    const y1 = Math.min(selectionBox.startY, selectionBox.endY);
    const y2 = Math.max(selectionBox.startY, selectionBox.endY);
    const nodesToRemove: string[] = [];
    activeFloor.nodes.forEach((n: any) => { if (n.x >= x1 && n.x <= x2 && n.y >= y1 && n.y <= y2) nodesToRemove.push(n.id); });
    if (nodesToRemove.length > 0 && confirm(`Delete ${nodesToRemove.length} items?`)) {
        nodesToRemove.forEach(id => removeNodeFromFloor(activeFloor.id, id));
        setIsDeleteMode(false);
    }
    setSelectionBox(null);
  };

  const handleContextMenu = (evt: any, nodeId: string, description?: string, category?: string) => setPropertyModal({ visible: true, x: evt.clientX, y: evt.clientY, nodeId, currentDesc: description, currentCategory: category });

  // Callbacks for Nodes to ensure stability (FIX for Sticky Drag)
  const handleDragStartNode = useCallback((id: string) => {
      dragTargetRef.current = id;
      // Do NOT set state here (causes re-render which breaks drag)
  }, []);

  const handleDragEndNode = useCallback(() => {
      dragTargetRef.current = null;
  }, []);

  return (
    <div className="flex flex-col h-full bg-gray-100 relative">
      <div className="h-12 bg-white border-b border-gray-200 flex items-center px-4 gap-4 shadow-sm z-10">
        <div className="flex items-center gap-2"><Layers size={16} className="text-gray-500" /><select className="text-sm font-medium text-gray-700 bg-transparent border-none focus:ring-0 cursor-pointer" value={activeBuildingId || ''} onChange={(e) => { const bId = e.target.value; const b = buildings.find(b => b.id === bId); const fId = b?.floors[0]?.id || null; setActiveView(bId, fId); }}><option value="" disabled>Select Building</option>{buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
        <div className="h-4 w-px bg-gray-300"></div>
        <div className="flex items-center gap-2"><select className="text-sm font-medium text-gray-700 bg-transparent border-none focus:ring-0 cursor-pointer" value={activeFloorId || ''} onChange={(e) => setActiveView(activeBuildingId, e.target.value)} disabled={!activeBuildingId}>{!activeBuildingId ? <option>--</option> : !buildings.find(b=>b.id===activeBuildingId)?.floors.length ? <option>No Floors</option> : buildings.find(b=>b.id===activeBuildingId)?.floors.slice().reverse().map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></div>
        <div className="flex-1"></div>
        <button onClick={() => setIsDeleteMode(!isDeleteMode)} className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${isDeleteMode ? 'bg-red-100 text-red-600 border border-red-200 ring-2 ring-red-500/20' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{isDeleteMode ? <Eraser size={14} /> : <Trash2 size={14} />} {isDeleteMode ? 'Delete Mode ON' : 'Delete'}</button>
        <div className="flex items-center gap-4 text-xs text-gray-500">
            <div className="flex items-center gap-2"><span>Scale</span><input type="range" min="0.5" max="3" step="0.1" value={nodeScale} onChange={(e) => setNodeScale(parseFloat(e.target.value))} className="w-24 accent-indigo-600 cursor-pointer"/></div>
            <div className="flex items-center gap-2"><Type size={14} /><span>Font</span><input type="range" min="8" max="48" step="1" value={baseFontSize} onChange={(e) => setBaseFontSize(parseInt(e.target.value))} className="w-24 accent-indigo-600 cursor-pointer"/></div>
        </div>
      </div>

      <div className={`flex-1 overflow-hidden relative bg-gray-50 ${isDeleteMode ? 'cursor-not-allowed' : ''}`} onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}>
        {!activeFloor ? <div className="flex items-center justify-center h-full text-gray-400 text-sm">Select a floor to start editing</div> : (
          <>
            <Stage 
                width={window.innerWidth - 350} 
                height={window.innerHeight - 50} 
                draggable={!isDeleteMode && !dragTargetRef.current} 
                onWheel={handleWheel} 
                onMouseDown={handleMouseDown} 
                onMouseMove={handleMouseMove} 
                onMouseUp={handleMouseUp} 
                onMouseLeave={handleGlobalEnd} 
                onDragEnd={(e) => { 
                    // Only update store view state if stage itself was dragged
                    if (!dragTargetRef.current && !isDeleteMode) setViewState(e.target.x(), e.target.y(), e.target.scaleX()); 
                }} 
                ref={stageRef} 
                perfectDrawEnabled={false}
            >
                <Layer ref={layerRef}>
                {activeFloor.mapId && <FloorImage key={activeFloor.mapId} mapId={activeFloor.mapId} />}
                <Connections activeFloor={activeFloor} currentScale={stageScale} layerRef={layerRef} />
                <Nodes 
                    activeFloor={activeFloor} 
                    updatePosition={updateNodePosition} 
                    nodeScale={nodeScale} 
                    currentScale={stageScale} 
                    baseFontSize={baseFontSize} 
                    unassignedDevices={unassignedDevices} 
                    layerRef={layerRef} 
                    isDeleteMode={isDeleteMode} 
                    onRemove={(fid: string, nid: string) => { removeNodeFromFloor(fid, nid); setIsDeleteMode(false); }} 
                    onContextMenu={handleContextMenu}
                    onDragStart={handleDragStartNode}
                    onDragEnd={handleDragEndNode}
                />
                {selectionBox && selectionBox.visible && <Rect x={Math.min(selectionBox.startX, selectionBox.endX)} y={Math.min(selectionBox.startY, selectionBox.endY)} width={Math.abs(selectionBox.endX - selectionBox.startX)} height={Math.abs(selectionBox.endY - selectionBox.startY)} fill="rgba(255, 0, 0, 0.2)" stroke="red" strokeWidth={1 / viewState.scale} listening={false} />}
                </Layer>
            </Stage>
            
            {/* Property Modal */}
            {propertyModal.visible && (
                <div className="fixed inset-0 bg-black/20 z-[200] flex items-center justify-center" onClick={() => setPropertyModal({ ...propertyModal, visible: false })}>
                    <div className="bg-white rounded-lg shadow-xl p-6 w-80" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-gray-800 mb-4">Device Properties</h3>
                        <div className="mb-4">
                            <label className="block text-xs font-bold text-gray-500 mb-1">Alias / Description</label>
                            <input 
                                type="text" 
                                className="w-full p-2 border border-gray-300 rounded text-sm"
                                defaultValue={propertyModal.currentDesc || ''}
                                onBlur={(e) => {
                                    if(propertyModal.nodeId) {
                                       const val = e.target.value;
                                       if(val && val !== propertyModal.currentDesc) {
                                            const isUnique = useSiteStore.getState().checkDescriptionUnique(val, propertyModal.nodeId);
                                            if(!isUnique) { alert('Alias not unique'); return; }
                                            updateNodeDescription(activeFloor.id, propertyModal.nodeId, val);
                                       }
                                    }
                                }}
                            />
                        </div>
                        <div className="mb-4">
                            <label className="block text-xs font-bold text-gray-500 mb-1">Device Category</label>
                            <select 
                                className="w-full p-2 border border-gray-300 rounded text-sm bg-white"
                                defaultValue={propertyModal.currentCategory || ''}
                                onChange={(e) => {
                                    if(propertyModal.nodeId) {
                                        updateNodeCategory(activeFloor.id, propertyModal.nodeId, e.target.value);
                                    }
                                }}
                            >
                                <option value="">Default (Green Circle)</option>
                                <option value="heat-mult">Heat or Mult Detector</option>
                                <option value="smoke">Smoke Detector</option>
                                <option value="io-module">IO Module</option>
                                <option value="mcp">MCP</option>
                                <option value="sounder">Sounder</option>
                            </select>
                        </div>
                        <div className="flex justify-end">
                            <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm font-medium" onClick={() => setPropertyModal({ ...propertyModal, visible: false })}>Confirm</button>
                        </div>
                    </div>
                </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
