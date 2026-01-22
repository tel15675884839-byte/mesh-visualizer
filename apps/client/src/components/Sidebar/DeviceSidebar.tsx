
import { useStore } from '../../store/useStore';
import { Router, Hexagon, Circle, Box } from 'lucide-react';

export function DeviceSidebar() {
  const { topology } = useStore();
  
  // 简单逻辑：只展示未分配的设备，不搞递归
  const unassigned = topology?.devices.filter(d => !d.slotId) || [];

  const handleDragStart = (e: React.DragEvent, mac: string, type: string) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ mac, type }));
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="w-72 h-full bg-white border-r border-gray-200 flex flex-col shadow-lg z-10 shrink-0 select-none">
      <div className="p-4 border-b border-gray-100 bg-gray-50">
        <h2 className="font-bold text-gray-800 flex items-center gap-2">
          <Box className="w-4 h-4 text-blue-600" />
          Pending Devices
          <span className="ml-auto text-xs bg-gray-200 px-2 py-0.5 rounded text-gray-600">
            {unassigned.length}
          </span>
        </h2>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {unassigned.length === 0 ? (
          <div className="text-center text-gray-400 text-sm mt-10">No pending devices</div>
        ) : (
          unassigned.map(device => (
            <div 
              key={device.id || device.mac}
              className="p-3 bg-white border border-gray-100 rounded-lg shadow-sm hover:border-blue-300 hover:shadow-md cursor-grab active:cursor-grabbing group transition-all"
              draggable
              onDragStart={(e) => handleDragStart(e, device.mac, device.type)}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-xs font-semibold text-gray-700 truncate" title={device.mac}>
                  {device.mac}
                </span>
                <DeviceIcon type={device.type} />
              </div>
              <div className="text-[10px] text-gray-400 flex justify-between">
                <span>{device.type}</span>
                <span>Loop {device.loopId}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function DeviceIcon({ type }: { type: string }) {
  const t = (type || '').toUpperCase();
  if (t === 'LEADER') return <Hexagon className="w-4 h-4 text-red-500 fill-red-50" />;
  if (t === 'ROUTER') return <Router className="w-4 h-4 text-blue-500" />;
  return <Circle className="w-3 h-3 text-green-500 fill-green-50" />;
}
