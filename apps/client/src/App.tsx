
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { DeviceSidebar } from './components/DeviceSidebar';
import { SiteManager } from './components/SiteManager';
import { FloorPlanEditor } from './components/FloorPlanEditor';
import { Layers, Map, Save, FolderOpen, Settings, Plus, Monitor, LogOut } from 'lucide-react';
import { useSiteStore } from './store/useSiteStore';
import { useTopologyStore } from './store/useTopologyStore';
import { exportProject, importProject } from './utils/storage';

function App() {
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [isSiteManagerOpen, setIsSiteManagerOpen] = useState(false);
  const isDragging = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Lifecycle State
  const { isProjectOpen, createProject, closeProject, loadState } = useSiteStore();
  const { setTopologyData } = useTopologyStore();

  // --- Resize Logic ---
  const startResize = useCallback(() => { isDragging.current = true; document.body.style.cursor = 'col-resize'; }, []);
  const stopResize = useCallback(() => { isDragging.current = false; document.body.style.cursor = 'default'; }, []);
  const resize = useCallback((e: MouseEvent) => { if (isDragging.current) setSidebarWidth(Math.max(200, Math.min(600, e.clientX))); }, []);
  
  useEffect(() => { 
      window.addEventListener('mousemove', resize); 
      window.addEventListener('mouseup', stopResize); 
      return () => { window.removeEventListener('mousemove', resize); window.removeEventListener('mouseup', stopResize); }; 
  }, [resize, stopResize]);

  // --- Handlers ---
  const handleNewProject = () => {
      if (isProjectOpen && !confirm("Create new project? Unsaved changes will be lost.")) return;
      createProject(); // Reset & Open
      useTopologyStore.getState().clearAll(); // Clear topology too
      setIsSiteManagerOpen(true); // Auto-open manager
  };

  const handleCloseProject = () => {
      if (confirm("Close current project?")) {
          closeProject();
      }
  };

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
            // Hydrate Stores
            useTopologyStore.setState(topology);
            loadState(site); // This sets isProjectOpen = true internally
        } catch(err) { alert(err instanceof Error ? err.message : "Failed to open project."); }
        if(fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-window text-gray-900 overflow-hidden">
      
      {/* 1. Top Title Bar (Always Visible) */}
      <div className="h-9 bg-panel border-b border-border flex items-center px-4 justify-between select-none z-50 shrink-0 shadow-sm">
         <div className="flex items-center gap-4">
            {/* App Icon */}
            <div className="flex items-center gap-2 mr-4">
                <div className="w-5 h-5 bg-blue-600 rounded flex items-center justify-center text-white text-[10px] font-bold shadow-sm">M</div>
                <span className="font-semibold text-sm text-gray-800 tracking-wide">Mesh Studio</span>
            </div>

            {/* Project Controls */}
            <div className="flex items-center gap-2">
                <div className="h-4 w-px bg-gray-300 mx-2"></div>
                
                {/* New Project */}
                <button onClick={handleNewProject} className="px-3 py-1.5 text-xs text-blue-600 hover:bg-blue-50 rounded-md transition-colors flex items-center gap-2 font-medium">
                    <Plus size={14}/> New Project
                </button>

                {/* Open Project */}
                <button onClick={() => fileInputRef.current?.click()} className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-md transition-colors flex items-center gap-2 font-medium">
                    <FolderOpen size={14}/> Open Project
                </button>
                <input ref={fileInputRef} type="file" accept=".json,.mesh" className="hidden" onChange={handleLoad} />
                
                {/* Workspace Actions (Only visible if open) */}
                {isProjectOpen && (
                    <>
                        <button onClick={handleSave} className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-md transition-colors flex items-center gap-2 font-medium">
                            <Save size={14}/> Save
                        </button>
                        <button onClick={() => setIsSiteManagerOpen(true)} className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-md transition-colors flex items-center gap-2 font-medium">
                            <Settings size={14}/> Site Manager
                        </button>
                
                <button onClick={handleCloseProject} className="px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-md transition-colors flex items-center gap-2 font-medium">
                    <LogOut size={14}/> Exit Project
                </button>
                    </>
                )}
            </div>
         </div>

         {/* Right Controls */}
         <div className="flex items-center gap-3">
             
         </div>
      </div>

      {/* 2. Main Content Area (Conditional) */}
      {isProjectOpen ? (
        // --- Workspace View ---
        <div className="flex-1 flex overflow-hidden">
            {/* Sidebar */}
            <div style={{ width: sidebarWidth }} className="flex-shrink-0 h-full border-r border-border bg-panel flex flex-col relative z-20">
                <DeviceSidebar />
                <div onMouseDown={startResize} className="absolute top-0 right-[-3px] w-[6px] h-full cursor-col-resize hover:bg-blue-500/10 z-50 transition-colors"></div>
            </div>

            {/* Canvas */}
            <div className="flex-1 h-full bg-[#e5e5e5] relative overflow-hidden flex flex-col">
                <FloorPlanEditor />
            </div>
        </div>
      ) : (
        // --- Start Page View ---
        <div className="flex-1 flex flex-col items-center justify-center bg-white relative">
            <div className="text-center space-y-6 animate-in fade-in zoom-in duration-300">
                {/* Logo Image */}
                <div className="flex justify-center">
                    <img 
                        src="/assets/logo.svg" 
                        alt="Mesh Studio" 
                        className="w-32 h-32 object-contain opacity-90 drop-shadow-xl"
                        onError={(e) => {
                            // Fallback if logo missing
                            e.currentTarget.style.display = 'none';
                        }} 
                    />
                    {/* Fallback Text if image fails (hidden by default image logic usually) */}
                </div>
                
                <div className="space-y-2">
                    <h1 className="text-2xl font-bold text-gray-800">Welcome to Mesh Studio</h1>
                    <p className="text-gray-500 text-sm">Create a new project or open an existing file to begin.</p>
                </div>

                <div className="flex items-center justify-center gap-4 pt-4">
                    <button 
                        onClick={handleNewProject}
                        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-lg hover:shadow-xl transition-all flex items-center gap-2 font-medium"
                    >
                        <Plus size={18} /> Create New Project
                    </button>
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="px-6 py-3 bg-white border border-gray-200 hover:border-blue-300 text-gray-700 hover:text-blue-600 rounded-lg shadow-sm hover:shadow-md transition-all flex items-center gap-2 font-medium"
                    >
                        <FolderOpen size={18} /> Open Existing
                    </button>
                </div>
            </div>
            
            {/* Version Footer */}
            <div className="absolute bottom-6 text-xs text-gray-400">
                v2.2.0 • Mesh Configuration System
            </div>
        </div>
      )}

      {/* Modals (Only render if project is open or needed) */}
      {isSiteManagerOpen && isProjectOpen && <SiteManager onClose={() => setIsSiteManagerOpen(false)} />}
    </div>
  );
}

export default App;
