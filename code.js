const fs = require('fs');
const path = require('path');

// 路径配置
const clientPath = path.join(__dirname, 'apps', 'client', 'src');
const storePath = path.join(clientPath, 'store', 'useSiteStore.ts');
const sidebarPath = path.join(clientPath, 'components', 'DeviceSidebar.tsx');

console.log('💉 Applying Surgical Patch for Device Descriptions...');

// --- 辅助函数：安全注入 ---
function injectAfter(content, anchor, injection) {
  if (content.includes(injection.trim())) {
    console.log(`  ℹ️  Code already present. Skipping injection after "${anchor.substring(0, 20)}..."`);
    return content;
  }
  if (!content.includes(anchor)) {
    console.warn(`  ⚠️  Anchor not found: "${anchor}". Manual check required.`);
    return content;
  }
  return content.replace(anchor, anchor + '\n' + injection);
}

// --- FILE 1: useSiteStore.ts ---
try {
  console.log(`\n📄 Patching useSiteStore.ts...`);
  let storeCode = fs.readFileSync(storePath, 'utf8');

  // 1. Interface Update
  // 寻找接口定义中的 getActiveFloor，在其后添加定义
  const interfaceAnchor = 'getActiveFloor: () => Floor | undefined;';
  const interfaceInjection = `  findNodeDescription: (nodeId: string) => string | undefined;`;
  
  if (storeCode.includes(interfaceAnchor)) {
      storeCode = injectAfter(storeCode, interfaceAnchor, interfaceInjection);
  } else {
      // 备选方案：如果在接口末尾
      storeCode = storeCode.replace(/interface SiteStore \{[\s\S]*?\n\}/, (match) => {
          if (match.includes('findNodeDescription')) return match;
          return match.replace(/\n\}/, `\n${interfaceInjection}\n}`);
      });
  }

  // 2. Logic Update
  // 寻找 reset 方法，在其前方插入实现逻辑
  const logicAnchor = 'reset: () => set({'; 
  const logicInjection = `
      findNodeDescription: (nodeId) => {
        const { buildings } = get();
        for (const b of buildings) {
          for (const f of b.floors) {
            const node = f.nodes.find((n) => n.id === nodeId);
            if (node && node.description) return node.description;
          }
        }
        return undefined;
      },
  `;

  if (storeCode.includes(logicAnchor)) {
      // 在 reset 之前插入，保持格式整洁
      if (!storeCode.includes('findNodeDescription: (nodeId) => {')) {
          storeCode = storeCode.replace(logicAnchor, `${logicInjection.trim()}\n\n      ${logicAnchor}`);
      } else {
          console.log(`  ℹ️  Logic implementation already present.`);
      }
  } else {
      console.warn('  ⚠️  Could not find insertion point "reset:" in useSiteStore.');
  }

  fs.writeFileSync(storePath, storeCode);
  console.log('  ✅ useSiteStore.ts updated.');
} catch (err) {
  console.error('  ❌ Error patching useSiteStore.ts:', err.message);
}

// --- FILE 2: DeviceSidebar.tsx ---
try {
  console.log(`\n📄 Patching DeviceSidebar.tsx...`);
  let sidebarCode = fs.readFileSync(sidebarPath, 'utf8');

  // 1. Logic Injection inside TreeNode
  // 定位 TreeNode 组件的开始
  const treeNodeStart = 'const TreeNode = ({ node, selectedIds, toggleSelect, clearSelection }: any) => {';
  const logicInjection = `  const description = useSiteStore((state) => state.findNodeDescription ? state.findNodeDescription(node.id) : undefined);\n  const displayName = description || node.name || (node.mac ? node.mac.slice(-4) : node.id);`;
  
  // 只有当 TreeNode 定义存在且尚未注入时才执行
  if (sidebarCode.includes(treeNodeStart) && !sidebarCode.includes('const displayName =')) {
      sidebarCode = sidebarCode.replace(treeNodeStart, treeNodeStart + '\n' + logicInjection);
      console.log('  ✅ Logic injected into TreeNode.');
  } else if (sidebarCode.includes('const displayName =')) {
      console.log('  ℹ️  TreeNode logic already present.');
  } else {
      console.warn('  ⚠️  TreeNode component definition not found exactly as expected.');
  }

  // 2. JSX Replacement
  // 目标：替换原本显示 MAC 地址的 span
  // 原代码通常是: <span className="text-gray-400 ml-1">({node.mac ? node.mac.slice(-4) : node.id})</span>
  const targetRegex = /<span className="text-gray-400 ml-1">\(\{node\.mac \? node\.mac\.slice\(-4\) : node\.id\}\)<\/span>/;
  
  // 新代码：根据是否有 description 改变颜色
  const replacement = `<span className={\`ml-1 \${description ? 'text-blue-600 font-bold' : 'text-gray-400'}\`}>({displayName})</span>`;
  
  if (targetRegex.test(sidebarCode)) {
      sidebarCode = sidebarCode.replace(targetRegex, replacement);
      console.log('  ✅ JSX Label replaced.');
  } else if (sidebarCode.includes('text-blue-600')) {
      console.log('  ℹ️  JSX already updated.');
  } else {
      console.warn('  ⚠️  JSX Target span not found via Regex. Please check DeviceSidebar.tsx manually.');
  }

  fs.writeFileSync(sidebarPath, sidebarCode);
  console.log('  ✅ DeviceSidebar.tsx updated.');

} catch (err) {
  console.error('  ❌ Error patching DeviceSidebar.tsx:', err.message);
}

console.log('\n🏁 Patch process completed.');