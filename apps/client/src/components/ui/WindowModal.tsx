
import React, { useState, useEffect, useRef } from 'react';
import { X, Minus, Maximize2 } from 'lucide-react';

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
    if (e.button !== 0) return; 
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
      
      // Bounds check
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
        {/* Transparent backdrop to catch clicks outside */}
        <div className="fixed inset-0 bg-black/5 z-40" onClick={onClose} />
        
        <div 
            className={`fixed z-50 flex flex-col font-sans text-sm select-none 
                bg-panel border border-gray-300
                shadow-window rounded-lg overflow-hidden ${className}`}
            style={{
                left: position.x,
                top: position.y,
                width: initialWidth,
                height: initialHeight,
                boxShadow: '0 20px 50px -12px rgba(0, 0, 0, 0.25)' // Stronger shadow for pop
            }}
        >
            {/* Native-like Title Bar */}
            <div 
                className="h-9 flex items-center justify-between px-3 bg-gray-100 border-b border-gray-200 cursor-default select-none"
                onMouseDown={handleMouseDown}
            >
                <div className="flex items-center gap-2 text-gray-700 font-medium">
                    {icon && <span className="text-gray-500">{icon}</span>}
                    <span>{title}</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <button className="p-1 text-gray-400 hover:bg-gray-200 rounded"><Minus size={12} /></button>
                    <button className="p-1 text-gray-400 hover:bg-gray-200 rounded"><Maximize2 size={10} /></button>
                    <button 
                        onClick={onClose}
                        className="p-1 text-gray-400 hover:bg-red-500 hover:text-white rounded transition-colors ml-1"
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden relative flex flex-col bg-white">
                {children}
            </div>
        </div>
    </>
  );
};
