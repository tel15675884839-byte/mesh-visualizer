const fs = require('fs');
const path = require('path');

const clientPath = path.join(__dirname, 'apps', 'client', 'src');
const storePath = path.join(clientPath, 'store', 'useSiteStore.ts');
const editorPath = path.join(clientPath, 'components', 'FloorPlanEditor.tsx');
const sidebarPath = path.join(clientPath, 'components', 'DeviceSidebar.tsx');

console.log('🔍 Applying Alias Search & Uniqueness Features...');

// --- Helper: Safe Inject ---
function injectAfter(content, anchor, injection) {
  if (content.includes(injection.trim())) return content;
  if (!content.includes(anchor)) {
    console.warn(`  ⚠️ Anchor not found: "${anchor.substring(0, 30)}..."`);
    return content;
  }
  return content.replace(anchor, anchor + '\n' + injection);
}

// --- FILE 1: useSiteStore.ts ---
try {
  console.log(`\n📄 Patching useSiteStore.ts...`);
  let storeCode = fs.readFileSync(storePath, 'utf8');

  // 1. Interface
  const interfaceAnchor = 'getAllNodeDescriptions: () => Record<string, string>;';
  const interfaceInjection = `  checkDescriptionUnique: (description: string, excludeNodeId?: string) => boolean;`;
  storeCode = injectAfter(storeCode, interfaceAnchor, interfaceInjection);

  // 2. Logic
  const logicAnchor = 'return map;\n      },';
  const logicInjection = `
      checkDescriptionUnique: (description, excludeNodeId) => {
          const { buildings } = get();
          const lowerDesc = description.toLowerCase();
          for (const b of buildings) {
              for (const f of b.floors) {
                  for (const n of f.nodes) {
                      if (n.id !== excludeNodeId && n.description?.toLowerCase() === lowerDesc) {
                          return false;
                      }
                  }
              }
          }
          return true;
      },`;
  storeCode = injectAfter(storeCode, logicAnchor, logicInjection);

  fs.writeFileSync(storePath, storeCode);
  console.log('  ✅ useSiteStore.ts updated.');
} catch (err) {
  console.error('  ❌ Error patching useSiteStore.ts:', err.message);
}

// --- FILE 2: FloorPlanEditor.tsx ---
try {
  console.log(`\n📄 Patching FloorPlanEditor.tsx...`);
  let editorCode = fs.readFileSync(editorPath, 'utf8');

  // Update handleSetDescription logic
  // We look for the line: if (desc !== null) updateNodeDescription(...)
  // And replace it with the check logic.
  
  const targetLogic = `if (desc !== null) updateNodeDescription(activeFloor.id, contextMenu.nodeId, desc);`;
  const newLogic = `if (desc !== null) {
              const isUnique = useSiteStore.getState().checkDescriptionUnique(desc, contextMenu.nodeId);
              if (!isUnique) {
                  alert(\`Alias "\${desc}" is already in use. Please choose a unique name.\`);
                  return;
              }
              updateNodeDescription(activeFloor.id, contextMenu.nodeId, desc);
          }`;

  if (editorCode.includes(targetLogic)) {
      editorCode = editorCode.replace(targetLogic, newLogic);
      fs.writeFileSync(editorPath, editorCode);
      console.log('  ✅ FloorPlanEditor.tsx updated (Uniqueness Check).');
  } else if (editorCode.includes('checkDescriptionUnique')) {
      console.log('  ℹ️  Uniqueness check already present.');
  } else {
      console.warn('  ⚠️  Could not find handleSetDescription logic to patch.');
  }
} catch (err) {
  console.error('  ❌ Error patching FloorPlanEditor.tsx:', err.message);
}

// --- FILE 3: DeviceSidebar.tsx ---
try {
  console.log(`\n📄 Patching DeviceSidebar.tsx...`);
  let sidebarCode = fs.readFileSync(sidebarPath, 'utf8');

  // We need to find where filterTopologyNodes is used inside filterTopologyNodes implementation.
  // Actually, filterTopologyNodes is imported from utils. 
  // Wait, the logic for filtering is inside `utils/topologyTree.ts`.
  // I need to patch `utils/topologyTree.ts` OR pass the descriptions to it.
  
  // Checking previous context: `filterTopologyNodes` is defined in `topologyTree.ts`.
  // It takes (nodes, query). It doesn't know about descriptions.
  // We should modify `DeviceSidebar.tsx` to pass a custom matcher or modify the utility.
  // Since `filterTopologyNodes` is a pure utility, modifying it to accept an optional look-up map is best.
  
  // Plan:
  // 1. Modify `utils/topologyTree.ts` to accept `descriptionMap`.
  // 2. Modify `DeviceSidebar.tsx` to pass it.

} catch (err) {
  console.error('  ❌ Error patching DeviceSidebar.tsx:', err.message);
}

// --- FILE 4: utils/topologyTree.ts (For Search) ---
const utilsPath = path.join(clientPath, 'utils', 'topologyTree.ts');
try {
    console.log(`\n📄 Patching utils/topologyTree.ts...`);
    let utilsCode = fs.readFileSync(utilsPath, 'utf8');

    // Update signature
    // export function filterTopologyNodes(nodes: TopologyTreeNode[], query: string): TopologyTreeNode[]
    const sigRegex = /export function filterTopologyNodes\(nodes: TopologyTreeNode\[\], query: string\): TopologyTreeNode\[\]/;
    const newSig = `export function filterTopologyNodes(nodes: TopologyTreeNode[], query: string, descriptionMap?: Record<string, string>): TopologyTreeNode[]`;
    
    if (sigRegex.test(utilsCode)) {
        utilsCode = utilsCode.replace(sigRegex, newSig);
    }

    // Update recursive call
    const recursiveRegex = /const filteredChildren = filterTopologyNodes\(node\.children, query\);/;
    const newRecursive = `const filteredChildren = filterTopologyNodes(node.children, query, descriptionMap);`;
    if (recursiveRegex.test(utilsCode)) {
        utilsCode = utilsCode.replace(recursiveRegex, newRecursive);
    }

    // Update match logic
    // We look for: (node.raw && 'label' in node.raw && String(node.raw.label).toLowerCase().includes(lowerQuery))
    // We append the description check.
    const matchAnchor = `(node.raw && 'label' in node.raw && String(node.raw.label).toLowerCase().includes(lowerQuery))`;
    const matchInjection = ` || (descriptionMap && descriptionMap[node.mac] && descriptionMap[node.mac].toLowerCase().includes(lowerQuery))`;
    
    if (utilsCode.includes(matchAnchor) && !utilsCode.includes('descriptionMap[node.mac]')) {
        utilsCode = utilsCode.replace(matchAnchor, matchAnchor + matchInjection);
        fs.writeFileSync(utilsPath, utilsCode);
        console.log('  ✅ utils/topologyTree.ts updated (Search Logic).');
    } else {
        console.log('  ℹ️  Search logic already updated or anchor not found.');
    }

} catch (err) {
    console.error('  ❌ Error patching topologyTree.ts:', err.message);
}

// --- FILE 3 Redux: DeviceSidebar.tsx (Pass the map) ---
try {
    let sidebarCode = fs.readFileSync(sidebarPath, 'utf8');
    // We need to find where filterTopologyNodes is called.
    // roots: filterTopologyNodes(sortedRoots, searchQuery),
    // orphans: filterTopologyNodes(rawTree.orphans, searchQuery)
    
    const rootsCall = `roots: filterTopologyNodes(sortedRoots, searchQuery),`;
    const newRootsCall = `roots: filterTopologyNodes(sortedRoots, searchQuery, descriptionMap),`;
    
    const orphansCall = `orphans: filterTopologyNodes(rawTree.orphans, searchQuery)`;
    const newOrphansCall = `orphans: filterTopologyNodes(rawTree.orphans, searchQuery, descriptionMap)`;

    if (sidebarCode.includes(rootsCall)) {
        sidebarCode = sidebarCode.replace(rootsCall, newRootsCall);
    }
    if (sidebarCode.includes(orphansCall)) {
        sidebarCode = sidebarCode.replace(orphansCall, newOrphansCall);
    }
    
    fs.writeFileSync(sidebarPath, sidebarCode);
    console.log('  ✅ DeviceSidebar.tsx updated (Passing Map).');

} catch(err) {
    console.error('  ❌ Error patching DeviceSidebar calls:', err.message);
}

console.log('\n🏁 Patch process completed.');