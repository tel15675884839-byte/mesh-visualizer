// --- Enums ---
export enum DeviceType {
  LEADER = 'LEADER',
  ROUTER = 'ROUTER',
  CHILD = 'CHILD'
}

export enum DeviceStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
  UNASSIGNED = 'UNASSIGNED'
}

// --- Interfaces ---

export interface Device {
  id: string;
  mac: string;
  type: DeviceType | string; // 兼容字符串形式
  status: DeviceStatus | string;
  loopId?: number;
  label?: string;
  role?: string; // 原始 HTML 数据中的角色
  ip?: string;
  
  // 坐标相关 (用于画布)
  x?: number;
  y?: number;
  floorId?: string;
}

export interface Edge {
  id?: string;
  sourceId: string;
  targetId: string;
  linkQuality?: number;
  rssi?: number;
}

export interface NetworkTopology {
  devices: Device[];
  edges: Edge[];
}

// 确保文件作为模块被处理
export const VERSION = '1.0.0';
export * from './managers/MeshManager';
