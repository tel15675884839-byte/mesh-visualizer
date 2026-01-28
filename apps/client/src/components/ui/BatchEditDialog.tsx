
import React from 'react';

interface BatchEditDialogProps {
  show: boolean;
  onClose: () => void;
  onSave: (newCategory: string) => void;
  categories: { value: string; label: string }[];
}

export const BatchEditDialog: React.FC<BatchEditDialogProps> = ({ show, onClose, onSave, categories }) => {
  if (!show) {
    return null;
  }

  const [selectedCategory, setSelectedCategory] = React.useState('');

  return (
    <div className="fixed inset-0 bg-black/20 z-[200] flex items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl p-6 w-80" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-gray-800 mb-4">Batch Edit Category</h3>
        <div className="mb-4">
          <label className="block text-xs font-bold text-gray-500 mb-1">Device Category</label>
          <select
            className="w-full p-2 border border-gray-300 rounded text-sm bg-white"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            {categories.map(category => (
              <option key={category.value} value={category.value}>{category.label}</option>
            ))}
          </select>
        </div>
        <div className="flex justify-end gap-2">
            <button className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded text-sm font-medium" onClick={onClose}>Cancel</button>
            <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm font-medium" onClick={() => onSave(selectedCategory)}>Save</button>
        </div>
      </div>
    </div>
  );
};
