"use client";

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  folderId?: string | null;
  spaceId?: string | null;
  onListCreated: () => void;
}

export default function CreateListModal({ isOpen, onClose, folderId, spaceId, onListCreated }: Props) {
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
        alert('You must be logged in to create a list');
        return;
      }

      // Get the highest position
      let nextPosition = 0;
      if (folderId) {
        const { data: lists } = await supabase
          .from('lists')
          .select('position')
          .eq('folder_id', folderId)
          .order('position', { ascending: false })
          .limit(1);
        nextPosition = lists && lists.length > 0 ? lists[0].position + 1 : 0;
      } else if (spaceId) {
        const { data: lists } = await supabase
          .from('lists')
          .select('position')
          .eq('space_id', spaceId)
          .is('folder_id', null)
          .order('position', { ascending: false })
          .limit(1);
        nextPosition = lists && lists.length > 0 ? lists[0].position + 1 : 0;
      }

      const insertData: any = {
        name: name.trim(),
        description: description.trim() || null,
        position: nextPosition,
        created_by: user.id,
      };
      if (folderId) {
        insertData.folder_id = folderId;
      }
      if (spaceId) {
        insertData.space_id = spaceId;
      }

      const { data, error } = await supabase
        .from('lists')
        .insert(insertData)
        .select();

      if (error) {
        console.error('Supabase error:', error);
        alert(`Failed to create list: ${error.message || JSON.stringify(error)}`);
        return;
      }

      console.log('List created successfully:', data);
      setName('');
      setDescription('');
      onListCreated();
      onClose();
    } catch (error: any) {
      console.error('Error creating list:', error);
      alert(`Failed to create list: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Create New List</h2>
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
              List Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., General, Urgent, Backlog"
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
              placeholder="What's this list for?"
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
              {loading ? 'Creating...' : 'Create List'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
