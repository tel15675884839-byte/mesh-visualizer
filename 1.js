const fs = require('fs');
const path = require('path');

const clientRoot = path.join(__dirname, 'apps', 'client');
const srcPath = path.join(clientRoot, 'src');
const uiPath = path.join(srcPath, 'components', 'ui');
const componentsPath = path.join(srcPath, 'components');

// Ensure UI directory exists
if (!fs.existsSync(uiPath)) fs.mkdirSync(uiPath, { recursive: true });

console.log('🖥️  Applying Native Desktop UI Transformation...');

// 1. tailwind.config.js
const tailwindConfig = `
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class', // Manual toggle
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Native-like neutrals
        window: {
          light: '#f5f5f5',
          dark: '#18181b', // zinc-950
        },
        panel: {
          light: '#ffffff',
          dark: '#27272a', // zinc-800
        },
        border: {
          light: '#e5e7eb', // gray-200
          dark: '#3f3f46', // zinc-700
        }
      },
      fontSize: {
        'xxs': '0.65rem',
      },
      boxShadow: {
        'window': '0 10px 40px -10px rgba(0, 0, 0, 0.5)',
      }
    },
  },
  plugins: [],
}
`;
fs.writeFileSync(path.join(clientRoot, 'tailwind.config.js'), tailwindConfig);
console.log('✅ Updated tailwind.config.js');

// 2. index.css (Global Resets)
const indexCss = `
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Kill browser bounce and global scroll */
html, body, #root {
  height: 100%;
  width: 100%;
  overflow: hidden;
  overscroll-behavior: none;
}

body {
  /* Native app cursor feel */
  cursor: default;
  user-select: none;
  -webkit-user-select: none;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

/* Custom Scrollbar for "Pro" feel */
.custom-scrollbar::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #d1d5db; /* gray-300 */
  border-radius: 5px;
  border: 2px solid transparent;
  background-clip: content-box;
}

.dark .custom-scrollbar::-webkit-scrollbar-thumb {
  background: #52525b; /* zinc-600 */
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #9ca3af; /* gray-400 */
}

.dark .custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #71717a; /* zinc-500 */
}
`;
fs.writeFileSync(path.join(srcPath, 'index.css'), indexCss);
console.log('✅ Updated index.css (App Shell Resets)');

// 3. components/ui/WindowModal.tsx
const windowModalContent = `
import React, { useState, useEffect, useRef } from 'react';
import { X, Minus, Square, Maximize2 } from 'lucide-react';

interface WindowModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  initialWidth?: number;
  initialHeight?: number;
  icon?: React.ReactNode;
  className?: string;
}

export const WindowModal: React.FC<WindowModalProps> = ({ 
  title, 
  onClose, 
  children,
  initialWidth = 960,
  initialHeight = 600,
  icon,
  className = ''
}) => {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number, y: number } | null>(null);
  
  // Center on mount
  useEffect(() => {
    setPosition({
        x: Math.max(0, (window.innerWidth - initialWidth) / 2),
        y: Math.max(0, (window.innerHeight - initialHeight) / 2)
    });
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only Left Click
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !dragStartRef.current) return;
      e.preventDefault();
      
      let newX = e.clientX - dragStartRef.current.x;
      let newY = e.clientY - dragStartRef.current.y;
      
      // Simple bounds checking (keep title bar accessible)
      if (newY < 0) newY = 0;
      if (newY > window.innerHeight - 30) newY = window.innerHeight - 30;
      
      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragStartRef.current = null;
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  return (
    <>
        {/* Dimmed Backdrop (Optional, keeps focus on window) */}
        <div className="fixed inset-0 bg-black/10 dark:bg-black/40 z-40" onClick={onClose} />
        
        <div 
            className={\`fixed z-50 flex flex-col font-sans text-sm select-none 
                bg-white dark:bg-zinc-900 
                border border-gray-300 dark:border-zinc-700 
                shadow-window rounded-lg overflow-hidden transition-colors duration-200 \${className}\`}
            style={{
                left: position.x,
                top: position.y,
                width: initialWidth,
                height: initialHeight,
            }}
        >
            {/* Title Bar */}
            <div 
                className="h-9 flex items-center justify-between px-3 bg-gray-100 dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-700 cursor-default"
                onMouseDown={handleMouseDown}
            >
                <div className="flex items-center gap-2 text-gray-700 dark:text-gray-200 font-medium">
                    {icon && <span className="opacity-70">{icon}</span>}
                    <span>{title}</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <button className="p-1 text-gray-400 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded"><Minus size={12} /></button>
                    <button className="p-1 text-gray-400 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded"><Maximize2 size={10} /></button>
                    <button 
                        onClick={onClose}
                        className="p-1 text-gray-400 hover:bg-red-500 hover:text-white rounded transition-colors ml-1"
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden relative flex flex-col bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100">
                {children}
            </div>
        </div>
    </>
  );
};
`;
fs.writeFileSync(path.join(uiPath, 'WindowModal.tsx'), windowModalContent);
console.log('✅ Created components/ui/WindowModal.tsx');

// 4. App.tsx (Main Layout)
const appContent = `
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
    const a = document.createElement('a'); a.href = url; a.download = \`mesh-project-\${Date.now()}.mesh\`; a.click(); URL.revokeObjectURL(url);
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
`;
fs.writeFileSync(path.join(srcPath, 'App.tsx'), appContent);
console.log('✅ Updated App.tsx (Theme & Layout)');

// 5. Update SiteManager to use WindowModal
const managerPath = path.join(componentsPath, 'SiteManager.tsx');
try {
    let managerCode = fs.readFileSync(managerPath, 'utf8');
    
    // Add import if missing
    if (!managerCode.includes('WindowModal')) {
        managerCode = `import { WindowModal } from './ui/WindowModal';\n` + managerCode;
    }

    // Replace the outer div wrapper with WindowModal
    const wrapperRegex = /return \(\s*<div className="fixed inset-0 bg-black\/50[\s\S]*?zoom-in duration-200">\s*([\s\S]*?)<\/div>\s*<\/div>\s*\);/m;
    
    if (wrapperRegex.test(managerCode)) {
        // We'll replace the return block with WindowModal
        // And remove the internal header since WindowModal has one
        
        // Find content start (after header)
        // Header usually ends with </button>\s*</div> inside the main div
        // We can match the flex-1 container: <div className="flex flex-1 overflow-hidden">
        
        const flexContainerRegex = /(<div className="flex flex-1 overflow-hidden">[\s\S]*?)(<\/div>\s*<\/div>\s*<\/div>)/;
        // The regex above is tricky. Let's be safer.
        // We want to keep the 3-column layout part.
        
        const contentStartMarker = '<div className="flex flex-1 overflow-hidden">';
        const contentStart = managerCode.indexOf(contentStartMarker);
        
        if (contentStart !== -1) {
            // Find the closing of this div. It's the second to last div in the component typically.
            // Let's assume standard formatting.
            const contentEnd = managerCode.lastIndexOf('</div>');
            const contentEnd2 = managerCode.lastIndexOf('</div>', contentEnd - 1);
            
            // Reconstruct
            // We need to cut out the Header part which is before contentStart
            
            const newReturn = `return (
    <WindowModal 
        title="Site Manager" 
        onClose={onClose} 
        icon={<Map size={18}/>} 
        initialWidth={960} 
        initialHeight={600}
    >
        ${managerCode.substring(contentStart, contentEnd2)}
    </WindowModal>
  );`;
            
             // Replace original return
             managerCode = managerCode.replace(wrapperRegex, newReturn);
             fs.writeFileSync(managerPath, managerCode);
             console.log('✅ Updated SiteManager.tsx to use WindowModal');
        }
    }
} catch (e) {
    console.warn('⚠️ Could not auto-update SiteManager wrapper. Please check manually.');
}

console.log('🚀 Desktop Theme Applied!');