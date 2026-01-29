
import React from 'react';

interface BatchEditDialogProps {
  show: boolean;
  onClose: () => void;
  onSave: (newCategory: string) => void;
  onDelete: () => void;
  categories: { value: string; label: string }[];
}

export const BatchEditDialog: React.FC<BatchEditDialogProps> = ({ show, onClose, onSave, onDelete, categories }) => {
  if (!show) {
    return null;
  }

  const [selectedCategory, setSelectedCategory] = React.useState('');

  return (
    <div className="fixed inset-0 bg-black/20 z-[200] flex items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl p-6 w-96" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-gray-800 mb-4">Batch Actions</h3>
        <div className="mb-4 p-4 border rounded-md bg-gray-50">
          <label className="block text-xs font-bold text-gray-500 mb-2">Change Category</label>
          <select
            className="w-full p-2 border border-gray-300 rounded text-sm bg-white"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            {categories.map(category => (
              <option key={category.value} value={category.value}>{category.label}</option>
            ))}
          </select>
            <button className="mt-2 w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm font-medium" onClick={() => onSave(selectedCategory)}>Apply Category Change</button>
        </div>
        <div className="mb-4 p-4 border rounded-md bg-red-50">
            <label className="block text-xs font-bold text-red-500 mb-2">Other Actions</label>
            <button className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-medium" onClick={onDelete}>Delete Selected Devices</button>
        </div>
        <div className="flex justify-end gap-2">
            <button className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded text-sm font-medium" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};
