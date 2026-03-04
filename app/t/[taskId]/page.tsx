"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter, useParams } from 'next/navigation';
import TaskDetailsModal from '@/app/components/TaskDetailsModal';

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  description: string;
  due_date: string;
  workspace_id: string;
  space_id?: string;
  folder_id?: string;
  list_id?: string;
  assignee_id?: string;
  assignee?: {
    username: string;
    firstname?: string;
    lastname?: string;
  };
  task_assignees?: Array<{
    profiles: {
      username: string;
      firstname?: string;
      lastname?: string;
    };
  }>;
  subtasks: { id: string; title: string; is_completed: boolean }[];
}

export default function TaskPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params.taskId as string;
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(null);
  const [userPermission, setUserPermission] = useState<string>('viewer');

  useEffect(() => {
    // Get current workspace from localStorage
    const savedWorkspaceId = localStorage.getItem('currentWorkspaceId');
    setCurrentWorkspaceId(savedWorkspaceId);

    if (taskId) {
      fetchTask(savedWorkspaceId);
    }
  }, [taskId]);

  // Listen for workspace changes
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'currentWorkspaceId' && e.newValue !== currentWorkspaceId) {
        // Workspace changed, redirect to home
        router.push('/');
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Also check periodically in case storage event doesn't fire
    const interval = setInterval(() => {
      const savedWorkspaceId = localStorage.getItem('currentWorkspaceId');
      if (savedWorkspaceId !== currentWorkspaceId && task && task.workspace_id !== savedWorkspaceId) {
        router.push('/');
      }
    }, 500);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [currentWorkspaceId, task]);

  async function fetchTask(expectedWorkspaceId: string | null) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          assignee:profiles!tasks_assignee_id_fkey(username, firstname, lastname),
          task_assignees(
            profiles(username, firstname, lastname)
          ),
          subtasks(id, title, is_completed)
        `)
        .eq('id', taskId)
        .single();

      if (error) {
        console.error('Error fetching task:', error);
        // Redirect to home if task not found
        router.push('/');
        return;
      }

      // Check if task belongs to current workspace
      if (expectedWorkspaceId && data.workspace_id !== expectedWorkspaceId) {
        console.log('Task does not belong to current workspace, redirecting...');
        router.push('/');
        return;
      }

      // Verify user has access to this workspace
      const { data: memberData } = await supabase
        .from('workspace_members')
        .select('workspace_id, permission')
        .eq('workspace_id', data.workspace_id)
        .eq('user_id', session.user.id)
        .single();

      if (!memberData) {
        console.error('User does not have access to this workspace');
        router.push('/');
        return;
      }

      setUserPermission(memberData.permission);
      setTask(data);
    } catch (err) {
      console.error('Error:', err);
      router.push('/');
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    // Navigate back to the task's workspace/space/folder/list
    if (task) {
      const params = new URLSearchParams();
      params.set('workspace', task.workspace_id);
      if (task.space_id) params.set('space', task.space_id);
      if (task.folder_id) params.set('folder', task.folder_id);
      if (task.list_id) params.set('list', task.list_id);
      router.push(`/?${params.toString()}`);
    } else {
      router.push('/');
    }
  }

  async function handleTaskUpdate() {
    // Refresh from database to ensure consistency
    await fetchTask(currentWorkspaceId);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!task) {
    return null;
  }

  return (
    <TaskDetailsModal
      task={task}
      onClose={handleClose}
      onUpdate={handleTaskUpdate}
      userPermission={userPermission}
    />
  );
}
