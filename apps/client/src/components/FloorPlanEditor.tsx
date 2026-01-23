
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Stage, Layer, Image as KonvaImage, Circle, Line, Text, Group, Label, Tag, Rect } from 'react-konva';
import Konva from 'konva';
import useImage from 'use-image';
import { useSiteStore } from '../store/useSiteStore';
import { useTopologyStore } from '../store/useTopologyStore';
import { getImage } from '../utils/storage';
import { Layers, ZoomIn, Trash2, Eraser, X, Pencil, Type } from 'lucide-react';

// --- Types & Constants ---
const STAGE_WIDTH_OFFSET = 350;
const DEBOUNCE_MS = 500;

// --- Helper: Debounce ---
function useDebounceCallback<T extends (...args: any[]) => void>(callback: T, delay: number) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  return useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      callback(...args);
    }, delay);
  }, [callback, delay]);
}

// --- Component: FloorImage ---
const FloorImage = React.memo(({ mapId }: { mapId: string }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    getImage(mapId).then((blob) => { 
        if (active && blob) setImageUrl(URL.createObjectURL(blob)); 
    });
    return () => { active = false; if (imageUrl) URL.revokeObjectURL(imageUrl); };
  }, [mapId]);
  const [image] = useImage(imageUrl || '');
  return image ? <KonvaImage image={image} listening={false} perfectDrawEnabled={false} /> : null;
}, (prev, next) => prev.mapId === next.mapId);


// --- Component: Connections ---
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

            // RSSI Parsing
            let rssiVal = 'N/A';
            if (e.rssi !== undefined) rssiVal = e.rssi;
            else if (e.linkQuality !== undefined) rssiVal = e.linkQuality;
            else if (e.title) {
                const match = e.title.match(/(-?\d+\s*dBm)/i) || e.title.match(/(?:RSSI|Signal)[:\s]*(-?\d+)/i);
                if (match) rssiVal = match[1];
            } else if (e.label) {
                rssiVal = e.label;
            }

            let displaySignal = String(rssiVal);
            if (!displaySignal.includes('dBm') && !isNaN(parseInt(displaySignal))) displaySignal += ' dBm';

            validEdges.push({ id: `edge-${u}-${v}`, u, v, color, rssi: displaySignal });
        }
    });
    return validEdges;
  }, [edges, activeFloor.nodes, unassignedDevices]);

  const getPos = (id: string) => activeFloor.nodes.find((n: any) => n.id === id) || { x: 0, y: 0 };
  const strokeWidth = Math.max(1, 2 / currentScale);

  return (
    <Group>
      {connectionData.map((edge) => {
        const p1 = getPos(edge.u);
        const p2 = getPos(edge.v);
        const points = [p1.x, p1.y, p2.x, p2.y];

        return (
          <Group key={edge.id} id={edge.id}>
             <Line
                points={points}
                stroke="transparent"
                strokeWidth={15 / currentScale}
                onMouseEnter={(e) => { const c = e.target.getStage()?.container(); if(c) c.style.cursor = 'pointer'; }}
                onMouseLeave={(e) => { const c = e.target.getStage()?.container(); if(c) c.style.cursor = 'default'; }}
                onClick={(e) => {
                    e.cancelBubble = true;
                    const stage = e.target.getStage();
                    const pointer = stage?.getPointerPosition();
                    if (pointer) {
                        const transform = stage.getAbsoluteTransform().copy();
                        transform.invert();
                        const pos = transform.point(pointer);
                        if (tooltip?.text === edge.rssi) setTooltip(null);
                        else setTooltip({ x: pos.x, y: pos.y, text: edge.rssi });
                    }
                }}
                name="hit-line"
             />
             <Line points={points} stroke="white" strokeWidth={strokeWidth + 2} opacity={0.8} listening={false} perfectDrawEnabled={false} name="outline-line" />
             <Line points={points} stroke={edge.color} strokeWidth={strokeWidth} listening={false} perfectDrawEnabled={false} name="color-line" dash={[10/currentScale, 5/currentScale]} />
             
             {tooltip && tooltip.text === edge.rssi && (
                 <Label x={tooltip.x} y={tooltip.y} listening={false}>
                    <Tag fill="#1f2937" pointerDirection="down" pointerWidth={10/currentScale} pointerHeight={10/currentScale} cornerRadius={4/currentScale} opacity={0.9} />
                    <Text text={tooltip.text} fontSize={12/currentScale} padding={6/currentScale} fill="white" align="center" />
                 </Label>
             )}
          </Group>
        );
      })}
    </Group>
  );
});


// --- Component: Nodes ---
const Nodes = React.memo(({ 
    activeFloor, 
    updatePosition, 
    nodeScale, 
    currentScale, 
    baseFontSize, 
    unassignedDevices,
    layerRef,
    isDeleteMode,
    highlightedId, // NEW Prop for Highlight
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

  // Imperative Line Update
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
              const isStart = id.startsWith(`edge-${nodeId}-`);
              const isEnd = id.endsWith(`-${nodeId}`);

              if (isStart) { newPoints[0] = x; newPoints[1] = y; } 
              else if (isEnd) { newPoints[2] = x; newPoints[3] = y; } 
              else continue;

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
        const isHighlighted = node.id === highlightedId; // Highlight Check
        
        const baseRadius = 10 * nodeScale;
        const constantTextScale = (1 / currentScale); 
        
        const labelText = node.description ? node.description : node.id.slice(-4);

        return (
          <Group
            key={node.id}
            id={`node-${node.id}`}
            x={node.x}
            y={node.y}
            draggable={!isDeleteMode && !isMissing}
            opacity={isMissing ? 0.6 : 1}
            onClick={(e) => {
                if (isDeleteMode) {
                    e.cancelBubble = true;
                    onRemove(activeFloor.id, node.id);
                }
            }}
            onContextMenu={(e) => {
                e.evt.preventDefault();
                e.cancelBubble = true;
                onContextMenu(e.evt, node.id, node.description);
            }}
            onDragStart={(e) => { 
                e.cancelBubble = true; 
                if(!isMissing) onDragStart(node.id); 
            }}
            onDragMove={(e) => {
                e.cancelBubble = true;
                const newX = e.target.x();
                const newY = e.target.y();
                if(!isMissing) updateConnectedLines(node.id, newX, newY);
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
            <Circle 
                radius={baseRadius} 
                fill={isMissing ? '#9ca3af' : getColor(role)} 
                // Enhanced Stroke for Highlight
                stroke={isDeleteMode ? 'red' : (isHighlighted ? '#06b6d4' : (isMissing ? '#4b5563' : 'white'))} 
                strokeWidth={(isDeleteMode ? 3 : (isHighlighted ? 5 : 2)) / currentScale} 
                // Enhanced Shadow for Highlight
                shadowColor={isHighlighted ? '#06b6d4' : 'black'}
                shadowBlur={(isHighlighted ? 20 : (isMissing ? 0 : 2)) / currentScale} 
                shadowOpacity={isHighlighted ? 0.8 : 0.3}
                perfectDrawEnabled={false}
                dash={isMissing ? [5, 5] : undefined}
            />
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
                listening={false}
            perfectDrawEnabled={false}
            />
            {isMissing && <Text y={-baseRadius - (15/currentScale)} text="?" fontSize={14/currentScale} fill="red" fontStyle="bold" align="center" offsetX={4} listening={false}
            perfectDrawEnabled={false} />}
          </Group>
        );
      })}
    </Group>
  );
});


// --- Main Component: FloorPlanEditor ---
export const FloorPlanEditor = () => {
  const { buildings, activeBuildingId, activeFloorId, setActiveView, getActiveFloor, updateNodePosition, updateNodeDescription, removeNodeFromFloor, nodeScale, setNodeScale, baseFontSize, setBaseFontSize, viewState, setViewState } = useSiteStore();
  const { unassignedDevices, clearDeviceSelection } = useTopologyStore();
  const activeFloor = getActiveFloor();
  const stageRef = useRef<Konva.Stage>(null);
  const layerRef = useRef<Konva.Layer>(null);
  const dragTargetRef = useRef<string | null>(null);

  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [selectionBox, setSelectionBox] = useState<{ startX: number, startY: number, endX: number, endY: number, visible: boolean } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ visible: boolean, x: number, y: number, nodeId: string | null, currentDesc?: string }>({ visible: false, x: 0, y: 0, nodeId: null });
  const [isDraggingNode, setIsDraggingNode] = useState(false);
  // NEW: Highlight State
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const debouncedSetView = useDebounceCallback((x: number, y: number, scale: number) => { setViewState(x, y, scale); }, DEBOUNCE_MS);
  const { x: stageX, y: stageY, scale: stageScale } = viewState;

  // Global Drag Reset
  const handleGlobalEnd = () => {
      dragTargetRef.current = null;
      if (isDraggingNode) setIsDraggingNode(false);
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
          
          // SET HIGHLIGHT & Auto-clear
          if (e.detail.id) {
              setHighlightedId(e.detail.id);
              setTimeout(() => setHighlightedId(null), 3000);
          }

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

              if (progress < 1) {
                  requestAnimationFrame(animate);
              } else {
                  setViewState(newX, newY, newScale);
              }
          };
          requestAnimationFrame(animate);
      };

      window.addEventListener('FOCUS_NODE', handleFocusEvent);
      return () => window.removeEventListener('FOCUS_NODE', handleFocusEvent);
  }, [setViewState]);

  // Wheel Logic
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
    setContextMenu({...contextMenu, visible:false});
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
    setContextMenu({...contextMenu, visible:false});
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
    if (nodesToRemove.length > 0 && confirm(`Delete ${nodesToRemove.length} items?`)) nodesToRemove.forEach(id => removeNodeFromFloor(activeFloor.id, id));
    setSelectionBox(null);
  };

  const handleContextMenu = (evt: any, nodeId: string, description?: string) => setContextMenu({ visible: true, x: evt.clientX, y: evt.clientY, nodeId, currentDesc: description });
  const handleDeleteFromContext = () => { if (contextMenu.nodeId) { removeNodeFromFloor(activeFloor.id, contextMenu.nodeId); setContextMenu({ ...contextMenu, visible: false }); }};
  const handleSetDescription = () => {
      if (contextMenu.nodeId) {
          const desc = prompt("Enter device description (Alias):", contextMenu.currentDesc || "");
          if (desc !== null) {
              const isUnique = useSiteStore.getState().checkDescriptionUnique(desc, contextMenu.nodeId);
              if (!isUnique) { alert(`Alias "${desc}" is already in use.`); return; }
              updateNodeDescription(activeFloor.id, contextMenu.nodeId, desc);
          }
          setContextMenu({ ...contextMenu, visible: false });
      }
  };

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
            <div className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded"><ZoomIn size={14}/> <span>{(stageScale * 100).toFixed(0)}%</span></div>
        </div>
      </div>

      <div className={`flex-1 overflow-hidden relative bg-gray-50 ${isDeleteMode ? 'cursor-not-allowed' : ''}`} onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}>
        {!activeFloor ? <div className="flex items-center justify-center h-full text-gray-400 text-sm">Select a floor to start editing</div> : (
          <>
            <Stage width={window.innerWidth - 350} height={window.innerHeight - 50} draggable={!isDraggingNode && !isDeleteMode} onWheel={handleWheel} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleGlobalEnd} onDragEnd={(e) => { if (!isDraggingNode && !isDeleteMode) setViewState(e.target.x(), e.target.y(), e.target.scaleX()); }} ref={stageRef} perfectDrawEnabled={false}>
                <Layer ref={layerRef}>
                {activeFloor.mapId && <FloorImage key={activeFloor.mapId} mapId={activeFloor.mapId} />}
                <Connections activeFloor={activeFloor} currentScale={stageScale} layerRef={layerRef} dragOverride={null} />
                <Nodes 
                    activeFloor={activeFloor} 
                    updatePosition={updateNodePosition} 
                    nodeScale={nodeScale} 
                    currentScale={stageScale} 
                    baseFontSize={baseFontSize} 
                    unassignedDevices={unassignedDevices} 
                    layerRef={layerRef} 
                    isDeleteMode={isDeleteMode} 
                    highlightedId={highlightedId} // NEW Prop
                    onRemove={removeNodeFromFloor} 
                    onContextMenu={handleContextMenu}
                    onDragStart={(id: string) => { 
                        setIsDraggingNode(true);
                        dragTargetRef.current = id;
                    }}
                    onDragEnd={() => { 
                        setIsDraggingNode(false);
                        dragTargetRef.current = null;
                    }}
                />
                {selectionBox && selectionBox.visible && <Rect x={Math.min(selectionBox.startX, selectionBox.endX)} y={Math.min(selectionBox.startY, selectionBox.endY)} width={Math.abs(selectionBox.endX - selectionBox.startX)} height={Math.abs(selectionBox.endY - selectionBox.startY)} fill="rgba(255, 0, 0, 0.2)" stroke="red" strokeWidth={1 / viewState.scale} listening={false} />}
                </Layer>
            </Stage>
            {contextMenu.visible && (
                <div style={{ position: 'fixed', top: contextMenu.y, left: contextMenu.x, zIndex: 100 }} className="bg-white border border-gray-200 shadow-lg rounded-md overflow-hidden min-w-[140px]">
                    <div className="px-4 py-2 hover:bg-gray-50 text-gray-700 text-sm cursor-pointer flex items-center gap-2" onClick={handleSetDescription}><Pencil size={14} /> Set Alias</div>
                    <div className="px-4 py-2 hover:bg-red-50 text-red-600 text-sm cursor-pointer flex items-center gap-2" onClick={handleDeleteFromContext}><Trash2 size={14} /> Delete</div>
                    <div className="px-4 py-2 hover:bg-gray-50 text-gray-600 text-sm cursor-pointer border-t border-gray-100 flex items-center gap-2" onClick={() => setContextMenu({ ...contextMenu, visible: false })}><X size={14} /> Cancel</div>
                </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
