
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { DeviceSidebar } from './components/DeviceSidebar';
import { SiteManager } from './components/SiteManager';
import { FloorPlanEditor } from './components/FloorPlanEditor';
import { Layers, Map, Save, FolderOpen, Settings } from 'lucide-react';
import { useSiteStore } from './store/useSiteStore';
import { useTopologyStore } from './store/useTopologyStore';
import { exportProject, importProject } from './utils/storage';

function App() {
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [isSiteManagerOpen, setIsSiteManagerOpen] = useState(false);
  const isDragging = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Resize Logic ---
  const startResize = useCallback(() => { isDragging.current = true; document.body.style.cursor = 'col-resize'; }, []);
  const stopResize = useCallback(() => { isDragging.current = false; document.body.style.cursor = 'default'; }, []);
  const resize = useCallback((e: MouseEvent) => { if (isDragging.current) setSidebarWidth(Math.max(200, Math.min(600, e.clientX))); }, []);
  
  useEffect(() => { 
      window.addEventListener('mousemove', resize); 
      window.addEventListener('mouseup', stopResize); 
      return () => { window.removeEventListener('mousemove', resize); window.removeEventListener('mouseup', stopResize); }; 
  }, [resize, stopResize]);

  // --- File Handlers ---
  const handleSave = async () => {
    const data = await exportProject(useTopologyStore.getState(), useSiteStore.getState());
    const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `mesh-project-${Date.now()}.mesh`; a.click(); URL.revokeObjectURL(url);
  };

  const handleLoad = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
        try {
            const { topology, site } = await importProject(ev.target?.result as string);
            useTopologyStore.setState(topology);
            useSiteStore.getState().loadState(site);
        } catch(err) { alert("Load Failed"); }
        if(fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-window text-gray-900 overflow-hidden">
      
      {/* 1. Top Title Bar */}
      <div className="h-9 bg-panel border-b border-border flex items-center px-4 justify-between select-none z-50 shrink-0 shadow-sm">
         <div className="flex items-center gap-4">
            {/* App Icon */}
            <div className="flex items-center gap-2 mr-4">
                <div className="w-5 h-5 bg-blue-600 rounded flex items-center justify-center text-white text-[10px] font-bold shadow-sm">M</div>
                <span className="font-semibold text-sm text-gray-800 tracking-wide">Mesh Studio</span>
            </div>

            {/* Menu Buttons */}
            <div className="flex items-center gap-2">
                <div className="h-4 w-px bg-gray-300 mx-2"></div>
                
                <button onClick={() => fileInputRef.current?.click()} className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-md transition-colors flex items-center gap-2 font-medium">
                    <FolderOpen size={14}/> Open
                </button>
                <input ref={fileInputRef} type="file" accept=".json,.mesh" className="hidden" onChange={handleLoad} />
                
                <button onClick={handleSave} className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-md transition-colors flex items-center gap-2 font-medium">
                    <Save size={14}/> Save
                </button>
                
                <button onClick={() => setIsSiteManagerOpen(true)} className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-md transition-colors flex items-center gap-2 font-medium">
                    <Settings size={14}/> Site Manager
                </button>
            </div>
         </div>
      </div>

      {/* 2. Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Sidebar */}
        <div style={{ width: sidebarWidth }} className="flex-shrink-0 h-full border-r border-border bg-panel flex flex-col relative z-20">
            <DeviceSidebar />
            {/* Drag Handle */}
            <div onMouseDown={startResize} className="absolute top-0 right-[-3px] w-[6px] h-full cursor-col-resize hover:bg-blue-500/10 z-50 transition-colors"></div>
        </div>

        {/* Canvas Area (Light Gray) */}
        <div className="flex-1 h-full bg-[#e5e5e5] relative overflow-hidden flex flex-col">
            <FloorPlanEditor />
        </div>
      </div>

      {/* Modals */}
      {isSiteManagerOpen && <SiteManager onClose={() => setIsSiteManagerOpen(false)} />}
    </div>
  );
}

export default App;
