"use client";

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { X, Sparkles } from 'lucide-react';

interface Props {
  onClose: () => void;
  onWorkspaceCreated: (workspaceId: string) => void;
}

export default function CreateWorkspaceModal({ onClose, onWorkspaceCreated }: Props) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Workspace name is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Call the database function that creates workspace and adds user as owner
      const { data, error: rpcError } = await supabase
        .rpc('create_new_workspace', { ws_name: name.trim() });

      if (rpcError) {
        setError(rpcError.message);
      } else if (data) {
        onWorkspaceCreated(data); // Return the new workspace ID
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create workspace');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Sparkles className="text-blue-600" size={24} />
            <h2 className="text-xl font-bold text-gray-800">Create New Workspace</h2>
          </div>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Description */}
        <p className="text-sm text-gray-600 mb-6">
          Set up a new collaborative space for your team or project. You'll become the workspace owner.
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-800 mb-2">
              Workspace Name
            </label>
            <input
              type="text"
              required
              maxLength={50}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g., Marketing Q4, Holiday Party Planning"
              className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-base"
              autoFocus
            />
            <div className="text-xs text-gray-500 font-medium mt-2">
              {name.length}/50 characters
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {loading ? 'Creating...' : 'Create Workspace'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
