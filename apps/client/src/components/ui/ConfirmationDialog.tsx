
import React from 'react';
import { useUIStore } from '../../store/useUIStore';
import { AlertTriangle, Save, FileX, X } from 'lucide-react';

export const ConfirmationDialog = () => {
  const { dialog, closeDialog } = useUIStore();
  
  if (!dialog.isOpen || !dialog.options) return null;

  const { title, message } = dialog.options;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-lg shadow-2xl border border-gray-200 w-96 overflow-hidden scale-100 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center gap-2">
          <AlertTriangle className="text-amber-500" size={18} />
          <h3 className="font-semibold text-gray-800">{title}</h3>
        </div>

        {/* Body */}
        <div className="p-6">
          <p className="text-gray-600 text-sm leading-relaxed">{message}</p>
        </div>

        {/* Footer / Actions */}
        <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 flex justify-end gap-2">
          <button 
            onClick={() => closeDialog('CANCEL')}
            className="px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-200 rounded transition-colors"
          >
            Cancel
          </button>
          
          <button 
            onClick={() => closeDialog('DISCARD')}
            className="px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 rounded transition-colors flex items-center gap-1.5"
          >
            <FileX size={14} /> Open Directly
          </button>

          <button 
            onClick={() => closeDialog('SAVE')}
            className="px-3 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded shadow-sm transition-colors flex items-center gap-1.5"
          >
            <Save size={14} /> Save & Continue
          </button>
        </div>
      </div>
    </div>
  );
};
