
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { DeviceSidebar } from './components/DeviceSidebar';
import { SiteManager } from './components/SiteManager';
import { FloorPlanEditor } from './components/FloorPlanEditor';
import { ConfirmationDialog } from './components/ui/ConfirmationDialog';
import { Layers, Map, Save, FolderOpen, Settings, Plus, Monitor, LogOut } from 'lucide-react';
import { useSiteStore } from './store/useSiteStore';
import { useTopologyStore } from './store/useTopologyStore';
import { FileService } from './services/FileService';
import { useUIStore } from './store/useUIStore';

function App() {
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [isSiteManagerOpen, setIsSiteManagerOpen] = useState(false);
  const isDragging = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { isProjectOpen, closeProject } = useSiteStore();

  const startResize = useCallback(() => { isDragging.current = true; document.body.style.cursor = 'col-resize'; }, []);
  const stopResize = useCallback(() => { isDragging.current = false; document.body.style.cursor = 'default'; }, []);
  const resize = useCallback((e: MouseEvent) => { if (isDragging.current) setSidebarWidth(Math.max(200, Math.min(600, e.clientX))); }, []);
  
  useEffect(() => { 
      window.addEventListener('mousemove', resize); 
      window.addEventListener('mouseup', stopResize); 
      return () => { window.removeEventListener('mousemove', resize); window.removeEventListener('mouseup', stopResize); }; 
  }, [resize, stopResize]);

  const handleNewProject = async () => {
      await FileService.newProjectFlow(() => setIsSiteManagerOpen(true));
  };

  const handleCloseProject = async () => {
      const siteStore = useSiteStore.getState();
      if (siteStore.isProjectOpen && siteStore.hasUnsavedChanges) {
          const choice = await useUIStore.getState().confirm({
              title: 'Save Changes?',
              message: 'Do you want to save changes to the current project before closing?',
              type: 'warning'
          });

          if (choice === 'CANCEL') return;

          if (choice === 'SAVE') {
              await FileService.handleSave();
          }
      }
      closeProject();
  };

  const handleSave = async () => { 
      await FileService.handleSave(); 
  };

  const handleLoad = async (e: React.ChangeEvent<HTMLInputElement>) => { 
      await FileService.handleFileSelect(e); 
  };

  const handleOpenClick = () => {
      if (fileInputRef.current) {
          FileService.openFileFlow(fileInputRef.current);
      }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-window text-gray-900 overflow-hidden">
      
      <div className="h-9 bg-panel border-b border-border flex items-center px-4 justify-between select-none z-50 shrink-0 shadow-sm">
         <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 mr-4">
                <div className="w-5 h-5 bg-blue-600 rounded flex items-center justify-center text-white text-[10px] font-bold shadow-sm">M</div>
                <span className="font-semibold text-sm text-gray-800 tracking-wide">Mesh Studio</span>
            </div>

            <div className="flex items-center gap-2">
                <div className="h-4 w-px bg-gray-300 mx-2"></div>
                
                <button onClick={handleNewProject} className="px-3 py-1.5 text-xs text-blue-600 hover:bg-blue-50 rounded-md transition-colors flex items-center gap-2 font-medium">
                    <Plus size={14}/> New Project
                </button>

                <button onClick={handleOpenClick} className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-md transition-colors flex items-center gap-2 font-medium">
                    <FolderOpen size={14}/> Open Project
                </button>
                <input ref={fileInputRef} type="file" accept=".json,.mesh" className="hidden" onChange={handleLoad} />
                
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
      </div>

      {isProjectOpen ? (
        <div className="flex-1 flex overflow-hidden">
            <div style={{ width: sidebarWidth }} className="flex-shrink-0 h-full border-r border-border bg-panel flex flex-col relative z-20">
                <DeviceSidebar />
                <div onMouseDown={startResize} className="absolute top-0 right-[-3px] w-[6px] h-full cursor-col-resize hover:bg-blue-500/10 z-50 transition-colors"></div>
            </div>

            <div className="flex-1 h-full bg-[#e5e5e5] relative overflow-hidden flex flex-col">
                <FloorPlanEditor />
            </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center bg-white relative">
            <div className="text-center space-y-6 animate-in fade-in zoom-in duration-300">
                <div className="flex justify-center">
                    <img 
                        src="/assets/logo.svg" 
                        alt="Mesh Studio" 
                        className="w-32 h-32 object-contain opacity-90 drop-shadow-xl"
                        onError={(e) => {
                            e.currentTarget.style.display = 'none';
                        }} 
                    />
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
                        onClick={handleOpenClick}
                        className="px-6 py-3 bg-white border border-gray-200 hover:border-blue-300 text-gray-700 hover:text-blue-600 rounded-lg shadow-sm hover:shadow-md transition-all flex items-center gap-2 font-medium"
                    >
                        <FolderOpen size={18} /> Open Existing
                    </button>
                </div>
            </div>
            
            <div className="absolute bottom-6 text-xs text-gray-400">
                v2.2.0 • Mesh Configuration System
            </div>
        </div>
      )}

      {isSiteManagerOpen && isProjectOpen && <SiteManager onClose={() => setIsSiteManagerOpen(false)} />}
      <ConfirmationDialog />
    </div>
  );
}

export default App;
