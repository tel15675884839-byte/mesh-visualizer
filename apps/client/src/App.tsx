
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { DeviceSidebar } from './components/DeviceSidebar';
import { SiteManager } from './components/SiteManager';
import { FloorPlanEditor } from './components/FloorPlanEditor';
import { Layers, Map, Save, FolderOpen } from 'lucide-react';
import { useSiteStore } from './store/useSiteStore';
import { useTopologyStore } from './store/useTopologyStore';
import { clearAllImages, exportProject, importProject } from './utils/storage';

function App() {
  const [sidebarWidth, setSidebarWidth] = useState(350);
  const [isSiteManagerOpen, setIsSiteManagerOpen] = useState(false);
  const isDragging = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const siteStore = useSiteStore();
  const topologyStore = useTopologyStore();

  // Lifecycle: Reset on Mount
  useEffect(() => {
    // 1. Clear IDB
    clearAllImages();
    // 2. Clear Stores
    siteStore.reset();
    topologyStore.reset();
    console.log("App Session Reset");
  }, []);

  const handleSave = async () => {
    const data = await exportProject(
      useTopologyStore.getState(), 
      useSiteStore.getState()
    );
    const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mesh-project-${Date.now()}.mesh.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLoad = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
        try {
            const { topology, site } = await importProject(ev.target?.result as string);
            // Hydrate Stores
            useTopologyStore.setState(topology);
            useSiteStore.getState().loadState(site);
            alert("Project Loaded Successfully");
        } catch(err) {
            alert("Failed to load project");
            console.error(err);
        } finally {
            if(fileInputRef.current) fileInputRef.current.value = '';
        }
    };
    reader.readAsText(file);
  };

  const startResize = useCallback(() => { isDragging.current = true; document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none'; }, []);
  const stopResize = useCallback(() => { isDragging.current = false; document.body.style.cursor = 'default'; document.body.style.userSelect = 'auto'; }, []);
  const resize = useCallback((e: MouseEvent) => {
    if (isDragging.current) {
      let w = e.clientX;
      if (w < 300) w = 300; if (w > 800) w = 800;
      setSidebarWidth(w);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', resize);
    window.addEventListener('mouseup', stopResize);
    return () => window.removeEventListener('mousemove', resize);
  }, [resize, stopResize]);

  return (
    <div className="flex flex-col h-screen w-full bg-gray-50 text-gray-900 font-sans overflow-hidden">
      <header className="shrink-0 flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 shadow-sm z-20">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-lg shadow-sm">
            <Layers size={20} className="text-white" />
          </div>
          <h1 className="text-lg font-bold text-gray-800 tracking-tight">Mesh System</h1>
        </div>
        
        <div className="flex items-center gap-3">
          <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors">
            <FolderOpen size={16} /> Open
          </button>
          <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleLoad} />
          
          <button onClick={handleSave} className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors">
            <Save size={16} /> Save
          </button>
          
          <div className="w-px h-6 bg-gray-300 mx-1"></div>

          <button onClick={() => setIsSiteManagerOpen(true)} className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors">
            <Map size={16} /> Site Manager
          </button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden relative">
        <div style={{ width: sidebarWidth }} className="flex-shrink-0 h-full relative border-r border-gray-200">
            <DeviceSidebar />
            <div onMouseDown={startResize} className="absolute top-0 right-[-2px] w-1.5 h-full cursor-col-resize hover:bg-indigo-500/50 z-50 transition-colors"></div>
        </div>
        <div className="flex-1 h-full bg-white relative">
            <FloorPlanEditor />
        </div>
      </main>

      {isSiteManagerOpen && <SiteManager onClose={() => setIsSiteManagerOpen(false)} />}
    </div>
  );
}

export default App;
