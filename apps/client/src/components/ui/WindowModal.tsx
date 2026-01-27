
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
            className={`fixed z-50 flex flex-col font-sans text-sm select-none 
                bg-white dark:bg-zinc-900 
                border border-gray-300 dark:border-zinc-700 
                shadow-window rounded-lg overflow-hidden transition-colors duration-200 ${className}`}
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
