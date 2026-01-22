
import { Stage, Layer, Rect, Circle, Text, Group } from 'react-konva';
import { useStore } from '../../store/useStore';
import { useEffect, useState, useRef } from 'react';
import type Konva from 'konva';

export function TopologyMap() {
  const { topology, deployDevice } = useStore();
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const stageRef = useRef<Konva.Stage>(null);
  
  // 只渲染已部署的
  const deployedDevices = topology?.devices.filter(d => d.slotId && d.slot) || [];
  const currentFloorId = topology?.floors[0]?.id;

  useEffect(() => {
    const handleResize = () => {
      const container = document.getElementById('canvas-container');
      if (container) setSize({ width: container.offsetWidth, height: container.offsetHeight });
    };
    window.addEventListener('resize', handleResize);
    handleResize(); 
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (!currentFloorId) { alert("Please import data first"); return; }

    const stage = stageRef.current;
    if (!stage) return;

    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    // 基础坐标计算 (无缩放逻辑)
    const x = pointer.x;
    const y = pointer.y;

    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      if (data.mac) {
        await deployDevice(data.mac, x, y, currentFloorId);
      }
    } catch (err) {}
  };

  return (
    <div id="canvas-container" className="flex-1 h-full bg-gray-50 relative overflow-hidden" 
         onDragOver={(e) => e.preventDefault()} 
         onDrop={handleDrop}>
      <Stage ref={stageRef} width={size.width} height={size.height}>
        <Layer>
          {/* 背景网格 */}
          <Rect x={0} y={0} width={size.width} height={size.height} fill="#f8fafc" stroke="#e2e8f0" strokeWidth={1} />
          
          {/* 设备节点 */}
          {deployedDevices.map(device => (
            <DeviceNode key={device.id} x={device.slot!.x} y={device.slot!.y} type={device.type} mac={device.mac} />
          ))}
        </Layer>
      </Stage>
      <div className="absolute bottom-4 right-4 bg-white/80 px-3 py-1 text-xs text-gray-500 rounded">
        Basic Drag & Drop Mode
      </div>
    </div>
  );
}

function DeviceNode({ x, y, type, mac }: any) {
  const t = (type || '').toUpperCase();
  const color = t === 'LEADER' ? '#ef4444' : (t === 'ROUTER' ? '#3b82f6' : '#22c55e');
  return (
    <Group x={x} y={y} draggable>
      <Circle radius={15} fill={color} opacity={0.2} />
      <Circle radius={6} fill={color} stroke="white" strokeWidth={2} />
      <Text text={mac.slice(-4)} y={10} x={-20} width={40} align="center" fontSize={10} fill="#555" />
    </Group>
  );
}
