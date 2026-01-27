const fs = require('fs');
const path = require('path');

const clientPath = path.join(__dirname, 'apps', 'client', 'src');
const storePath = path.join(clientPath, 'store', 'useSiteStore.ts');

console.log('🔧 Fixing "Open Project" Logic (Restoring isProjectOpen state)...');

try {
    let storeCode = fs.readFileSync(storePath, 'utf8');

    // We need to modify the loadState action.
    // Current looking code (likely):
    // loadState: (state) => set({ 
    //    buildings: state.buildings || [], 
    //    ... 
    // }),

    // We want to inject `isProjectOpen: true,` into the set object.

    const loadStateRegex = /loadState:\s*\(state\)\s*=>\s*set\(\{\s*([\s\S]*?)\}\),/m;
    
    if (loadStateRegex.test(storeCode)) {
        // Check if it already has isProjectOpen
        const match = storeCode.match(loadStateRegex);
        if (match && !match[1].includes('isProjectOpen: true')) {
            // Inject it at the beginning of the set object
            const newImplementation = `loadState: (state) => set({ 
        isProjectOpen: true, // FORCE OPEN
        ${match[1]}
      }),`;
            storeCode = storeCode.replace(loadStateRegex, newImplementation);
            fs.writeFileSync(storePath, storeCode);
            console.log('✅ useSiteStore.ts: Fixed loadState to switch view to Workspace.');
        } else {
            console.log('ℹ️ useSiteStore.ts seems already correct.');
        }
    } else {
        console.warn('⚠️ Could not locate loadState function signature to patch.');
    }

} catch (e) {
    console.error('❌ Error patching useSiteStore.ts:', e);
}