"use client";

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  spaceId: string;
  onFolderCreated: () => void;
}

export default function CreateFolderModal({ isOpen, onClose, spaceId, onFolderCreated }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('You must be logged in to create a folder');
        return;
      }

      // Get the highest position
      const { data: folders } = await supabase
        .from('folders')
        .select('position')
        .eq('space_id', spaceId)
        .order('position', { ascending: false })
        .limit(1);

      const nextPosition = folders && folders.length > 0 ? folders[0].position + 1 : 0;

      const { data, error } = await supabase
        .from('folders')
        .insert({
          space_id: spaceId,
          name: name.trim(),
          description: description.trim() || null,
          position: nextPosition,
          created_by: user.id,
        })
        .select();

      if (error) {
        console.error('Supabase error:', error);
        alert(`Failed to create folder: ${error.message || JSON.stringify(error)}`);
        return;
      }

      console.log('Folder created successfully:', data);
      setName('');
      setDescription('');
      onFolderCreated();
      onClose();
    } catch (error: any) {
      console.error('Error creating folder:', error);
      alert(`Failed to create folder: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Create New Folder</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Folder Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., 2025, Q1 Projects, Archives"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this folder for?"
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
              disabled={loading || !name.trim()}
            >
              {loading ? 'Creating...' : 'Create Folder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
