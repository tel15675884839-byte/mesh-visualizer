
// --- Types ---
export interface Device {
  id: string;
  mac: string;
  type: string;
  role?: string;
  label?: string;
  status?: string;
  loopId?: number;
  [key: string]: any;
}
export interface Edge {
  id?: string;
  sourceId: string;
  targetId: string;
  rssi?: number;
  linkQuality?: number;
  [key: string]: any;
}
export interface RawNode {
  id: string | number;
  role: string;
  mac?: string;
  label?: string;
  [key: string]: any;
}
export interface RawEdge {
  from: string | number;
  to: string | number;
  rssi?: number;
  linkQuality?: number;
  [key: string]: any;
}
export interface TopologyTreeNode {
  id: string;
  mac: string;
  role: 'LEADER' | 'ROUTER' | 'CHILD';
  level: number;
  children: TopologyTreeNode[];
  uplinkRssi?: number;
  raw?: RawNode | Device;
  forceExpand?: boolean; 
}
export interface TreeResult {
  roots: TopologyTreeNode[];
  orphans: TopologyTreeNode[];
}

const normalizeRole = (roleStr: string): 'LEADER' | 'ROUTER' | 'CHILD' => {
  const r = (roleStr || '').toLowerCase();
  if (r.includes('leader')) return 'LEADER';
  if (r.includes('router') || r === 'node') return 'ROUTER';
  return 'CHILD';
};

export function validateMacConflicts(allDevices: Device[], newDevices: any[], targetLoopId: number): string | null {
  const otherLoopDevices = allDevices.filter(d => d.loopId !== targetLoopId);
  const existingMacs = new Set(otherLoopDevices.map(d => d.mac.toLowerCase()));
  for (const newDev of newDevices) {
    if (newDev.mac && existingMacs.has(newDev.mac.toLowerCase())) {
      const conflict = otherLoopDevices.find(d => d.mac.toLowerCase() === newDev.mac.toLowerCase());
      return `MAC Conflict: ${newDev.mac} already exists in Loop ${conflict?.loopId}`;
    }
  }
  return null;
}

// --- Helper to flatten the backbone ---
// Takes a hierarchical tree and pulls all Routers to the top level
function flattenBackbone(nodes: TopologyTreeNode[]): TopologyTreeNode[] {
    const flatRoots: TopologyTreeNode[] = [];

    const traverse = (node: TopologyTreeNode) => {
        // Clone node to avoid mutating original references too much
        const newNode: TopologyTreeNode = {
            ...node,
            children: [] // Reset children, we will fill them with ONLY Children
        };

        // If it's a Leader or Router, it goes to Flat Roots
        if (node.role === 'LEADER' || node.role === 'ROUTER') {
            flatRoots.push(newNode);
        }

        // Process original children
        if (node.children && node.children.length > 0) {
            node.children.forEach(child => {
                if (child.role === 'CHILD') {
                    // Child nodes stay with their current parent (which is newNode)
                    newNode.children.push(child);
                    // We don't recurse into CHILD nodes (they are leaves)
                } else {
                    // It's a Router (or nested Leader?), recurse to pull it up
                    traverse(child);
                }
            });
        }
    };

    nodes.forEach(n => traverse(n));
    return flatRoots;
}

export function buildTopologyTree(nodes: (RawNode | Device)[], edges: (RawEdge | Edge)[]): TreeResult {
  if (!Array.isArray(nodes) || !Array.isArray(edges)) return { roots: [], orphans: [] };

  const nodeMap = new Map<string, RawNode | Device>();
  const adjList = new Map<string, Set<string>>();
  const edgeDataMap = new Map<string, RawEdge | Edge>();
  const rawIdMap = new Map<string, string>(); 

  nodes.forEach(n => {
    const mac = 'mac' in n ? (n as Device).mac : ((n as RawNode).mac || String((n as RawNode).id));
    if (!mac) return;
    const rawId = String((n as any).id); 
    nodeMap.set(mac, n);
    adjList.set(mac, new Set());
    if (rawId && rawId !== 'undefined') rawIdMap.set(rawId, mac);
    rawIdMap.set(mac, mac); 
  });

  edges.forEach(e => {
    const uRaw = String((e as any).from ?? (e as any).sourceId);
    const vRaw = String((e as any).to ?? (e as any).targetId);
    const u = rawIdMap.get(uRaw);
    const v = rawIdMap.get(vRaw);
    if (!u || !v) return;
    edgeDataMap.set(`${u}_${v}`, e);
    edgeDataMap.set(`${v}_${u}`, e);
    if (nodeMap.has(u) && nodeMap.has(v)) {
      adjList.get(u)?.add(v);
      adjList.get(v)?.add(u);
    }
  });

  const visited = new Set<string>();
  
  // Phase 1: Build Full Hierarchy (Logical Tree)
  const buildNode = (parentId: string, currentLevel: number): TopologyTreeNode | null => {
    const rawNode = nodeMap.get(parentId);
    if (!rawNode) return null;
    visited.add(parentId);
    
    const roleStr = 'type' in rawNode ? (rawNode as Device).type : (rawNode as RawNode).role;
    const role = normalizeRole(roleStr);
    const mac = 'mac' in rawNode ? (rawNode as Device).mac : ((rawNode as RawNode).mac || String((rawNode as RawNode).label) || parentId);

    const treeNode: TopologyTreeNode = {
      id: parentId,
      mac,
      role,
      level: currentLevel,
      children: [],
      raw: rawNode 
    };

    const neighbors = adjList.get(parentId);
    if (neighbors) {
      const sortedNeighbors = Array.from(neighbors).sort();
      for (const childId of sortedNeighbors) {
        if (!visited.has(childId)) {
          const rawChild = nodeMap.get(childId)!;
          const childRoleStr = 'type' in rawChild ? (rawChild as Device).type : (rawChild as RawNode).role;
          const childRole = normalizeRole(childRoleStr);
          if (childRole === 'LEADER') continue;
          if (role === 'CHILD') continue;

          const childNode = buildNode(childId, currentLevel + 1);
          if (childNode) {
             const edge = edgeDataMap.get(`${parentId}_${childId}`);
             let rssi: number | undefined = undefined;
             if (edge) {
                 rssi = 'rssi' in edge ? edge.rssi : (edge as any).linkQuality;
             }
             childNode.uplinkRssi = rssi;
             treeNode.children.push(childNode);
          }
        }
      }
    }
    return treeNode;
  };

  const logicalRoots: TopologyTreeNode[] = [];
  nodes.forEach(n => {
    const roleStr = 'type' in n ? (n as Device).type : (n as RawNode).role;
    if (normalizeRole(roleStr) === 'LEADER') {
      const mac = 'mac' in n ? (n as Device).mac : ((n as RawNode).mac || String((n as RawNode).id));
      const rootNode = buildNode(mac, 0); 
      if (rootNode) logicalRoots.push(rootNode);
    }
  });

  // Orphans
  const orphans: TopologyTreeNode[] = [];
  nodes.forEach(n => {
    const mac = 'mac' in n ? (n as Device).mac : ((n as RawNode).mac || String((n as RawNode).id));
    if (!visited.has(mac)) {
      const roleStr = 'type' in n ? (n as Device).type : (n as RawNode).role;
      orphans.push({
        id: mac, mac, role: normalizeRole(roleStr), level: -1, children: [], raw: n
      });
    }
  });

  // Phase 2: Flatten Backbone (Leader/Routers to Level 1, Children nested)
  // We process logicalRoots to extract all backbone nodes
  const flattenedRoots = flattenBackbone(logicalRoots);

  // Note: Orphans usually contain disconnected Routers/Children. 
  // If an Orphan is a Router, it should also be in Roots technically, but since it's disconnected,
  // we leave it in Orphans for now to indicate "Issue".
  // UNLESS the user wants *all* Routers in the main list. 
  // For now, let's keep Orphans separate as "Unlinked".

  return { roots: flattenedRoots, orphans };
}

export function filterTopologyNodes(nodes: TopologyTreeNode[], query: string, descriptionMap?: Record<string, string>): TopologyTreeNode[] {
  if (!query) return nodes;
  const lowerQuery = query.toLowerCase();
  return nodes.reduce((acc: TopologyTreeNode[], node) => {
    const filteredChildren = filterTopologyNodes(node.children, query, descriptionMap);
    const selfMatches = (
      node.mac.toLowerCase().includes(lowerQuery) || 
      node.role.toLowerCase().includes(lowerQuery) ||
      (node.raw && 'label' in node.raw && String(node.raw.label).toLowerCase().includes(lowerQuery)) || (descriptionMap && descriptionMap[node.mac] && descriptionMap[node.mac].toLowerCase().includes(lowerQuery))
    );
    if (selfMatches || filteredChildren.length > 0) {
      acc.push({ ...node, children: filteredChildren, forceExpand: filteredChildren.length > 0 }); 
    }
    return acc;
  }, []);
}
