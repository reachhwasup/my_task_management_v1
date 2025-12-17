"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
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
import { Settings } from 'lucide-react';

// 1. Define the Task Interface
// This matches what we fetch from Supabase
interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  description: string;
  due_date: string;
  workspace_id: string;
  assignee_id?: string;
  assignee?: {
    username: string;
    firstname?: string;
    lastname?: string;
  };
  // We fetch subtasks to show the "2/5" count on the board
  subtasks: { id: string; title: string; is_completed: boolean }[];
}

export default function Dashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userPermission, setUserPermission] = useState<string>('viewer');
  
  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAssignee, setFilterAssignee] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
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

  useEffect(() => {
    checkUserAndWorkspace();
  }, []);

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
      await fetchTasks(wsId);
      fetchWorkspaceMembers(wsId);
    } else {
      setLoading(false);
    }
  }

  function handleWorkspaceChange(newWorkspaceId: string) {
    setWorkspaceId(newWorkspaceId);
    localStorage.setItem('currentWorkspaceId', newWorkspaceId);
    
    // Clear current tasks and show loading
    setTasks([]);
    setLoading(true);
    
    // Reset filters
    setSearchQuery('');
    setFilterAssignee('all');
    setFilterPriority('all');
    
    // Fetch new workspace data
    fetchTasks(newWorkspaceId);
    fetchWorkspaceMembers(newWorkspaceId);
    fetchUserPermission(newWorkspaceId);
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
    const { data } = await supabase
      .from('workspace_members')
      .select('user_id, profiles ( username )')
      .eq('workspace_id', wsId);
    
    if (data) {
      setMembers(
        data.map((m: any) => ({
          id: m.user_id,
          username: m.profiles?.username || 'Unknown'
        }))
      );
    }
  }

  async function fetchTasks(wsId: string) {
    setLoading(true);
    // We select *, plus the subtasks ID and status to count them, and assignee profile
    let { data, error } = await supabase
      .from('tasks')
      .select(`
        *,
        subtasks ( id, title, is_completed ),
        assignee:profiles!assignee_id ( username, firstname, lastname )
      `)
      .eq('workspace_id', wsId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching tasks:', error);
      setTasks([]);
    } else if (data) {
      setTasks(data as Task[]);
    }
    setLoading(false);
  }

  const handleTasksChange = (updatedTasks: Task[]) => {
    setTasks(updatedTasks);
  };

  const handleAddTask = (status: string) => {
    setPreselectedStatus(status);
    setIsNewTaskModalOpen(true);
  };

  const handleOpenTaskById = async (taskId: string) => {
    // Find task in current tasks
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      setSelectedTask(task);
    } else {
      // If not found, fetch it from database
      const { data } = await supabase
        .from('tasks')
        .select(`
          *,
          subtasks ( id, title, is_completed ),
          assignee:profiles!assignee_id ( username, firstname, lastname )
        `)
        .eq('id', taskId)
        .single();
      
      if (data) {
        setSelectedTask(data as Task);
      }
    }
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
    
    return true;
  });

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      
      {/* HEADER */}
      <div className="bg-white border-b px-8 py-4 flex justify-between items-center shadow-sm z-10">
        <div className="flex items-center gap-4">
          <WorkspaceSwitcher 
            currentWorkspaceId={workspaceId}
            onWorkspaceChange={handleWorkspaceChange}
            onCreateWorkspace={() => setIsCreateWorkspaceModalOpen(true)}
            userId={userId}
          />
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
      <div className="flex-1 overflow-auto p-8">
        {loading ? (
          <div className="text-center text-gray-400 mt-20 animate-pulse">Loading tasks...</div>
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
        ) : (
          <>
            {/* Filters Bar */}
            {tasks.length > 0 && (
              <div className="mb-6 flex gap-3 items-center bg-white p-4 rounded-xl shadow-md border-2 border-gray-200">
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

                {(searchQuery || filterAssignee !== 'all' || filterPriority !== 'all') && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setFilterAssignee('all');
                      setFilterPriority('all');
                    }}
                    className="px-4 py-2.5 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 rounded-lg transition-all shadow-sm hover:shadow-md"
                  >
                    ✕ Clear
                  </button>
                )}
              </div>
            )}

            {filteredTasks.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
                <p className="text-lg mb-2">
                  {tasks.length === 0 ? "It's quiet in here..." : "No tasks match your filters"}
                </p>
                <p className="text-sm">
                  {tasks.length === 0 ? "Create a task to get started." : "Try adjusting your search or filters."}
                </p>
              </div>
            ) : (
              <TaskBoard 
                tasks={filteredTasks} 
                workspaceId={workspaceId}
                onTasksChange={handleTasksChange} 
                onTaskClick={(task) => setSelectedTask(task)}
                onAddTask={handleAddTask}
                onAddStatus={() => setIsAddStatusModalOpen(true)}
                userPermission={userPermission}
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
          preselectedStatus={preselectedStatus}
          onClose={() => {
            setIsNewTaskModalOpen(false);
            setPreselectedStatus('not_started');
          }}
          onTaskAdded={() => workspaceId && fetchTasks(workspaceId)}
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
          onUpdate={() => workspaceId && fetchTasks(workspaceId)}
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
  );
}