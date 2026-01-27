const fs = require('fs');
const path = require('path');

const clientPath = path.join(__dirname, 'apps', 'client', 'src');
const componentsPath = path.join(clientPath, 'components');

console.log('🎨 Applying V25: Cascade Delete & Empty State Image...');

// --- 1. UPDATE DeviceSidebar.tsx (Aggressive Delete) ---
try {
    const sidebarPath = path.join(componentsPath, 'DeviceSidebar.tsx');
    let sidebarCode = fs.readFileSync(sidebarPath, 'utf8');

    // Replace handleDeleteLoop with aggressive cleanup logic
    // We explicitly look for devices in this loop (active AND missing) and wipe them from the map.
    const oldDeleteHandlerRegex = /const handleDeleteLoop = \(loopId: number\) => \{[\s\S]*?\};/;
    
    const newDeleteHandler = `const handleDeleteLoop = (loopId: number) => {
      // 1. Get ALL devices associated with this loop (Active + Missing)
      // Note: unassignedDevices contains everything currently loaded for this loop
      const devicesToDelete = unassignedDevices
          .filter(d => d.loopId === loopId)
          .map(d => d.mac);
          
      // 2. Wipe them from the Map (SiteStore)
      if (devicesToDelete.length > 0) {
          removeNodesByDeviceIds(devicesToDelete);
      }
      
      // 3. Delete the Loop (TopologyStore)
      removeLoop(loopId);
  };`;

    if (oldDeleteHandlerRegex.test(sidebarCode)) {
        sidebarCode = sidebarCode.replace(oldDeleteHandlerRegex, newDeleteHandler);
        fs.writeFileSync(sidebarPath, sidebarCode);
        console.log('✅ DeviceSidebar.tsx: Cascade delete logic reinforced.');
    } else {
        console.warn('⚠️ Could not locate handleDeleteLoop to update.');
    }

} catch (e) {
    console.error('❌ Error updating DeviceSidebar.tsx:', e);
}


// --- 2. UPDATE FloorPlanEditor.tsx (Empty State Image) ---
try {
    const editorPath = path.join(componentsPath, 'FloorPlanEditor.tsx');
    let editorCode = fs.readFileSync(editorPath, 'utf8');

    // Look for the "Select a floor to start editing" div
    // It usually looks like: {!activeFloor ? <div ...>Select a floor...</div> : (
    
    // We will replace the entire inner DIV content
    const emptyStateRegex = /<div className="flex items-center justify-center h-full text-gray-400 text-sm">Select a floor to start editing<\/div>/;
    
    // Replacement: Image + Text
    // Note: referencing /assets/empty_site.png
    const newEmptyState = `
        <div className="flex flex-col items-center justify-center h-full bg-gray-50/50 select-none">
            <img 
                src="/assets/empty_site.png" 
                alt="No Floor Selected" 
                className="max-w-[300px] opacity-40 mb-4 pointer-events-none grayscale"
                onError={(e) => {
                    // Fallback if image not found
                    e.currentTarget.style.display = 'none';
                }}
            />
            <p className="text-gray-400 font-medium text-sm">Select a floor to start editing</p>
        </div>
    `;

    if (emptyStateRegex.test(editorCode)) {
        editorCode = editorCode.replace(emptyStateRegex, newEmptyState);
        fs.writeFileSync(editorPath, editorCode);
        console.log('✅ FloorPlanEditor.tsx: Added Empty State Image.');
    } else {
        // Retry with a broader match if specific classes changed
        const broadRegex = /\{!activeFloor \? <div[\s\S]*?>[\s\S]*?start editing<\/div> : \(/;
        if (broadRegex.test(editorCode)) {
            editorCode = editorCode.replace(broadRegex, `{!activeFloor ? ${newEmptyState} : (`);
            fs.writeFileSync(editorPath, editorCode);
            console.log('✅ FloorPlanEditor.tsx: Added Empty State Image (Broad Match).');
        } else {
            console.warn('⚠️ Could not locate Empty State DIV to replace.');
        }
    }

} catch (e) {
    console.error('❌ Error updating FloorPlanEditor.tsx:', e);
}