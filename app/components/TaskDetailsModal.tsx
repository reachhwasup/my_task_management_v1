"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { X, Trash2, Calendar, Save, Plus, CheckSquare, Square } from 'lucide-react';
import CommentsSection from './CommentsSection';

interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  due_date: string;
  workspace_id: string;
  assignee_id?: string;
}

interface Subtask {
  id: string;
  title: string;
  is_completed: boolean;
  assignee_id?: string;
  due_date?: string;
  profiles?: {
    username: string;
  };
}

interface Member {
  id: string;
  username: string;
  firstname?: string;
  lastname?: string;
}

interface Props {
  task: Task;
  onClose: () => void;
  onUpdate: () => void;
  userPermission: string;
}

export default function TaskDetailsModal({ task, onClose, onUpdate, userPermission }: Props) {
  const isReadOnly = userPermission === 'viewer';
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState(task.priority);
  const [dueDate, setDueDate] = useState(task.due_date || '');
  const [assigneeId, setAssigneeId] = useState(task.assignee_id || '');
  const [loading, setLoading] = useState(false);
  
  // Subtask State
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newSubtaskAssigneeId, setNewSubtaskAssigneeId] = useState('');
  const [newSubtaskDueDate, setNewSubtaskDueDate] = useState('');
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
  const [showAddSubtaskForm, setShowAddSubtaskForm] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);

  useEffect(() => {
    loadFullDetails();
    fetchMembers();
  }, [task.id]);

  async function fetchMembers() {
    if (!task.workspace_id) return;
    const { data, error } = await supabase
      .from('workspace_members')
      .select('user_id, profiles ( username, firstname, lastname )')
      .eq('workspace_id', task.workspace_id);
    
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

  async function loadFullDetails() {
    // 1. Fetch Task Details
    const { data: taskData } = await supabase
      .from('tasks')
      .select('description, due_date, assignee_id')
      .eq('id', task.id)
      .single();
    
    if (taskData) {
      setDescription(taskData.description || '');
      setDueDate(taskData.due_date || '');
      setAssigneeId(taskData.assignee_id || '');
    }

    // 2. Fetch Subtasks with Assignee Info
    const { data: subData, error: subError } = await supabase
      .from('subtasks')
      .select('*')
      .eq('task_id', task.id)
      .order('created_at', { ascending: true });

    if (subError) {
      console.error('Error loading subtasks:', subError);
    } else if (subData) {
      console.log('Raw subtasks data:', subData);
      // Fetch profile data for each subtask that has an assignee
      const subtasksWithProfiles = await Promise.all(
        subData.map(async (sub) => {
          if (sub.assignee_id) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('username')
              .eq('id', sub.assignee_id)
              .single();
            return { ...sub, profiles: profile };
          }
          return sub;
        })
      );
      console.log('Subtasks with profiles:', subtasksWithProfiles);
      setSubtasks(subtasksWithProfiles);
    }
  }

  const handleSave = async () => {
    setLoading(true);
    
    // Save pending subtask if there's one being added
    if (showAddSubtaskForm && newSubtaskTitle.trim()) {
      await supabase
        .from('subtasks')
        .insert({
          task_id: task.id,
          title: newSubtaskTitle,
          is_completed: false,
          assignee_id: newSubtaskAssigneeId || null,
          due_date: newSubtaskDueDate || null
        });
      
      // Reset form
      setNewSubtaskTitle('');
      setNewSubtaskAssigneeId('');
      setNewSubtaskDueDate('');
      setShowAddSubtaskForm(false);
    }
    
    const { error } = await supabase
      .from('tasks')
      .update({ 
        title, 
        description, 
        priority, 
        due_date: dueDate || null,
        assignee_id: assigneeId || null
      })
      .eq('id', task.id);

    if (error) alert('Error saving: ' + error.message);
    else {
      onUpdate();
      onClose();
    }
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure?")) return;
    await supabase.from('tasks').delete().eq('id', task.id);
    onUpdate();
    onClose();
  };

  // --- SUBTASK LOGIC ---

  const addSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim()) return;

    const { data, error } = await supabase
      .from('subtasks')
      .insert({
        task_id: task.id,
        title: newSubtaskTitle,
        is_completed: false,
        assignee_id: newSubtaskAssigneeId || null,
        due_date: newSubtaskDueDate || null
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding subtask:', error);
      alert('Error adding subtask: ' + error.message);
      return;
    }

    if (data) {
      // Fetch the profile info if assignee exists
      let profileData = null;
      if (data.assignee_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', data.assignee_id)
          .single();
        profileData = profile;
      }

      setSubtasks([...subtasks, { ...data, profiles: profileData }]);
      setNewSubtaskTitle('');
      setNewSubtaskAssigneeId('');
      setNewSubtaskDueDate('');
      setShowAddSubtaskForm(false);
    }
  };

  const toggleSubtask = async (subtaskId: string, currentStatus: boolean) => {
    // 1. Optimistic UI Update
    const updated = subtasks.map(s => 
      s.id === subtaskId ? { ...s, is_completed: !currentStatus } : s
    );
    setSubtasks(updated);

    // 2. Database Update
    await supabase
      .from('subtasks')
      .update({ is_completed: !currentStatus })
      .eq('id', subtaskId);
      
    // 3. Trigger parent update (to refresh progress bar on board)
    onUpdate(); 
  };

  const deleteSubtask = async (subtaskId: string) => {
    setSubtasks(subtasks.filter(s => s.id !== subtaskId));
    await supabase.from('subtasks').delete().eq('id', subtaskId);
    onUpdate();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl w-full max-w-2xl h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* HEADER */}
        <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
          <input 
            value={title} 
            onChange={e => setTitle(e.target.value)}
            disabled={isReadOnly}
            className="text-xl font-bold bg-transparent border-none focus:ring-0 w-full text-gray-800 placeholder-gray-400 outline-none disabled:opacity-60 disabled:cursor-not-allowed"
          />
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          
          {/* Properties */}
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Priority</label>
              <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg border border-gray-200">
                <input
                  type="checkbox"
                  checked={priority === 'P1'}
                  onChange={e => setPriority(e.target.checked ? 'P1' : 'P3')}
                  disabled={isReadOnly}
                  className="w-5 h-5 accent-red-600 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  id="critical-priority-detail"
                />
                <label htmlFor="critical-priority-detail" className="text-sm text-gray-700 cursor-pointer select-none">
                  {priority === 'P1' ? '🔴 Critical Priority' : '⚪ Normal Priority'}
                </label>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">PIC (Assignee)</label>
                <select
                  value={assigneeId}
                  onChange={e => setAssigneeId(e.target.value)}
                  disabled={isReadOnly}
                  className="w-full border-2 border-gray-300 rounded-lg text-sm bg-white p-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-gray-100 text-gray-900 font-medium cursor-pointer"
                >
                  <option value="">-- Unassigned --</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.username}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Due Date</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-gray-400 pointer-events-none" />
                  <input 
                    type="date" 
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    disabled={isReadOnly}
                    className="w-full pl-10 border-2 border-gray-300 rounded-lg text-sm bg-white p-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-gray-100 text-gray-900 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SUBTASKS SECTION */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Subtasks</label>
              <span className="text-xs text-gray-400">
                {subtasks.filter(s => s.is_completed).length}/{subtasks.length}
              </span>
            </div>
            
            {/* Progress Bar */}
            {subtasks.length > 0 && (
              <div className="w-full bg-gray-100 rounded-full h-2 mb-4">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${subtasks.length > 0 ? (subtasks.filter(s => s.is_completed).length / subtasks.length) * 100 : 0}%` }}
                ></div>
              </div>
            )}

            {/* List */}
            <div className="space-y-1 mb-3">
              {subtasks.map(sub => (
                <div key={sub.id} className="group relative">
                  <div className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded transition">
                    <button 
                      onClick={() => toggleSubtask(sub.id, sub.is_completed)}
                      disabled={isReadOnly}
                      className={`text-gray-400 hover:text-blue-600 transition disabled:opacity-60 disabled:cursor-not-allowed ${sub.is_completed ? 'text-green-500' : ''}`}
                    >
                      {sub.is_completed ? <CheckSquare size={16} /> : <Square size={16} />}
                    </button>
                    <span className={`flex-1 text-sm ${sub.is_completed ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                      {sub.title}
                    </span>
                    
                    {/* Assignee and Due Date - Clickable */}
                    <div className="flex items-center gap-1.5">
                      {!isReadOnly ? (
                        <div className="relative">
                          <button
                            onClick={() => setEditingSubtaskId(editingSubtaskId === sub.id ? null : sub.id)}
                            className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded font-medium transition border border-transparent hover:border-blue-300"
                          >
                            {sub.profiles?.username || '+ Assignee'}
                          </button>
                          
                          {/* Assignee Dropdown Menu */}
                          {editingSubtaskId === sub.id && (
                            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[180px] max-h-[200px] overflow-y-auto">
                              <div className="p-1">
                                <button
                                  onClick={async () => {
                                    await supabase.from('subtasks').update({ assignee_id: null }).eq('id', sub.id);
                                    await loadFullDetails();
                                    setEditingSubtaskId(null);
                                  }}
                                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
                                >
                                  -- No Assignee --
                                </button>
                                {members.map(m => (
                                  <button
                                    key={m.id}
                                    onClick={async () => {
                                      await supabase.from('subtasks').update({ assignee_id: m.id }).eq('id', sub.id);
                                      await loadFullDetails();
                                      setEditingSubtaskId(null);
                                    }}
                                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
                                  >
                                    {m.username}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : sub.profiles?.username ? (
                        <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded font-medium">
                          {sub.profiles.username}
                        </span>
                      ) : null}
                      
                      {!isReadOnly ? (
                        <div className="relative">
                          <input
                            type="date"
                            value={sub.due_date || ''}
                            onChange={async (e) => {
                              await supabase.from('subtasks').update({ due_date: e.target.value || null }).eq('id', sub.id);
                              await loadFullDetails();
                            }}
                            className="text-xs px-2 py-0.5 bg-gray-50 text-gray-600 hover:bg-gray-100 rounded font-medium border border-transparent hover:border-gray-300 cursor-pointer"
                          />
                        </div>
                      ) : sub.due_date ? (
                        <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded font-medium flex items-center gap-1">
                          <Calendar size={11} />
                          {new Date(sub.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      ) : null}
                    </div>

                    {/* Delete Button */}
                    {!isReadOnly && (
                      <button 
                        onClick={() => deleteSubtask(sub.id)} 
                        className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Add Button */}
            {!isReadOnly && !showAddSubtaskForm && (
              <button
                onClick={() => setShowAddSubtaskForm(true)}
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 px-2 py-1.5 rounded transition"
              >
                <Plus size={16} />
                <span>Add subtask</span>
              </button>
            )}

            {/* Add Input Form */}
            {!isReadOnly && showAddSubtaskForm && (
              <form onSubmit={addSubtask} className="flex items-center gap-3 p-2 bg-gray-50 rounded border border-gray-200">
                <Plus size={16} className="text-gray-400" />
                <input 
                  value={newSubtaskTitle}
                  onChange={e => setNewSubtaskTitle(e.target.value)}
                  placeholder="Subtask name"
                  className="flex-1 bg-transparent text-sm outline-none text-gray-900"
                  type="text"
                  autoFocus
                />
                
                {/* Assignee and Due Date Badges */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setEditingSubtaskId('new-subtask-assignee');
                    }}
                    className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded font-medium transition border border-transparent hover:border-blue-300"
                  >
                    {newSubtaskAssigneeId ? members.find(m => m.id === newSubtaskAssigneeId)?.username : '+ Assignee'}
                  </button>
                  
                  {/* Assignee Dropdown */}
                  {editingSubtaskId === 'new-subtask-assignee' && (
                    <div className="absolute bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[180px] max-h-[200px] overflow-y-auto mt-24">
                      <div className="p-1">
                        <button
                          type="button"
                          onClick={() => {
                            setNewSubtaskAssigneeId('');
                            setEditingSubtaskId(null);
                          }}
                          className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
                        >
                          -- No Assignee --
                        </button>
                        {members.map(m => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => {
                              setNewSubtaskAssigneeId(m.id);
                              setEditingSubtaskId(null);
                            }}
                            className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
                          >
                            {m.username}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <input
                    type="date"
                    value={newSubtaskDueDate}
                    onChange={(e) => setNewSubtaskDueDate(e.target.value)}
                    className="text-xs px-2 py-0.5 bg-gray-50 text-gray-600 hover:bg-gray-100 rounded font-medium border border-transparent hover:border-gray-300 cursor-pointer"
                  />
                </div>
                
                <button 
                  type="button"
                  onClick={() => {
                    setShowAddSubtaskForm(false);
                    setNewSubtaskTitle('');
                    setNewSubtaskAssigneeId('');
                    setNewSubtaskDueDate('');
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={16} />
                </button>
              </form>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              disabled={isReadOnly}
              className="w-full h-32 border-gray-200 rounded-lg p-4 text-sm bg-gray-50 focus:bg-white transition-all resize-none outline-none disabled:opacity-60 disabled:cursor-not-allowed"
              placeholder="Add more details..."
            />
          </div>

          {/* Comments Section */}
          <CommentsSection taskId={task.id} isReadOnly={isReadOnly} />

        </div>

        {/* FOOTER */}
        <div className="px-6 py-4 border-t bg-gray-50 flex justify-between items-center">
          {!isReadOnly ? (
            <>
              <button onClick={handleDelete} className="flex items-center gap-2 text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg text-sm font-medium">
                <Trash2 size={16} /> Delete
              </button>
              <button onClick={handleSave} disabled={loading} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition shadow-sm disabled:opacity-50">
                <Save size={16} /> {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </>
          ) : (
            <div className="w-full text-center text-sm text-gray-500 py-2">
              👁️ View-only mode
            </div>
          )}
        </div>
      </div>
    </div>
  );
}