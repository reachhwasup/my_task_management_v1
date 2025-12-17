"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { X } from 'lucide-react'; // Make sure you installed lucide-react

interface Props {
  userId: string;
  workspaceId: string;
  preselectedStatus?: string;
  onClose: () => void;
  onTaskAdded: () => void;
}

export default function NewTaskModal({ userId, workspaceId, preselectedStatus = 'not_started', onClose, onTaskAdded }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('P3');
  const [dueDate, setDueDate] = useState('');
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [status, setStatus] = useState(preselectedStatus);
  const [members, setMembers] = useState<{ id: string; username: string; firstname?: string; lastname?: string }[]>([]);
  const [loading, setLoading] = useState(false);


  useEffect(() => {
    fetchMembers();
  }, [workspaceId]);

  async function fetchMembers() {
    if (!workspaceId) return;
    const { data, error } = await supabase
      .from('workspace_members')
      .select('user_id, profiles ( username, firstname, lastname )')
      .eq('workspace_id', workspaceId);
    
    if (error) {
      console.error('Error fetching members:', error);
      return;
    }
    
    if (data) {
      console.log('Fetched members:', data);
      const membersList = data
        .filter((m: any) => m.profiles) // Filter out any null profiles
        .map((m: any) => ({
          id: m.user_id,
          username: m.profiles?.username || 'Unknown User',
          firstname: m.profiles?.firstname,
          lastname: m.profiles?.lastname
        }));
      console.log('Processed members:', membersList);
      setMembers(membersList);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.from('tasks').insert({
      title,
      description,
      priority,
      status: status,
      workspace_id: workspaceId,
      created_by: userId,
      due_date: dueDate || null,
      assignee_id: assigneeId || null
    });

    if (error) {
      alert(error.message);
    } else {
      onTaskAdded();
      onClose();
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-md p-6 relative shadow-xl">
        
        {/* Close Button */}
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <X size={20} />
        </button>

        <h2 className="text-xl font-bold mb-4">✨ New Task</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-800 mb-2">Title</label>
            <input
              required
              className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
              placeholder="e.g. Fix Server Bug"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-800 mb-2">Description</label>
            <textarea
              className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 h-24 text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
              placeholder="Details..."
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-800 mb-2">Critical Priority</label>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={priority === 'P1'}
                onChange={e => setPriority(e.target.checked ? 'P1' : 'P3')}
                className="w-5 h-5 accent-red-600"
                id="critical-priority"
              />
              <label htmlFor="critical-priority" className="text-base text-gray-700">Mark as Critical (P1)</label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-800 mb-2">Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-800 mb-2">PIC (Assignee)</label>
            <select
              value={assigneeId}
              onChange={e => setAssigneeId(e.target.value)}
              className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 bg-white text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
            >
              <option value="">-- Unassigned --</option>
              {members.map(m => (
                <option key={m.id} value={m.id}>
                  {m.username}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded font-semibold hover:bg-blue-700 transition"
          >
            {loading ? 'Saving...' : 'Create Task'}
          </button>
        </form>
      </div>
    </div>
  );
}