"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { X } from 'lucide-react'; // Make sure you installed lucide-react

interface Props {
  userId: string;
  workspaceId: string;
  spaceId?: string | null;
  folderId?: string | null;
  listId?: string | null;
  preselectedStatus?: string;
  onClose: () => void;
  onTaskAdded: () => void;
}

export default function NewTaskModal({ userId, workspaceId, spaceId = null, folderId = null, listId = null, preselectedStatus = 'not_started', onClose, onTaskAdded }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('P3');
  const [dueDate, setDueDate] = useState('');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
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

    // 1. Create the task
    const { data: newTask, error: taskError } = await supabase
      .from('tasks')
      .insert({
        title,
        description,
        priority,
        status,
        workspace_id: workspaceId,
        space_id: spaceId,
        folder_id: folderId,
        list_id: listId,
        created_by: userId,
        due_date: dueDate || null,
        assignee_id: assigneeIds.length > 0 ? assigneeIds[0] : null // Keep first assignee as primary
      })
      .select()
      .single();

    if (taskError) {
      alert(taskError.message);
      setLoading(false);
      return;
    }

    // 2. Add all assignees to task_assignees table
    if (assigneeIds.length > 0 && newTask) {
      const assigneeRecords = assigneeIds.map(userId => ({
        task_id: newTask.id,
        user_id: userId
      }));

      const { error: assigneeError } = await supabase
        .from('task_assignees')
        .insert(assigneeRecords);

      if (assigneeError) {
        console.error('Error adding assignees:', assigneeError);
      }
    }

    onTaskAdded();
    onClose();
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
            <label className="block text-sm font-bold text-gray-800 mb-2">Assignees</label>

            {/* Selected Assignees as Profile Badges */}
            {assigneeIds.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {assigneeIds.map(id => {
                  const member = members.find(m => m.id === id);
                  if (!member) return null;
                  return (
                    <div key={id} className="flex items-center gap-1.5 bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full border border-blue-300">
                      <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">
                        {member.username.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium">{member.username}</span>
                      <button
                        type="button"
                        onClick={() => setAssigneeIds(assigneeIds.filter(aid => aid !== id))}
                        className="ml-1 text-blue-600 hover:text-blue-800 hover:bg-blue-200 rounded-full p-0.5"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Dropdown to Add Assignees */}
            <select
              value=""
              onChange={(e) => {
                if (e.target.value && !assigneeIds.includes(e.target.value)) {
                  setAssigneeIds([...assigneeIds, e.target.value]);
                }
              }}
              className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 bg-white text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
            >
              <option value="">+ Add assignee...</option>
              {members
                .filter(m => !assigneeIds.includes(m.id))
                .map(m => (
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