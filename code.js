const fs = require('fs');
const path = require('path');

const clientPath = path.join(__dirname, 'apps', 'client', 'src');
const componentsPath = path.join(clientPath, 'components');
const filePath = path.join(componentsPath, 'FloorPlanEditor.tsx');

console.log('🎯 Refining Drag Hit Region in FloorPlanEditor...');

try {
  let content = fs.readFileSync(filePath, 'utf8');

  // We need to locate the <Text> component specifically inside the Nodes/DeviceNode rendering logic.
  // It is identified by having 'text={labelText}' and 'fontSize={baseFontSize}'.
  
  // Target: The Text component logic.
  // We will perform a replacement to add listening={false}
  
  const textComponentRegex = /(<Text\s+y=\{baseRadius \+ \(5 \/ currentScale\)\}[\s\S]*?perfectDrawEnabled=\{false\})/g;
  
  if (textComponentRegex.test(content)) {
      content = content.replace(textComponentRegex, (match) => {
          if (match.includes('listening={false}')) {
              console.log('  ℹ️  listening={false} already present on Text.');
              return match;
          }
          // Insert listening={false} before the closing prop
          return match.replace('perfectDrawEnabled={false}', 'perfectDrawEnabled={false}\n            listening={false}');
      });
      
      fs.writeFileSync(filePath, content);
      console.log('✅ Updated FloorPlanEditor.tsx: Text labels are now non-interactive (ghosts).');
  } else {
      console.error('❌ Could not locate the specific <Text> component in FloorPlanEditor.tsx. Please check the file content.');
  }

} catch (err) {
  console.error('❌ Error updating file:', err);
}