"use client";

import { Suspense, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter, useSearchParams } from 'next/navigation';
import NewTaskModal from './components/NewTaskModal';
import TaskBoard from './components/TaskBoard';
import TaskDetailsModal from './components/TaskDetailsModal';
import WorkspaceSwitcher from './components/WorkspaceSwitcher';
import CreateWorkspaceModal from './components/CreateWorkspaceModal';
import InviteMemberModal from './components/InviteMemberModal';
import NotificationsPanel from './components/NotificationsPanel';
import AddStatusModal from './components/AddStatusModal';
import ProfileDropdown from './components/ProfileDropdown';
import ProfileSettingsModal from './components/ProfileSettingsModal';
import Sidebar from './components/Sidebar';
import SpaceOverview from './components/SpaceOverview';
import TimelineView from './components/TimelineView';
import DashboardCharts from './components/DashboardCharts';
import { Settings, LayoutGrid, Clock, BarChart3, AlertTriangle, TrendingUp } from 'lucide-react';
import { getDueDateStatus } from './utils/dueDateUtils';

// 1. Define the Task Interface
// This matches what we fetch from Supabase
interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  description: string;
  due_date: string;
  is_completed?: boolean;
  workspace_id: string;
  assignee_id?: string;
  assignee?: {
    username: string;
    firstname?: string;
    lastname?: string;
  };
  // Multiple assignees
  task_assignees?: Array<{
    profiles: {
      username: string;
      firstname?: string;
      lastname?: string;
    };
  }>;
  // We fetch subtasks to show the "2/5" count on the board
  subtasks: { id: string; title: string; is_completed: boolean }[];
}

function DashboardContent() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [listId, setListId] = useState<string | null>(null);
  const [currentSpaceName, setCurrentSpaceName] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'overview' | 'tasks' | 'timeline' | 'dashboard'>('tasks');
  const [userId, setUserId] = useState<string | null>(null);
  const [userPermission, setUserPermission] = useState<string>('viewer');

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAssignee, setFilterAssignee] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterDueDate, setFilterDueDate] = useState<string>('all');
  const [members, setMembers] = useState<{ id: string; username: string }[]>([]);

  // Modal States
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
  const [isCreateWorkspaceModalOpen, setIsCreateWorkspaceModalOpen] = useState(false);
  const [isInviteMemberModalOpen, setIsInviteMemberModalOpen] = useState(false);
  const [isAddStatusModalOpen, setIsAddStatusModalOpen] = useState(false);
  const [isProfileSettingsOpen, setIsProfileSettingsOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [preselectedStatus, setPreselectedStatus] = useState<string>('not_started');

  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    checkUserAndWorkspace();
  }, []);

  // Handle workspace, space, folder, and view switching from URL
  useEffect(() => {
    const workspaceFromUrl = searchParams.get('workspace');
    const spaceFromUrl = searchParams.get('space');
    const folderFromUrl = searchParams.get('folder');
    const listFromUrl = searchParams.get('list');
    const viewFromUrl = searchParams.get('view');
    const createTaskParam = searchParams.get('createTask');

    // Only sync from URL if there's a workspace in URL and we don't have one yet, or if loading is not in progress
    if (workspaceFromUrl && workspaceFromUrl !== workspaceId && !loading) {
      console.log('URL workspace mismatch - URL:', workspaceFromUrl, 'State:', workspaceId);
      // Handle workspace change properly with async
      (async () => {
        await handleWorkspaceChange(workspaceFromUrl);
      })();
      return; // Let handleWorkspaceChange fetch tasks
    }

    // Only process space/folder changes if we have a workspace
    if (!workspaceId) return;

    // Handle createTask parameter - open modal when requested
    if (createTaskParam === 'true' && !isNewTaskModalOpen) {
      setIsNewTaskModalOpen(true);
      // Remove the createTask param from URL
      const params = new URLSearchParams(searchParams.toString());
      params.delete('createTask');
      router.replace(`/?${params.toString()}`);
    }

    // Update view mode: show overview when space selected (no folder), tasks when list/folder selected or view=tasks
    if (viewFromUrl === 'tasks' || viewFromUrl === 'board') {
      setViewMode('tasks');
    } else if (viewFromUrl === 'timeline') {
      setViewMode('timeline');
    } else if (viewFromUrl === 'dashboard') {
      setViewMode('dashboard');
    } else if (listFromUrl || folderFromUrl) {
      // When list or folder is selected, keep current view if already on timeline/dashboard, else tasks
      if (viewMode !== 'timeline' && viewMode !== 'dashboard') setViewMode('tasks');
    } else if (spaceFromUrl) {
      // When only space is selected (no folder), show overview
      setViewMode('overview');
    } else {
      if (viewMode !== 'timeline' && viewMode !== 'dashboard') setViewMode('tasks');
    }

    // Handle list changes
    if (listFromUrl !== listId) {
      setListId(listFromUrl);
    }

    // Handle folder changes
    if (folderFromUrl !== folderId) {
      setFolderId(folderFromUrl);
      if (folderFromUrl || listFromUrl) {
        // When folder or list changes, load tasks
        setLoading(true);
        fetchTasks(workspaceId, spaceFromUrl, folderFromUrl, listFromUrl);
      }
    }

    if (spaceFromUrl && spaceFromUrl !== spaceId) {
      setSpaceId(spaceFromUrl);
      fetchSpaceName(spaceFromUrl);
      if (viewFromUrl === 'tasks' || folderFromUrl || listFromUrl) {
        setLoading(true);
        fetchTasks(workspaceId, spaceFromUrl, folderFromUrl, listFromUrl);
      }
    } else if (!spaceFromUrl && spaceId) {
      setSpaceId(null);
      setFolderId(null);
      setListId(null);
      setCurrentSpaceName(null);
      setLoading(true);
      fetchTasks(workspaceId, null, null, null);
    }
  }, [searchParams, workspaceId]);

  async function checkUserAndWorkspace() {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/login');
      return;
    }
    setUserId(session.user.id);

    // Fetch the user's first workspace (or load from localStorage)
    const savedWorkspaceId = localStorage.getItem('currentWorkspaceId');

    const { data: members } = await supabase
      .from('workspace_members')
      .select('workspace_id, permission')
      .eq('user_id', session.user.id)
      .order('joined_at', { ascending: true });

    if (members && members.length > 0) {
      // Try to load saved workspace, or use first one
      const targetWorkspace = members.find(m => m.workspace_id === savedWorkspaceId) || members[0];
      const wsId = targetWorkspace.workspace_id;
      setWorkspaceId(wsId);
      setUserPermission(targetWorkspace.permission);

      // Set workspace in URL if not already present
      const workspaceFromUrl = searchParams.get('workspace');
      if (!workspaceFromUrl) {
        router.replace(`/?workspace=${wsId}`);
      }

      await fetchTasks(wsId);
      fetchWorkspaceMembers(wsId);
    } else {
      setLoading(false);
    }
  }

  async function handleWorkspaceChange(newWorkspaceId: string) {
    // Prevent switching if already on this workspace
    if (newWorkspaceId === workspaceId) {
      console.log('Already on workspace:', newWorkspaceId);
      return;
    }

    console.log('Switching workspace from', workspaceId, 'to', newWorkspaceId);

    // Set loading immediately
    setLoading(true);

    // Update URL FIRST before state to prevent useEffect loop
    router.replace(`/?workspace=${newWorkspaceId}`, { scroll: false });

    // Update workspace and persist
    setWorkspaceId(newWorkspaceId);
    localStorage.setItem('currentWorkspaceId', newWorkspaceId);

    // Clear state after workspace ID is set
    setTasks([]);
    setSpaceId(null);
    setFolderId(null);
    setListId(null);
    setCurrentSpaceName(null);
    setViewMode('tasks');
    setMembers([]);

    // Reset filters
    setSearchQuery('');
    setFilterAssignee('all');
    setFilterPriority('all');

    // Fetch new workspace data in parallel
    try {
      await Promise.all([
        fetchTasks(newWorkspaceId, null, null, null),
        fetchWorkspaceMembers(newWorkspaceId),
        fetchUserPermission(newWorkspaceId)
      ]);
      console.log('Workspace switch complete');
    } catch (error) {
      console.error('Error during workspace switch:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchUserPermission(wsId: string) {
    if (!userId) return;
    const { data } = await supabase
      .from('workspace_members')
      .select('permission')
      .eq('workspace_id', wsId)
      .eq('user_id', userId)
      .single();

    if (data) setUserPermission(data.permission);
  }

  async function fetchWorkspaceMembers(wsId: string) {
    console.log('Fetching members for workspace:', wsId);
    const { data, error } = await supabase
      .from('workspace_members')
      .select('user_id, profiles ( username )')
      .eq('workspace_id', wsId);

    if (error) {
      console.error('Error fetching workspace members:', error);
      return;
    }

    console.log('Workspace members data:', data);

    if (data) {
      setMembers(
        data.map((m: any) => ({
          id: m.user_id,
          username: m.profiles?.username || 'Unknown'
        }))
      );
    }
  }

  async function fetchSpaceName(spcId: string) {
    const { data } = await supabase
      .from('spaces')
      .select('name')
      .eq('id', spcId)
      .single();

    if (data) {
      setCurrentSpaceName(data.name);
    }
  }

  async function fetchTasks(wsId: string, spcId: string | null = null, fldId: string | null = null, lstId: string | null = null) {
    if (!wsId) {
      setTasks([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log('Fetching tasks for workspace:', wsId, 'space:', spcId, 'folder:', fldId, 'list:', lstId);

      // We select *, plus the subtasks ID and status to count them, and assignee profile
      let query = supabase
        .from('tasks')
        .select(`
          *,
          is_completed,
          subtasks ( id, title, is_completed ),
          assignee:profiles!assignee_id ( username, firstname, lastname ),
          task_assignees ( profiles ( username, firstname, lastname ) )
        `)
        .eq('workspace_id', wsId);

      // Filter by list first, then folder, then space
      if (lstId) {
        query = query.eq('list_id', lstId);
      } else if (fldId) {
        query = query.eq('folder_id', fldId);
      } else if (spcId) {
        query = query.eq('space_id', spcId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching tasks:', error);
        setTasks([]);
      } else if (data) {
        console.log('Fetched tasks:', data.length);
        setTasks(data as Task[]);
      } else {
        setTasks([]);
      }
    } catch (err) {
      console.error('Exception fetching tasks:', err);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }

  const handleTasksChange = (updatedTasks: Task[]) => {
    setTasks(updatedTasks);
  };

  const handleAddTask = (status: string) => {
    setPreselectedStatus(status);
    setIsNewTaskModalOpen(true);
  };

  const handleOpenTaskById = (taskId: string) => {
    router.push(`/t/${taskId}`);
  };

  // Filter and search tasks
  const filteredTasks = tasks.filter(task => {
    // Search filter
    if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }

    // Assignee filter
    if (filterAssignee !== 'all') {
      if (filterAssignee === 'unassigned' && task.assignee_id) return false;
      if (filterAssignee === 'me' && task.assignee_id !== userId) return false;
      if (filterAssignee !== 'unassigned' && filterAssignee !== 'me' && task.assignee_id !== filterAssignee) return false;
    }

    // Priority filter
    if (filterPriority !== 'all' && task.priority !== filterPriority) {
      return false;
    }

    // Due date filter
    if (filterDueDate !== 'all') {
      const status = getDueDateStatus(task.due_date, task.status);
      if (filterDueDate === 'overdue' && status !== 'overdue') return false;
      if (filterDueDate === 'due_today' && status !== 'due_today') return false;
      if (filterDueDate === 'due_soon' && status !== 'due_soon' && status !== 'due_today') return false;
    }

    return true;
  });

  // Calculate overdue/due-today counts from unfiltered tasks
  const overdueCount = tasks.filter(t => getDueDateStatus(t.due_date, t.status) === 'overdue').length;
  const dueTodayCount = tasks.filter(t => getDueDateStatus(t.due_date, t.status) === 'due_today').length;
  const dueSoonCount = tasks.filter(t => getDueDateStatus(t.due_date, t.status) === 'due_soon').length;

  return (
    <div className="h-screen flex bg-gray-50">
      {/* Sidebar */}
      <Sidebar
        workspaceId={workspaceId}
        spaceId={spaceId}
        folderId={folderId}
        userId={userId}
        onWorkspaceChange={handleWorkspaceChange}
        onCreateWorkspace={() => setIsCreateWorkspaceModalOpen(true)}
      />

      {/* Main Content */}
      <div className="flex-1 ml-64 flex flex-col min-w-0 overflow-hidden">
        {/* HEADER */}
        <div className="bg-white border-b px-8 py-4 flex justify-between items-center shadow-sm z-10 flex-shrink-0">
          <div className="flex items-center gap-4">
            {/* Space Breadcrumb */}
            {currentSpaceName && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span>/</span>
                <span className="font-medium text-blue-600">{currentSpaceName}</span>
              </div>
            )}
          </div>

          <div className="flex gap-4">
            {workspaceId && userPermission === 'owner' && (
              <button
                onClick={() => setIsInviteMemberModalOpen(true)}
                className="flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-md font-medium hover:bg-gray-50 transition"
              >
                <Settings size={18} />
                Manage
              </button>
            )}

            <button
              onClick={() => {
                setPreselectedStatus('not_started');
                setIsNewTaskModalOpen(true);
              }}
              disabled={!workspaceId || userPermission === 'viewer'}
              className="bg-blue-600 text-white px-4 py-2 rounded-md font-medium hover:bg-blue-700 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              + New Task
            </button>

            <NotificationsPanel onTaskClick={handleOpenTaskById} />

            <ProfileDropdown onOpenSettings={() => setIsProfileSettingsOpen(true)} />
          </div>
        </div>

        {/* BOARD AREA */}
        <div className="flex-1 overflow-auto p-8 min-w-0">
          {loading ? (
            <div className="text-center text-gray-400 mt-20 animate-pulse">Loading...</div>
          ) : !workspaceId ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
              <p className="text-lg mb-2">No workspace selected</p>
              <p className="text-sm mb-4">Create a workspace to get started.</p>
              <button
                onClick={() => setIsCreateWorkspaceModalOpen(true)}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition shadow-sm"
              >
                + Create Your First Workspace
              </button>
            </div>
          ) : viewMode === 'overview' && spaceId && !folderId ? (
            <SpaceOverview
              spaceId={spaceId || undefined}
              workspaceId={workspaceId}
            />
          ) : (
            <>
              {/* Overdue Tasks Banner */}
              {(overdueCount > 0 || dueTodayCount > 0) && (
                <div className={`mb-4 rounded-xl border-2 px-5 py-3 flex items-center justify-between shadow-sm ${overdueCount > 0
                  ? 'bg-red-50 border-red-200'
                  : 'bg-orange-50 border-orange-200'
                  }`}>
                  <div className="flex items-center gap-3">
                    <AlertTriangle size={20} className={overdueCount > 0 ? 'text-red-500' : 'text-orange-500'} />
                    <div className="flex items-center gap-3 text-sm">
                      {overdueCount > 0 && (
                        <span className="font-semibold text-red-700">
                          🔴 {overdueCount} overdue {overdueCount === 1 ? 'task' : 'tasks'}
                        </span>
                      )}
                      {overdueCount > 0 && dueTodayCount > 0 && (
                        <span className="text-gray-400">•</span>
                      )}
                      {dueTodayCount > 0 && (
                        <span className="font-medium text-orange-700">
                          🟠 {dueTodayCount} due today
                        </span>
                      )}
                      {dueSoonCount > 0 && (
                        <>
                          <span className="text-gray-400">•</span>
                          <span className="font-medium text-amber-700">
                            🟡 {dueSoonCount} due soon
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {overdueCount > 0 && (
                      <button
                        onClick={() => setFilterDueDate(filterDueDate === 'overdue' ? 'all' : 'overdue')}
                        className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition ${filterDueDate === 'overdue'
                          ? 'bg-red-600 text-white shadow-sm'
                          : 'bg-white text-red-700 border border-red-300 hover:bg-red-100'
                          }`}
                      >
                        {filterDueDate === 'overdue' ? '✕ Clear filter' : 'Show overdue only'}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* View Switcher Tabs + Filters */}
              <div className="mb-6 flex flex-col gap-4">
                {/* View Tabs */}
                <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-gray-200 shadow-sm w-fit">
                  <button
                    onClick={() => setViewMode('tasks')}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition ${viewMode === 'tasks'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-gray-600 hover:bg-gray-100'
                      }`}
                  >
                    <LayoutGrid size={15} />
                    Board
                  </button>
                  <button
                    onClick={() => setViewMode('timeline')}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition ${viewMode === 'timeline'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-gray-600 hover:bg-gray-100'
                      }`}
                  >
                    <BarChart3 size={15} />
                    Timeline
                  </button>
                  <button
                    onClick={() => setViewMode('dashboard')}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition ${viewMode === 'dashboard'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-gray-600 hover:bg-gray-100'
                      }`}
                  >
                    <TrendingUp size={15} />
                    Dashboard
                  </button>
                </div>

                {/* Filters Bar */}
                {tasks.length > 0 && viewMode === 'tasks' && (
                  <div className="flex gap-3 items-center bg-white p-4 rounded-xl shadow-md border-2 border-gray-200">
                    <input
                      type="text"
                      placeholder="🔍 Search tasks..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="flex-1 px-4 py-2.5 border-2 border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-medium transition-all"
                    />

                    <select
                      value={filterAssignee}
                      onChange={(e) => setFilterAssignee(e.target.value)}
                      className="px-4 py-2.5 border-2 border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white cursor-pointer font-medium hover:border-blue-400 transition-all"
                    >
                      <option value="all">👥 All Assignees</option>
                      <option value="me">👤 Assigned to Me</option>
                      <option value="unassigned">❓ Unassigned</option>
                      {members.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.username}
                        </option>
                      ))}
                    </select>

                    <select
                      value={filterPriority}
                      onChange={(e) => setFilterPriority(e.target.value)}
                      className="px-4 py-2.5 border-2 border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white cursor-pointer font-medium hover:border-blue-400 transition-all"
                    >
                      <option value="all">🎯 All Priorities</option>
                      <option value="P1">🔴 Critical (P1)</option>
                      <option value="P2">🟠 High (P2)</option>
                      <option value="P3">🔵 Medium (P3)</option>
                      <option value="P4">⚪ Low (P4)</option>
                    </select>

                    {(searchQuery || filterAssignee !== 'all' || filterPriority !== 'all' || filterDueDate !== 'all') && (
                      <button
                        onClick={() => {
                          setSearchQuery('');
                          setFilterAssignee('all');
                          setFilterPriority('all');
                          setFilterDueDate('all');
                        }}
                        className="px-4 py-2.5 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 rounded-lg transition-all shadow-sm hover:shadow-md"
                      >
                        ✕ Clear
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Board View */}
              {viewMode === 'tasks' && (
                <TaskBoard
                  tasks={filteredTasks}
                  workspaceId={workspaceId}
                  onTasksChange={handleTasksChange}
                  onAddTask={handleAddTask}
                  onAddStatus={() => setIsAddStatusModalOpen(true)}
                  userPermission={userPermission}
                />
              )}

              {/* Timeline View */}
              {viewMode === 'timeline' && (
                <div style={{ height: 'calc(100vh - 220px)' }}>
                  <TimelineView
                    tasks={filteredTasks}
                    onTaskClick={(task) => setSelectedTask(task)}
                  />
                </div>
              )}

              {/* Dashboard View */}
              {viewMode === 'dashboard' && workspaceId && (
                <DashboardCharts
                  tasks={tasks}
                  members={members}
                  workspaceId={workspaceId}
                />
              )}
            </>
          )}
        </div>

        {/* CREATE WORKSPACE MODAL */}
        {isCreateWorkspaceModalOpen && (
          <CreateWorkspaceModal
            onClose={() => setIsCreateWorkspaceModalOpen(false)}
            onWorkspaceCreated={(newWorkspaceId) => {
              handleWorkspaceChange(newWorkspaceId);
              setIsCreateWorkspaceModalOpen(false);
            }}
          />
        )}

        {/* CREATE TASK MODAL */}
        {isNewTaskModalOpen && userId && workspaceId && (
          <NewTaskModal
            userId={userId}
            workspaceId={workspaceId}
            spaceId={spaceId}
            folderId={folderId}
            listId={listId}
            preselectedStatus={preselectedStatus}
            onClose={() => {
              setIsNewTaskModalOpen(false);
              setPreselectedStatus('not_started');
            }}
            onTaskAdded={() => {
              if (workspaceId) fetchTasks(workspaceId, spaceId, folderId, listId);
            }}
          />
        )}

        {/* INVITE MEMBER MODAL */}
        {isInviteMemberModalOpen && workspaceId && (
          <InviteMemberModal
            workspaceId={workspaceId}
            onClose={() => setIsInviteMemberModalOpen(false)}
            onMemberInvited={() => {
              // Optionally refresh workspace data
              setIsInviteMemberModalOpen(false);
            }}
          />
        )}

        {/* EDIT TASK DETAILS MODAL */}
        {selectedTask && (
          <TaskDetailsModal
            task={selectedTask}
            onClose={() => setSelectedTask(null)}
            onUpdate={() => {
              if (workspaceId) fetchTasks(workspaceId, spaceId, folderId, listId);
            }}
            userPermission={userPermission}
          />
        )}

        {/* ADD STATUS MODAL */}
        {isAddStatusModalOpen && workspaceId && (
          <AddStatusModal
            workspaceId={workspaceId}
            onClose={() => setIsAddStatusModalOpen(false)}
            onStatusAdded={() => {
              setIsAddStatusModalOpen(false);
              // Refresh will happen via TaskBoard's useEffect
            }}
            existingStatuses={tasks.map(t => t.status)}
          />
        )}

        {/* PROFILE SETTINGS MODAL */}
        {isProfileSettingsOpen && (
          <ProfileSettingsModal
            onClose={() => setIsProfileSettingsOpen(false)}
            onUpdate={() => {
              // Profile updated, could refresh if needed
              setIsProfileSettingsOpen(false);
            }}
          />
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center bg-gray-50 text-gray-400 animate-pulse">Loading Dashboard...</div>}>
      <DashboardContent />
    </Suspense>
  );
}