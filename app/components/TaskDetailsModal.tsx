"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { X, Trash2, Calendar, Save, Plus, CheckSquare, Square, User, Circle, Flag, CheckCircle, Clock, MessageCircle, ListTodo, GitCommitHorizontal, ArrowRight, UserPlus, UserMinus, AlertCircle, AlertTriangle } from 'lucide-react';
import CommentsSection from './CommentsSection';
import { getDueDateStatus, getDueDateLabel, getDueDateAlertStyles } from '../utils/dueDateUtils';

interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  due_date: string;
  is_completed?: boolean;
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

interface ActivityItem {
  id: string;
  task_id: string;
  user_id: string;
  action: string;
  field?: string;
  old_value?: string;
  new_value?: string;
  metadata?: any;
  created_at: string;
  profiles?: {
    username: string;
    firstname?: string;
    lastname?: string;
  };
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
  const [status, setStatus] = useState(task.status);
  const [priority, setPriority] = useState(task.priority);
  const [dueDate, setDueDate] = useState(task.due_date || '');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [columns, setColumns] = useState<{ id: string; label: string; key: string }[]>([]);

  // Subtask State
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newSubtaskAssigneeId, setNewSubtaskAssigneeId] = useState('');
  const [newSubtaskDueDate, setNewSubtaskDueDate] = useState('');
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
  const [showAddSubtaskForm, setShowAddSubtaskForm] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [activeTab, setActiveTab] = useState<'details' | 'comments' | 'timeline'>('details');
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);

  useEffect(() => {
    loadFullDetails();
    fetchMembers();
    fetchActivities();
  }, [task.id]);

  async function logActivity(action: string, field?: string, oldValue?: string, newValue?: string, metadata?: any) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    await supabase.from('task_activity').insert({
      task_id: task.id,
      user_id: session.user.id,
      action,
      field: field || null,
      old_value: oldValue || null,
      new_value: newValue || null,
      metadata: metadata || {}
    });

    // Refresh activities
    fetchActivities();
  }

  async function fetchActivities() {
    setActivitiesLoading(true);
    const { data, error } = await supabase
      .from('task_activity')
      .select('*, profiles:user_id ( username, firstname, lastname )')
      .eq('task_id', task.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching activities:', error);
    } else if (data) {
      setActivities(data);
    }
    setActivitiesLoading(false);
  }

  async function handleCompletionToggle() {
    const newIsCompleted = !task.is_completed;

    // Update task completion in database immediately
    const { error } = await supabase
      .from('tasks')
      .update({ is_completed: newIsCompleted })
      .eq('id', task.id);

    if (error) {
      console.error('Error updating completion:', error);
      alert('Error updating completion: ' + error.message);
    } else {
      await logActivity(newIsCompleted ? 'task_completed' : 'task_uncompleted', 'is_completed', String(!newIsCompleted), String(newIsCompleted));
      // Refresh the board to show task in new state
      onUpdate();
    }
  }

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
    }

    // 2. Fetch all assignees from task_assignees table
    const { data: assigneeData } = await supabase
      .from('task_assignees')
      .select('user_id')
      .eq('task_id', task.id);

    if (assigneeData) {
      setAssigneeIds(assigneeData.map(a => a.user_id));
    }

    // 3. Fetch Subtasks with Assignee Info
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

    // 4. Fetch Workspace Statuses for Dynamic Dropdown
    if (task.workspace_id) {
      const { data: statusesData } = await supabase
        .from('workspace_statuses')
        .select('id, status_key, status_label')
        .eq('workspace_id', task.workspace_id)
        .order('position', { ascending: true });

      if (statusesData) {
        setColumns(
          statusesData.map(s => ({
            id: s.id,
            key: s.status_key,
            label: s.status_label
          }))
        );
      }
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

    // Track changes for activity log
    if (priority !== task.priority) {
      await logActivity('priority_change', 'priority', task.priority, priority);
    }
    if (dueDate !== (task.due_date || '')) {
      await logActivity('due_date_change', 'due_date', task.due_date || 'none', dueDate || 'none');
    }
    if (title !== task.title) {
      await logActivity('title_change', 'title', task.title, title);
    }

    // Update task details
    const { error } = await supabase
      .from('tasks')
      .update({
        title,
        description,
        priority,
        due_date: dueDate || null,
        assignee_id: assigneeIds.length > 0 ? assigneeIds[0] : null // Keep first as primary
      })
      .eq('id', task.id);

    if (error) {
      alert('Error saving: ' + error.message);
      setLoading(false);
      return;
    }

    // Update task_assignees table
    // First, delete existing assignees
    await supabase
      .from('task_assignees')
      .delete()
      .eq('task_id', task.id);

    // Then insert new assignees
    if (assigneeIds.length > 0) {
      const assigneeRecords = assigneeIds.map(userId => ({
        task_id: task.id,
        user_id: userId
      }));

      await supabase
        .from('task_assignees')
        .insert(assigneeRecords);
    }

    onUpdate();
    onClose();
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
      await logActivity('subtask_added', 'subtask', undefined, newSubtaskTitle, { subtask_id: data.id });
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

    // 3. Log activity
    const subtaskName = subtasks.find(s => s.id === subtaskId)?.title || '';
    await logActivity(
      !currentStatus ? 'subtask_completed' : 'subtask_uncompleted',
      'subtask',
      undefined,
      subtaskName,
      { subtask_id: subtaskId }
    );

    // 4. Trigger parent update (to refresh progress bar on board)
    onUpdate();
  };

  const deleteSubtask = async (subtaskId: string) => {
    const subtaskName = subtasks.find(s => s.id === subtaskId)?.title || '';
    setSubtasks(subtasks.filter(s => s.id !== subtaskId));
    await supabase.from('subtasks').delete().eq('id', subtaskId);
    await logActivity('subtask_deleted', 'subtask', subtaskName, undefined, { subtask_id: subtaskId });
    onUpdate();
  };

  // --- TIMELINE HELPERS ---

  function getActivityDotColor(action: string): string {
    switch (action) {
      case 'status_change': return 'border-blue-500 bg-blue-500';
      case 'priority_change': return 'border-orange-500 bg-orange-500';
      case 'assignee_added': return 'border-green-500 bg-green-500';
      case 'assignee_removed': return 'border-red-500 bg-red-500';
      case 'subtask_added': return 'border-purple-500 bg-purple-500';
      case 'subtask_completed': return 'border-green-500 bg-green-500';
      case 'subtask_uncompleted': return 'border-yellow-500 bg-yellow-500';
      case 'subtask_deleted': return 'border-red-400 bg-red-400';
      case 'due_date_change': return 'border-cyan-500 bg-cyan-500';
      case 'title_change': return 'border-indigo-500 bg-indigo-500';
      case 'created': return 'border-gray-500 bg-gray-500';
      default: return 'border-gray-400 bg-gray-400';
    }
  }

  function getActivityDescription(activity: ActivityItem): string {
    switch (activity.action) {
      case 'status_change':
        return `changed status`;
      case 'priority_change':
        return `changed priority`;
      case 'assignee_added':
        return `added an assignee`;
      case 'assignee_removed':
        return `removed an assignee`;
      case 'subtask_added':
        return `added subtask "${activity.new_value}"`;
      case 'subtask_completed':
        return `completed subtask "${activity.new_value}"`;
      case 'subtask_uncompleted':
        return `uncompleted subtask "${activity.new_value}"`;
      case 'subtask_deleted':
        return `deleted subtask "${activity.old_value}"`;
      case 'due_date_change':
        return `changed due date`;
      case 'title_change':
        return `renamed the task`;
      case 'description_updated':
        return `updated the description`;
      case 'created':
        return `created this task`;
      default:
        return activity.action.replace(/_/g, ' ');
    }
  }

  function formatValue(field: string, value: string): string {
    if (field === 'status') {
      return value.replace(/_/g, ' ').toUpperCase();
    }
    if (field === 'priority') {
      const labels: Record<string, string> = { P1: 'Critical', P2: 'High', P3: 'Normal', P4: 'Low' };
      return labels[value] || value;
    }
    if (field === 'due_date' && value !== 'none') {
      try {
        return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      } catch { return value; }
    }
    return value;
  }

  function formatActivityTime(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl w-full max-w-2xl h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">

        {/* HEADER */}
        <div className="px-6 py-4 border-b flex items-center gap-3 bg-gray-50">
          <button
            onClick={handleCompletionToggle}
            disabled={isReadOnly}
            className={`flex-shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all ${task.is_completed
              ? 'bg-green-500 border-green-500 hover:bg-green-600'
              : 'bg-white border-gray-300 hover:border-green-500'
              } disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer`}
          >
            {task.is_completed && (
              <CheckCircle size={16} className="text-white" strokeWidth={3} />
            )}
          </button>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            disabled={isReadOnly}
            className={`text-xl font-bold bg-transparent border-none focus:ring-0 flex-1 text-gray-800 placeholder-gray-400 outline-none disabled:opacity-60 disabled:cursor-not-allowed ${task.is_completed ? 'line-through text-gray-400' : ''
              }`}
          />
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
            <X size={24} />
          </button>
        </div>

        {/* TABS */}
        <div className="px-6 border-b bg-white flex gap-1">
          {[
            { key: 'details' as const, label: 'Details', icon: <ListTodo size={14} /> },
            { key: 'comments' as const, label: 'Comments', icon: <MessageCircle size={14} /> },
            { key: 'timeline' as const, label: 'Timeline', icon: <Clock size={14} /> },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${activeTab === tab.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* === DETAILS TAB === */}
          {activeTab === 'details' && (<>
            {/* Task Properties - Grid Layout */}
            <div className="space-y-3">
              {/* Status Row */}
              <div className="flex items-center py-2 border-b border-gray-100">
                <div className="w-32 flex items-center gap-2 text-sm text-gray-600">
                  <Circle size={14} />
                  <span>Status</span>
                </div>
                <div className="flex-1">
                  {isReadOnly ? (
                    <span className="inline-flex items-center px-3 py-1 rounded bg-blue-100 text-blue-700 text-sm font-medium">
                      {status.replace('_', ' ').toUpperCase()}
                    </span>
                  ) : (
                    <select
                      value={status}
                      onChange={async (e) => {
                        const newStatus = e.target.value;
                        setStatus(newStatus);
                        const { error } = await supabase.from('tasks').update({ status: newStatus }).eq('id', task.id);
                        if (!error) {
                          await logActivity('status_change', 'status', status, newStatus);
                          onUpdate();
                        }
                      }}
                      className="text-sm border border-gray-300 rounded px-3 py-1 bg-white text-gray-700 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer font-medium"
                    >
                      {columns.map(col => (
                        <option key={col.key} value={col.key}>{col.label.toUpperCase()}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Assignees Row */}
              <div className="flex items-start py-2 border-b border-gray-100">
                <div className="w-32 flex items-center gap-2 text-sm text-gray-600 pt-1">
                  <User size={14} />
                  <span>Assignees</span>
                </div>
                <div className="flex-1">
                  {assigneeIds.length > 0 ? (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {assigneeIds.map(id => {
                        const member = members.find(m => m.id === id);
                        if (!member) return null;
                        return (
                          <div key={id} className="flex items-center gap-1.5 group">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-pink-400 to-pink-600 text-white flex items-center justify-center text-xs font-bold shadow-sm">
                              {member.username.charAt(0).toUpperCase()}
                            </div>
                            {!isReadOnly && (
                              <button
                                type="button"
                                onClick={() => setAssigneeIds(assigneeIds.filter(aid => aid !== id))}
                                className="opacity-0 group-hover:opacity-100 -ml-1 w-4 h-4 bg-gray-600 hover:bg-gray-700 text-white rounded-full flex items-center justify-center text-xs transition"
                                title={`Remove ${member.username}`}
                              >
                                ×
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400">Empty</span>
                  )}
                  {!isReadOnly && (
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value && !assigneeIds.includes(e.target.value)) {
                          setAssigneeIds([...assigneeIds, e.target.value]);
                        }
                      }}
                      className="mt-1 text-sm border border-gray-300 rounded px-2 py-1 bg-white text-gray-700 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                      <option value="">+ Add assignee</option>
                      {members
                        .filter(m => !assigneeIds.includes(m.id))
                        .map(m => (
                          <option key={m.id} value={m.id}>
                            {m.username}
                          </option>
                        ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Due Date Row */}
              <div className="flex items-center py-2 border-b border-gray-100">
                <div className="w-32 flex items-center gap-2 text-sm text-gray-600">
                  <Calendar size={14} />
                  <span>Due Date</span>
                </div>
                <div className="flex-1">
                  {isReadOnly ? (
                    <span className="text-sm text-gray-700">
                      {dueDate ? new Date(dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Empty'}
                    </span>
                  ) : (
                    <input
                      type="date"
                      value={dueDate}
                      onChange={e => setDueDate(e.target.value)}
                      className="text-sm border border-gray-300 rounded px-2 py-1 bg-white text-gray-700 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    />
                  )}
                </div>
              </div>

              {/* Due Date Urgency Alert */}
              {(() => {
                const dueDateAlertStatus = getDueDateStatus(dueDate, status);
                const alertStyles = getDueDateAlertStyles(dueDateAlertStatus);
                const alertLabel = getDueDateLabel(dueDate, status);
                if (!alertStyles) return null;
                return (
                  <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${alertStyles.bg} ${alertStyles.border}`}>
                    <AlertTriangle size={18} className={alertStyles.icon} />
                    <div className="flex-1">
                      <span className={`text-sm font-semibold ${alertStyles.text}`}>
                        {alertStyles.emoji} {alertStyles.label}
                      </span>
                      <span className={`text-sm ml-2 ${alertStyles.text} opacity-80`}>
                        — {alertLabel}
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Priority Row */}
              <div className="flex items-center py-2 border-b border-gray-100">
                <div className="w-32 flex items-center gap-2 text-sm text-gray-600">
                  <Flag size={14} />
                  <span>Priority</span>
                </div>
                <div className="flex-1">
                  {isReadOnly ? (
                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${priority === 'P1' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                      {priority === 'P1' ? 'Critical' : 'Normal'}
                    </span>
                  ) : (
                    <button
                      onClick={() => setPriority(priority === 'P1' ? 'P3' : 'P1')}
                      className={`inline-flex items-center px-3 py-1 rounded text-sm font-medium transition ${priority === 'P1' ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                      {priority === 'P1' ? '🔴 Critical' : '⚪ Normal'}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Description Section */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Description</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                disabled={isReadOnly}
                placeholder="Add description..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:cursor-not-allowed min-h-[100px] resize-y"
              /></div>

            {/* SUBTASKS SECTION - Table Format */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-semibold text-gray-700">Subtasks</label>
                  {subtasks.length > 0 && (
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                      {subtasks.filter(s => s.is_completed).length}/{subtasks.length}
                    </span>
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              {subtasks.length > 0 && (
                <div className="w-full bg-gray-100 rounded-full h-1.5 mb-4">
                  <div
                    className="bg-green-500 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${subtasks.length > 0 ? (subtasks.filter(s => s.is_completed).length / subtasks.length) * 100 : 0}%` }}
                  ></div>
                </div>
              )}

              {/* Table */}
              {subtasks.length > 0 && (
                <div className="border border-gray-200 rounded-lg overflow-hidden mb-3">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left py-2 px-3 text-xs font-medium text-gray-600 w-10"></th>
                        <th className="text-left py-2 px-3 text-xs font-medium text-gray-600">Name</th>
                        <th className="text-left py-2 px-3 text-xs font-medium text-gray-600 w-32">Assignee</th>
                        <th className="text-left py-2 px-3 text-xs font-medium text-gray-600 w-28">Due date</th>
                        {!isReadOnly && <th className="w-10"></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {subtasks.map(sub => (
                        <tr key={sub.id} className="border-b border-gray-100 hover:bg-gray-50 transition group">
                          <td className="py-2 px-3">
                            <button
                              onClick={() => toggleSubtask(sub.id, sub.is_completed)}
                              disabled={isReadOnly}
                              className={`transition disabled:opacity-60 disabled:cursor-not-allowed ${sub.is_completed ? 'text-green-500' : 'text-gray-400 hover:text-blue-600'}`}
                            >
                              {sub.is_completed ? <CheckSquare size={16} /> : <Square size={16} />}
                            </button>
                          </td>
                          <td className="py-2 px-3">
                            <span className={`${sub.is_completed ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                              {sub.title}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            {!isReadOnly ? (
                              <div className="relative">
                                {sub.profiles?.username ? (
                                  <button
                                    onClick={() => setEditingSubtaskId(editingSubtaskId === sub.id ? null : sub.id)}
                                    className="flex items-center gap-1.5 hover:bg-gray-100 px-2 py-1 rounded transition"
                                  >
                                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-pink-400 to-pink-600 text-white flex items-center justify-center text-[10px] font-bold">
                                      {sub.profiles.username.charAt(0).toUpperCase()}
                                    </div>
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => setEditingSubtaskId(editingSubtaskId === sub.id ? null : sub.id)}
                                    className="flex items-center gap-1.5 text-gray-400 hover:text-gray-600 px-2 py-1 rounded transition"
                                  >
                                    <User size={14} />
                                  </button>
                                )}

                                {editingSubtaskId === sub.id && (
                                  <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[160px] max-h-[180px] overflow-y-auto">
                                    <div className="p-1">
                                      <button
                                        onClick={async () => {
                                          await supabase.from('subtasks').update({ assignee_id: null }).eq('id', sub.id);
                                          await loadFullDetails();
                                          setEditingSubtaskId(null);
                                        }}
                                        className="w-full text-left px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded"
                                      >
                                        No assignee
                                      </button>
                                      {members.map(m => (
                                        <button
                                          key={m.id}
                                          onClick={async () => {
                                            await supabase.from('subtasks').update({ assignee_id: m.id }).eq('id', sub.id);
                                            await loadFullDetails();
                                            setEditingSubtaskId(null);
                                          }}
                                          className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 rounded flex items-center gap-2"
                                        >
                                          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-pink-400 to-pink-600 text-white flex items-center justify-center text-[10px] font-bold">
                                            {m.username.charAt(0).toUpperCase()}
                                          </div>
                                          {m.username}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : sub.profiles?.username ? (
                              <div className="flex items-center gap-1.5">
                                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-pink-400 to-pink-600 text-white flex items-center justify-center text-[10px] font-bold">
                                  {sub.profiles.username.charAt(0).toUpperCase()}
                                </div>
                              </div>
                            ) : (
                              <span className="text-gray-400 text-xs">-</span>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            {!isReadOnly ? (
                              <input
                                type="date"
                                value={sub.due_date || ''}
                                onChange={async (e) => {
                                  await supabase.from('subtasks').update({ due_date: e.target.value || null }).eq('id', sub.id);
                                  await loadFullDetails();
                                }}
                                className="text-xs px-2 py-1 border border-gray-300 rounded hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer w-full"
                              />
                            ) : sub.due_date ? (
                              <span className="text-xs text-gray-600">
                                {new Date(sub.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-xs">-</span>
                            )}
                          </td>
                          {!isReadOnly && (
                            <td className="py-2 px-3">
                              <button
                                onClick={() => deleteSubtask(sub.id)}
                                className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

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

          </>)}

          {/* === COMMENTS TAB === */}
          {activeTab === 'comments' && (
            <CommentsSection taskId={task.id} isReadOnly={isReadOnly} />
          )}

          {/* === TIMELINE TAB === */}
          {activeTab === 'timeline' && (
            <div className="space-y-1">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Clock size={16} />
                  Activity Timeline
                </h3>
                <button
                  onClick={fetchActivities}
                  className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100 transition"
                >
                  Refresh
                </button>
              </div>

              {activitiesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              ) : activities.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Clock size={32} className="mx-auto mb-3 opacity-50" />
                  <p className="text-sm font-medium">No activity yet</p>
                  <p className="text-xs mt-1">Actions on this task will appear here</p>
                </div>
              ) : (
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-[17px] top-2 bottom-2 w-0.5 bg-gray-200"></div>

                  <div className="space-y-0">
                    {activities.map((activity, index) => {
                      const isFirst = index === 0;
                      return (
                        <div key={activity.id} className={`relative flex gap-3 py-3 ${isFirst ? '' : ''}`}>
                          {/* Timeline dot */}
                          <div className="relative z-10 flex-shrink-0 mt-0.5">
                            <div className={`w-[9px] h-[9px] rounded-full border-2 ${getActivityDotColor(activity.action)}`}
                              style={{ marginLeft: '13px' }}></div>
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0 ml-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm text-gray-700 leading-snug">
                                <span className="font-medium text-gray-900">
                                  {activity.profiles?.username || 'Unknown'}
                                </span>{' '}
                                {getActivityDescription(activity)}
                              </p>
                              <time className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0 mt-0.5">
                                {formatActivityTime(activity.created_at)}
                              </time>
                            </div>

                            {/* Change detail badges */}
                            {(activity.old_value || activity.new_value) && activity.action !== 'subtask_added' && activity.action !== 'subtask_completed' && activity.action !== 'subtask_uncompleted' && activity.action !== 'subtask_deleted' && (
                              <div className="flex items-center gap-1.5 mt-1.5">
                                {activity.old_value && activity.old_value !== 'none' && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-red-50 text-red-600 line-through">
                                    {formatValue(activity.field || '', activity.old_value)}
                                  </span>
                                )}
                                {activity.old_value && activity.new_value && activity.old_value !== 'none' && activity.new_value !== 'none' && (
                                  <ArrowRight size={12} className="text-gray-400" />
                                )}
                                {activity.new_value && activity.new_value !== 'none' && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-green-50 text-green-700">
                                    {formatValue(activity.field || '', activity.new_value)}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

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