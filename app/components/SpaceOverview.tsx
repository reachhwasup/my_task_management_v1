"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { FolderOpen, CheckCircle, Clock, AlertCircle, Calendar, TrendingUp, ArrowRight, Activity } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Props {
  spaceId?: string;
  workspaceId: string;
}

interface Space {
  id: string;
  name: string;
  description?: string;
  color?: string;
}

interface Folder {
  id: string;
  name: string;
  description?: string;
}

interface Stats {
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
  notStarted: number;
  overdue: number;
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
  };
  tasks?: {
    title: string;
  };
}

export default function SpaceOverview({ spaceId, workspaceId }: Props) {
  const router = useRouter();
  const [space, setSpace] = useState<Space | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, completed: 0, inProgress: 0, pending: 0, notStarted: 0, overdue: 0 });
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [spaceId, workspaceId]);

  async function fetchData() {
    setLoading(true);

    // Fetch space info
    if (spaceId) {
      const { data: spaceData } = await supabase
        .from('spaces')
        .select('*')
        .eq('id', spaceId)
        .single();
      
      if (spaceData) setSpace(spaceData);

      // Fetch folders in this space
      const { data: foldersData } = await supabase
        .from('folders')
        .select('*')
        .eq('space_id', spaceId)
        .order('position', { ascending: true });
      
      if (foldersData) setFolders(foldersData);
    }

    // Fetch task statistics
    await fetchStats();
    await fetchRecentActivity();
    
    setLoading(false);
  }

  async function fetchStats() {
    let query = supabase
      .from('tasks')
      .select('status, due_date')
      .eq('workspace_id', workspaceId);

    if (spaceId) {
      query = query.eq('space_id', spaceId);
    }

    const { data: tasks } = await query;

    if (tasks) {
      const now = new Date();
      const stats: Stats = {
        total: tasks.length,
        completed: tasks.filter(t => t.status === 'completed').length,
        inProgress: tasks.filter(t => t.status === 'in_progress').length,
        pending: tasks.filter(t => t.status === 'pending').length,
        notStarted: tasks.filter(t => t.status === 'not_started').length,
        overdue: tasks.filter(t => {
          if (t.status === 'completed') return false;
          if (!t.due_date) return false;
          return new Date(t.due_date) < now;
        }).length,
      };
      setStats(stats);
    }
  }

  async function fetchRecentActivity() {
    // Get task IDs in this workspace/space first
    let taskQuery = supabase
      .from('tasks')
      .select('id')
      .eq('workspace_id', workspaceId);
    
    if (spaceId) {
      taskQuery = taskQuery.eq('space_id', spaceId);
    }

    const { data: taskIds } = await taskQuery;
    if (!taskIds || taskIds.length === 0) return;

    const ids = taskIds.map(t => t.id);

    const { data, error } = await supabase
      .from('task_activity')
      .select('*, profiles:user_id ( username ), tasks:task_id ( title )')
      .in('task_id', ids)
      .order('created_at', { ascending: false })
      .limit(15);

    if (!error && data) {
      setRecentActivity(data);
    }
  }

  function getActivityIcon(action: string) {
    switch (action) {
      case 'status_change': return <Activity size={14} className="text-blue-500" />;
      case 'priority_change': return <AlertCircle size={14} className="text-orange-500" />;
      case 'subtask_completed': return <CheckCircle size={14} className="text-green-500" />;
      case 'subtask_added': return <Calendar size={14} className="text-purple-500" />;
      case 'due_date_change': return <Clock size={14} className="text-cyan-500" />;
      default: return <Activity size={14} className="text-gray-400" />;
    }
  }

  function getActivityText(a: ActivityItem): string {
    const taskName = a.tasks?.title || 'a task';
    switch (a.action) {
      case 'status_change':
        return `changed status of "${taskName}" to ${(a.new_value || '').replace(/_/g, ' ')}`;
      case 'priority_change':
        return `changed priority of "${taskName}"`;
      case 'subtask_added':
        return `added subtask "${a.new_value}" to "${taskName}"`;
      case 'subtask_completed':
        return `completed subtask "${a.new_value}" in "${taskName}"`;
      case 'subtask_uncompleted':
        return `uncompleted subtask "${a.new_value}" in "${taskName}"`;
      case 'subtask_deleted':
        return `removed subtask "${a.old_value}" from "${taskName}"`;
      case 'due_date_change':
        return `updated due date of "${taskName}"`;
      case 'title_change':
        return `renamed "${a.old_value}" to "${a.new_value}"`;
      default:
        return `${a.action.replace(/_/g, ' ')} on "${taskName}"`;
    }
  }

  function formatTime(dateStr: string): string {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {space?.name || 'Overview'}
        </h1>
        {space?.description && (
          <p className="text-gray-600">{space?.description}</p>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Total Tasks</span>
            <Calendar className="text-gray-400" size={20} />
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Completed</span>
            <CheckCircle className="text-green-500" size={20} />
          </div>
          <p className="text-3xl font-bold text-green-600">{stats.completed}</p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">In Progress</span>
            <Clock className="text-blue-500" size={20} />
          </div>
          <p className="text-3xl font-bold text-blue-600">{stats.inProgress}</p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Overdue</span>
            <AlertCircle className="text-red-500" size={20} />
          </div>
          <p className="text-3xl font-bold text-red-600">{stats.overdue}</p>
        </div>
      </div>

      {/* Project Progress Section */}
      {stats.total > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-5 flex items-center gap-2">
            <TrendingUp size={22} className="text-blue-600" />
            Project Progress
          </h2>

          {/* Overall Progress Bar */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Overall Completion</span>
              <span className="text-sm font-bold text-gray-900">
                {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}%
              </span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-green-400 to-green-600 transition-all duration-700 ease-out"
                style={{ width: `${stats.total > 0 ? (stats.completed / stats.total) * 100 : 0}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-500 mt-1.5">
              {stats.completed} of {stats.total} tasks completed
            </p>
          </div>

          {/* Status Distribution Bar */}
          <div className="mb-5">
            <span className="text-sm font-medium text-gray-700 mb-2 block">Status Breakdown</span>
            <div className="w-full h-6 rounded-full overflow-hidden flex bg-gray-100">
              {stats.completed > 0 && (
                <div
                  className="h-full bg-green-500 transition-all duration-500 relative group"
                  style={{ width: `${(stats.completed / stats.total) * 100}%` }}
                  title={`Completed: ${stats.completed}`}
                >
                  {(stats.completed / stats.total) * 100 > 10 && (
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white">
                      {stats.completed}
                    </span>
                  )}
                </div>
              )}
              {stats.inProgress > 0 && (
                <div
                  className="h-full bg-blue-500 transition-all duration-500 relative group"
                  style={{ width: `${(stats.inProgress / stats.total) * 100}%` }}
                  title={`In Progress: ${stats.inProgress}`}
                >
                  {(stats.inProgress / stats.total) * 100 > 10 && (
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white">
                      {stats.inProgress}
                    </span>
                  )}
                </div>
              )}
              {stats.pending > 0 && (
                <div
                  className="h-full bg-yellow-400 transition-all duration-500 relative group"
                  style={{ width: `${(stats.pending / stats.total) * 100}%` }}
                  title={`Pending: ${stats.pending}`}
                >
                  {(stats.pending / stats.total) * 100 > 10 && (
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-gray-700">
                      {stats.pending}
                    </span>
                  )}
                </div>
              )}
              {stats.notStarted > 0 && (
                <div
                  className="h-full bg-gray-300 transition-all duration-500 relative group"
                  style={{ width: `${(stats.notStarted / stats.total) * 100}%` }}
                  title={`Not Started: ${stats.notStarted}`}
                >
                  {(stats.notStarted / stats.total) * 100 > 10 && (
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-gray-600">
                      {stats.notStarted}
                    </span>
                  )}
                </div>
              )}
            </div>
            {/* Legend */}
            <div className="flex flex-wrap gap-4 mt-3">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="text-xs text-gray-600">Completed ({stats.completed})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <span className="text-xs text-gray-600">In Progress ({stats.inProgress})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                <span className="text-xs text-gray-600">Pending ({stats.pending})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-gray-300"></div>
                <span className="text-xs text-gray-600">Not Started ({stats.notStarted})</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Activity Timeline */}
      {recentActivity.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-5 flex items-center gap-2">
            <Clock size={22} className="text-blue-600" />
            Recent Activity
          </h2>

          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-gray-200"></div>

            <div className="space-y-0">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="relative flex gap-3 py-2.5">
                  {/* Dot */}
                  <div className="relative z-10 flex-shrink-0 mt-1">
                    <div className="w-[23px] h-[23px] rounded-full bg-white border-2 border-gray-200 flex items-center justify-center">
                      {getActivityIcon(activity.action)}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 leading-snug">
                      <span className="font-semibold text-gray-900">
                        {activity.profiles?.username || 'Someone'}
                      </span>{' '}
                      {getActivityText(activity)}
                    </p>
                    {/* Change badges */}
                    {activity.action === 'status_change' && activity.old_value && activity.new_value && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] bg-gray-100 text-gray-600 line-through">
                          {activity.old_value.replace(/_/g, ' ').toUpperCase()}
                        </span>
                        <ArrowRight size={11} className="text-gray-400" />
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] bg-green-50 text-green-700 font-medium">
                          {activity.new_value.replace(/_/g, ' ').toUpperCase()}
                        </span>
                      </div>
                    )}
                    <time className="text-[11px] text-gray-400 mt-0.5 block">
                      {formatTime(activity.created_at)}
                    </time>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Folders Section */}
      {spaceId && folders.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FolderOpen size={24} className="text-gray-600" />
            Folders
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {folders.map((folder) => (
              <button
                key={folder.id}
                onClick={() => router.push(`/?workspace=${workspaceId}&space=${spaceId}&folder=${folder.id}`)}
                className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-all text-left group cursor-pointer"
              >
                <div className="flex items-center gap-3 mb-2">
                  <FolderOpen size={20} className="text-gray-400 group-hover:text-blue-600" />
                  <span className="font-medium text-gray-900">{folder.name}</span>
                </div>
                {folder.description && (
                  <p className="text-sm text-gray-500 mb-2">{folder.description}</p>
                )}
                <p className="text-xs text-gray-400">Click to view tasks →</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* View Tasks Button */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-8 text-center border border-blue-200">
        <TrendingUp size={48} className="mx-auto mb-4 text-blue-600" />
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Ready to work?</h3>
        <p className="text-gray-600 mb-6">View and manage all tasks in the board view</p>
        <button
          onClick={() => {
            const params = new URLSearchParams();
            params.set('workspace', workspaceId);
            if (spaceId) params.set('space', spaceId);
            params.set('view', 'tasks');
            router.push(`/?${params.toString()}`);
          }}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-md"
        >
          View All Tasks in Space
        </button>
      </div>
    </div>
  );
}
