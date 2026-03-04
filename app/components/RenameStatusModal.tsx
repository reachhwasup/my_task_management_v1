"use client";

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { X } from 'lucide-react';

interface Props {
  statusId: string;
  currentLabel: string;
  onClose: () => void;
  onRenamed: () => void;
}

export default function RenameStatusModal({ statusId, currentLabel, onClose, onRenamed }: Props) {
  const [label, setLabel] = useState(currentLabel);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase
      .from('workspace_statuses')
      .update({ status_label: label })
      .eq('id', statusId);

    if (error) {
      alert(error.message);
    } else {
      onRenamed();
      onClose();
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-md p-6 relative shadow-2xl">
        
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <X size={20} />
        </button>

        <h2 className="text-xl font-bold mb-4">✏️ Rename Status</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-800 mb-2">Status Name</label>
            <input
              required
              autoFocus
              className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
              placeholder="e.g., Review, Testing, Blocked"
              value={label}
              onChange={e => setLabel(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg font-semibold hover:bg-gray-300 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !label.trim()}
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
