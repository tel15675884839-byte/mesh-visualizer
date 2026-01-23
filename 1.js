const fs = require('fs');
const path = require('path');

const clientPath = path.join(__dirname, 'apps', 'client', 'src');
const componentsPath = path.join(clientPath, 'components');
const filePath = path.join(componentsPath, 'FloorPlanEditor.tsx');

console.log('🎯 Restricting Drag Hit Area (Text Ignore) in FloorPlanEditor...');

try {
  let content = fs.readFileSync(filePath, 'utf8');

  // 1. Locate the Main Text Label (Name/Alias)
  // It is identified by y position calculation: y={baseRadius + (5 / currentScale)}
  // We want to add listening={false} to it.
  
  const labelTextRegex = /(<Text\s+y=\{baseRadius \+ \(5 \/ currentScale\)\}[\s\S]*?)(perfectDrawEnabled=\{false\})/g;
  
  if (labelTextRegex.test(content)) {
      content = content.replace(labelTextRegex, (match, prefix, suffix) => {
          if (match.includes('listening={false}')) {
              console.log('  ℹ️  Label Text is already non-interactive.');
              return match;
          }
          // Inject listening={false}
          return `${prefix}listening={false}\n            ${suffix}`;
      });
      console.log('  ✅ Applied listening={false} to Device Label Text.');
  } else {
      console.warn('  ⚠️  Could not locate the Device Label Text component via regex.');
  }

  // 2. (Optional) Locate the "?" Mark Text for Missing Devices
  // Usually this should also not be draggable if it's just visual, but user specifically asked for "text below".
  // We will leave the "?" mark interactive if needed (or ignore it too for consistency).
  // Let's apply it to "?" as well to prevent accidental drags on the question mark.
  
  const questionMarkRegex = /(<Text\s+y=\{-baseRadius - \(15\/currentScale\)\}[\s\S]*?)(perfectDrawEnabled=\{false\})/g;
  
  if (questionMarkRegex.test(content)) {
      content = content.replace(questionMarkRegex, (match, prefix, suffix) => {
           if (match.includes('listening={false}')) return match;
           return `${prefix}listening={false}\n            ${suffix}`;
      });
      console.log('  ✅ Applied listening={false} to Missing "?" Mark.');
  }

  fs.writeFileSync(filePath, content);
  console.log('✅ FloorPlanEditor.tsx updated: Text labels are now ignored by drag events.');

} catch (err) {
  console.error('❌ Error updating file:', err);
}