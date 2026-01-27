
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { DeviceSidebar } from './components/DeviceSidebar';
import { SiteManager } from './components/SiteManager';
import { FloorPlanEditor } from './components/FloorPlanEditor';
import { Layers, Map, Save, FolderOpen, Settings, Moon, Sun, Monitor } from 'lucide-react';
import { useSiteStore } from './store/useSiteStore';
import { useTopologyStore } from './store/useTopologyStore';
import { exportProject, importProject, clearAllImages } from './utils/storage';

function App() {
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [isSiteManagerOpen, setIsSiteManagerOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true); // Default to Dark
  const isDragging = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Theme Toggle Logic
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

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
    <div className="flex flex-col h-screen w-screen bg-window-light dark:bg-zinc-950 text-gray-900 dark:text-gray-100 overflow-hidden">
      
      {/* 1. Title Bar (Native Style) */}
      <div className="h-8 bg-panel-light dark:bg-zinc-900 border-b border-border-light dark:border-zinc-800 flex items-center px-3 justify-between select-none z-50 shrink-0">
         <div className="flex items-center gap-4">
            {/* App Icon */}
            <div className="flex items-center gap-2 mr-2">
                <div className="w-4 h-4 bg-blue-600 rounded flex items-center justify-center text-white text-[9px] font-bold">M</div>
                <span className="font-semibold text-xs text-gray-700 dark:text-gray-300 tracking-wide">Mesh Studio</span>
            </div>

            {/* Menu Bar */}
            <div className="flex items-center gap-1">
                <div className="h-4 w-px bg-gray-300 dark:bg-zinc-700 mx-1"></div>
                
                <button onClick={() => fileInputRef.current?.click()} className="px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-zinc-800 rounded transition-colors flex items-center gap-1.5">
                    <FolderOpen size={12}/> Open
                </button>
                <input ref={fileInputRef} type="file" accept=".json,.mesh" className="hidden" onChange={handleLoad} />
                
                <button onClick={handleSave} className="px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-zinc-800 rounded transition-colors flex items-center gap-1.5">
                    <Save size={12}/> Save
                </button>
                
                <button onClick={() => setIsSiteManagerOpen(true)} className="px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-zinc-800 rounded transition-colors flex items-center gap-1.5">
                    <Settings size={12}/> Site Manager
                </button>
            </div>
         </div>

         <div className="flex items-center gap-3">
             {/* Theme Toggle */}
             <button 
                onClick={() => setIsDarkMode(!isDarkMode)} 
                className="p-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-zinc-800 rounded-md transition-colors"
                title="Toggle Theme"
             >
                {isDarkMode ? <Sun size={12} /> : <Moon size={12} />}
             </button>
         </div>
      </div>

      {/* 2. Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Sidebar */}
        <div style={{ width: sidebarWidth }} className="flex-shrink-0 h-full border-r border-border-light dark:border-zinc-800 bg-panel-light dark:bg-zinc-900 flex flex-col relative z-20">
            <DeviceSidebar />
            {/* Drag Handle */}
            <div onMouseDown={startResize} className="absolute top-0 right-[-3px] w-[6px] h-full cursor-col-resize hover:bg-blue-500/20 z-50 transition-colors"></div>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 h-full bg-gray-200 dark:bg-[#09090b] relative overflow-hidden flex flex-col">
            <FloorPlanEditor />
        </div>
      </div>

      {/* 3. Status Bar */}
      <div className="h-6 bg-blue-600 dark:bg-blue-900 text-white flex items-center px-3 justify-between text-[10px] select-none z-50 shrink-0">
          <div className="flex items-center gap-4">
              <span className="flex items-center gap-1"><Monitor size={10}/> Ready</span>
              <span>Workspace: Default</span>
          </div>
          <div className="flex items-center gap-4 opacity-80">
              <span>UTF-8</span>
              <span>v2.1.0</span>
          </div>
      </div>

      {/* Modals */}
      {isSiteManagerOpen && <SiteManager onClose={() => setIsSiteManagerOpen(false)} />}
    </div>
  );
}

export default App;
