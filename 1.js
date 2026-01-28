const fs = require('fs');
const path = require('path');

const clientPath = path.join(__dirname, 'apps', 'client', 'src');
const componentsPath = path.join(clientPath, 'components');
const editorPath = path.join(componentsPath, 'FloorPlanEditor.tsx');

console.log('📐 Increasing Leader/Router Icon Size by 50% (Robust Match)...');

try {
    let editorCode = fs.readFileSync(editorPath, 'utf8');

    // We need to modify the baseRadius calculation inside SingleDeviceNode.
    // Target line: const baseRadius = 10 * nodeScale;
    
    // We use a flexible regex that allows for extra spaces
    const targetRegex = /const\s+baseRadius\s*=\s*10\s*\*\s*nodeScale\s*;?/;
    
    const newRadiusCalc = `
    // Size Logic: Leader/Router are 50% larger
    const isInfrastructure = role.toLowerCase().includes('leader') || role.toLowerCase().includes('router');
    const baseRadius = 10 * nodeScale * (isInfrastructure ? 1.5 : 1);`;

    if (targetRegex.test(editorCode)) {
        editorCode = editorCode.replace(targetRegex, newRadiusCalc);
        fs.writeFileSync(editorPath, editorCode);
        console.log('✅ FloorPlanEditor.tsx: Leader & Router icons are now 1.5x larger.');
    } else {
        console.error('❌ Could not locate "const baseRadius = 10 * nodeScale;" even with flexible matching.');
        console.log('   Please check if FloorPlanEditor.tsx has been manually modified.');
    }

} catch (e) {
    console.error('❌ Error updating FloorPlanEditor.tsx:', e);
}