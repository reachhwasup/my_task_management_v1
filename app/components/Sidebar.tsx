"use client";

import { useState, useEffect } from 'react';
import { LayoutDashboard, CheckSquare, BarChart3, ChevronLeft, ChevronRight, Users, Plus, FolderOpen, ChevronDown, MoreVertical, Edit2, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import CreateSpaceModal from './CreateSpaceModal';
import CreateFolderModal from './CreateFolderModal';
import CreateListModal from './CreateListModal';
import EditFolderModal from './EditFolderModal';
import EditListModal from './EditListModal';

interface Props {
  workspaceId: string | null;
  spaceId?: string | null;
  folderId?: string | null;
  userId?: string | null;
  onWorkspaceChange?: (workspaceId: string) => void;
  onCreateWorkspace?: () => void;
}

interface Workspace {
  id: string;
  name: string;
  type: string;
}

interface Space {
  id: string;
  name: string;
  workspace_id: string;
  icon?: string;
  color?: string;
}

interface Folder {
  id: string;
  space_id: string;
  name: string;
  description?: string;
}

interface List {
  id: string;
  folder_id?: string;
  space_id?: string;
  name: string;
  task_count?: number;
}

export default function Sidebar({ workspaceId, spaceId, folderId, userId, onWorkspaceChange, onCreateWorkspace }: Props) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showSpaces, setShowSpaces] = useState(true);
  const [isWorkspaceSwitcherOpen, setIsWorkspaceSwitcherOpen] = useState(false);
  const [workspaces, setWorkspaces] = useState<{ id: string; name: string; type: string; permission: string }[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [folders, setFolders] = useState<{ [spaceId: string]: Folder[] }>({});
  const [lists, setLists] = useState<{ [folderId: string]: List[] }>({});
  const [spaceLists, setSpaceLists] = useState<{ [spaceId: string]: List[] }>({});
  const [expandedSpaces, setExpandedSpaces] = useState<Set<string>>(new Set());
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [isCreateSpaceModalOpen, setIsCreateSpaceModalOpen] = useState(false);
  const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = useState(false);
  const [isCreateListModalOpen, setIsCreateListModalOpen] = useState(false);
  const [isEditFolderModalOpen, setIsEditFolderModalOpen] = useState(false);
  const [isEditListModalOpen, setIsEditListModalOpen] = useState(false);
  const [selectedSpaceForFolder, setSelectedSpaceForFolder] = useState<string | null>(null);
  const [selectedFolderForList, setSelectedFolderForList] = useState<string | null>(null);
  const [selectedSpaceForList, setSelectedSpaceForList] = useState<string | null>(null);
  const [selectedFolderToEdit, setSelectedFolderToEdit] = useState<Folder | null>(null);
  const [selectedListToEdit, setSelectedListToEdit] = useState<List | null>(null);
  const [spaceMenuOpen, setSpaceMenuOpen] = useState<string | null>(null);
  const [folderMenuOpen, setFolderMenuOpen] = useState<string | null>(null);
  const [listMenuOpen, setListMenuOpen] = useState<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    // Fetch user's workspaces
    if (userId) {
      fetchUserWorkspaces();
    }
  }, [userId]);

  // Sync currentWorkspace when workspaces array updates
  useEffect(() => {
    console.log('Sidebar: workspaceId changed or workspaces updated:', workspaceId, 'workspaces count:', workspaces.length);
    if (workspaceId && workspaces.length > 0) {
      const workspace = workspaces.find(w => w.id === workspaceId);
      console.log('Found workspace:', workspace);
      if (workspace) {
        console.log('Setting currentWorkspace to:', workspace.name);
        setCurrentWorkspace({
          id: workspace.id,
          name: workspace.name,
          type: workspace.type
        });
      } else {
        console.warn('Workspace not found in workspaces array:', workspaceId);
      }
    }
  }, [workspaces, workspaceId]);

  // Handle workspace changes
  useEffect(() => {
    console.log('Sidebar: workspaceId changed, fetching new workspace data:', workspaceId);
    if (!workspaceId) {
      // Clear state when no workspace
      setSpaces([]);
      setFolders({});
      setLists({});
      setExpandedSpaces(new Set());
      setExpandedFolders(new Set());
      setCurrentWorkspace(null);
      return;
    }

    // Clear navigation state when workspace changes
    setSpaces([]);
    setFolders({});
    setLists({});
    setExpandedSpaces(new Set());
    setExpandedFolders(new Set());
    setSpaceMenuOpen(null);
    setFolderMenuOpen(null);
    setListMenuOpen(null);

    // Fetch new workspace data
    fetchWorkspaceAndSpaces();
  }, [workspaceId]);

  async function fetchUserWorkspaces() {
    if (!userId) return;

    const { data, error } = await supabase
      .from('workspace_members')
      .select(`
        permission,
        workspaces (
          id,
          name,
          type,
          owner_id
        )
      `)
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching workspaces:', error);
      return;
    }

    if (data) {
      console.log('Raw workspace data:', data);
      const mapped = data
        .filter((item: any) => item.workspaces) // Filter out null workspaces
        .map((item: any) => {
          console.log('Mapping workspace:', item.workspaces.name, 'ID:', item.workspaces.id);
          return {
            id: item.workspaces.id,
            name: item.workspaces.name,
            type: item.workspaces.type,
            permission: item.permission,
            is_owner: item.workspaces.owner_id === userId
          };
        });
      console.log('Mapped workspaces:', mapped);
      setWorkspaces(mapped);
    }
  }

  async function fetchFolders(spaceId: string) {
    // Only fetch folders if we have a workspace ID
    if (!workspaceId) return;

    const { data } = await supabase
      .from('folders')
      .select(`
        *,
        spaces!inner (
          workspace_id
        )
      `)
      .eq('space_id', spaceId)
      .eq('spaces.workspace_id', workspaceId)
      .order('position', { ascending: true });

    if (data) {
      setFolders(prev => ({ ...prev, [spaceId]: data }));
    }
  }

  async function fetchLists(folderId: string) {
    // Only fetch lists if we have a workspace ID
    if (!workspaceId) return;

    // Fetch lists for this folder with task counts
    const { data: listsData } = await supabase
      .from('lists')
      .select('id, folder_id, space_id, name, icon, color')
      .eq('folder_id', folderId)
      .order('position', { ascending: true });

    if (listsData) {
      // Get task counts for each list, filtering by workspace
      const listsWithCounts = await Promise.all(
        listsData.map(async (list) => {
          const { count } = await supabase
            .from('tasks')
            .select('*', { count: 'exact', head: true })
            .eq('list_id', list.id)
            .eq('workspace_id', workspaceId);

          return {
            ...list,
            task_count: count || 0
          };
        })
      );

      setLists(prev => ({ ...prev, [folderId]: listsWithCounts }));
    }
  }

  async function fetchSpaceLists(spaceId: string) {
    if (!workspaceId) return;

    const { data: listsData } = await supabase
      .from('lists')
      .select('id, folder_id, space_id, name, icon, color')
      .eq('space_id', spaceId)
      .is('folder_id', null)
      .order('position', { ascending: true });

    if (listsData) {
      const listsWithCounts = await Promise.all(
        listsData.map(async (list) => {
          const { count } = await supabase
            .from('tasks')
            .select('*', { count: 'exact', head: true })
            .eq('list_id', list.id)
            .eq('workspace_id', workspaceId);
          return { ...list, task_count: count || 0 };
        })
      );
      setSpaceLists(prev => ({ ...prev, [spaceId]: listsWithCounts }));
    }
  }

  async function fetchWorkspaceAndSpaces() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let activeWorkspaceId = workspaceId;

    // If no workspace ID, get user's first workspace
    if (!activeWorkspaceId) {
      const { data: members } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .limit(1);

      if (members && members.length > 0) {
        activeWorkspaceId = members[0].workspace_id;
      }
    }

    // Fetch spaces that belong to this specific workspace
    if (activeWorkspaceId) {
      const { data: spacesData } = await supabase
        .from('spaces')
        .select('*')
        .eq('workspace_id', activeWorkspaceId)
        .order('position', { ascending: true });

      if (spacesData) {
        setSpaces(spacesData);
      } else {
        setSpaces([]);
      }
    } else {
      setSpaces([]);
    }
  }

  function toggleSpace(spaceId: string) {
    setExpandedSpaces(prev => {
      const newSet = new Set(prev);
      if (newSet.has(spaceId)) {
        newSet.delete(spaceId);
      } else {
        newSet.add(spaceId);
        // Fetch folders and space-level lists when expanding
        if (!folders[spaceId]) {
          fetchFolders(spaceId);
        }
        if (!spaceLists[spaceId]) {
          fetchSpaceLists(spaceId);
        }
      }
      return newSet;
    });
  }

  function toggleFolder(folderId: string) {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
        // Fetch lists when expanding
        if (!lists[folderId]) {
          fetchLists(folderId);
        }
      }
      return newSet;
    });
  }



  async function handleDeleteSpace(spaceId: string, spaceName: string) {
    if (!confirm(`Are you sure you want to delete "${spaceName}"? This will also delete all folders, lists, and tasks within this space.`)) return;

    try {
      // Check if space has any folders
      const { count: folderCount } = await supabase
        .from('folders')
        .select('*', { count: 'exact', head: true })
        .eq('space_id', spaceId);

      if (folderCount && folderCount > 0) {
        alert(`Cannot delete space. Please delete all ${folderCount} folder(s) first.`);
        return;
      }

      const { error } = await supabase
        .from('spaces')
        .delete()
        .eq('id', spaceId);

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      // Clear folders and lists for this space
      setFolders(prev => {
        const newFolders = { ...prev };
        delete newFolders[spaceId];
        return newFolders;
      });

      fetchWorkspaceAndSpaces();
      setSpaceMenuOpen(null);
    } catch (error: any) {
      console.error('Error deleting space:', error);
      alert(`Failed to delete space: ${error?.message || 'Unknown error'}`);
    }
  }

  async function handleDeleteList(listId: string, listName: string, parentId: string, parentType: 'folder' | 'space' = 'folder') {
    if (!confirm(`Are you sure you want to delete "${listName}"?`)) return;

    try {
      const { error } = await supabase
        .from('lists')
        .delete()
        .eq('id', listId);

      if (error) throw error;

      // Refresh lists for the parent
      if (parentType === 'folder') {
        fetchLists(parentId);
      } else {
        fetchSpaceLists(parentId);
      }
    } catch (error) {
      console.error('Error deleting list:', error);
      alert('Failed to delete list');
    }
  }

  async function handleDeleteFolder(folderId: string, folderName: string, spaceId: string) {
    if (!confirm(`Are you sure you want to delete "${folderName}"?`)) return;

    try {
      const { error } = await supabase
        .from('folders')
        .delete()
        .eq('id', folderId);

      if (error) throw error;

      // Clear the lists for this folder from state
      setLists(prev => {
        const newLists = { ...prev };
        delete newLists[folderId];
        return newLists;
      });

      // Refresh folders for this space
      fetchFolders(spaceId);
    } catch (error) {
      console.error('Error deleting folder:', error);
      alert('Failed to delete folder');
    }
  }

  const menuItems = [
    {
      label: 'Home',
      icon: LayoutDashboard,
      path: workspaceId ? `/?workspace=${workspaceId}` : '/',
      active: pathname === '/' && !spaceId,
    },
    {
      label: 'Tasks',
      icon: CheckSquare,
      path: workspaceId ? `/?workspace=${workspaceId}&view=tasks` : '/?view=tasks',
      active: false, // Will be updated based on view param
    },
    {
      label: 'Dashboard',
      icon: BarChart3,
      path: '/dashboard',
      active: pathname === '/dashboard',
    },
    {
      label: 'Team',
      icon: Users,
      path: '/team',
      active: pathname === '/team',
    },
  ];

  return (
    <div
      className={`${isCollapsed ? 'w-16' : 'w-64'
        } bg-gray-50 border-r border-gray-200 h-screen fixed left-0 top-0 transition-all duration-300 flex flex-col shadow-sm z-40`}
    >
      {/* Header - Workspace Switcher */}
      <div className="p-3 border-b border-gray-200 bg-white">
        {!isCollapsed && (
          <div className="relative">
            <button
              onClick={() => setIsWorkspaceSwitcherOpen(!isWorkspaceSwitcherOpen)}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 rounded-lg transition"
            >
              <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-xs">
                  {currentWorkspace?.name.charAt(0).toUpperCase() || 'W'}
                </span>
              </div>
              <div className="flex-1 text-left min-w-0">
                <div className="font-semibold text-sm text-gray-900 truncate">
                  {currentWorkspace?.name || 'Select Workspace'}
                </div>
                <div className="text-xs text-gray-500 capitalize">
                  {currentWorkspace?.type || 'Workspace'}
                </div>
              </div>
              <ChevronDown size={16} className={`text-gray-400 transition-transform flex-shrink-0 ${isWorkspaceSwitcherOpen ? 'rotate-180' : ''
                }`} />
            </button>

            {/* Workspace Dropdown */}
            {isWorkspaceSwitcherOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setIsWorkspaceSwitcherOpen(false)}
                />
                <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 z-20 max-h-96 overflow-auto">
                  {/* Personal Workspaces */}
                  {workspaces.filter(w => w.type === 'personal').length > 0 && (
                    <div className="p-2">
                      <div className="text-xs font-semibold text-gray-400 px-3 py-2">Personal</div>
                      {workspaces.filter(w => w.type === 'personal').map((ws) => (
                        <button
                          key={ws.id}
                          onClick={() => {
                            console.log('Clicked workspace:', ws.name, ws.id);
                            setIsWorkspaceSwitcherOpen(false);
                            if (onWorkspaceChange) onWorkspaceChange(ws.id);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-md hover:bg-gray-100 transition flex items-center gap-2 ${ws.id === workspaceId ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                            }`}
                        >
                          <div className="flex-1 truncate text-sm">{ws.name}</div>
                          <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded capitalize">
                            {ws.permission}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Shared Workspaces */}
                  {workspaces.filter(w => w.type === 'official').length > 0 && (
                    <div className="p-2 border-t border-gray-100">
                      <div className="text-xs font-semibold text-gray-400 px-3 py-2">Shared</div>
                      {workspaces.filter(w => w.type === 'official').map((ws) => (
                        <button
                          key={ws.id}
                          onClick={() => {
                            console.log('Clicked workspace:', ws.name, ws.id);
                            setIsWorkspaceSwitcherOpen(false);
                            if (onWorkspaceChange) onWorkspaceChange(ws.id);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-md hover:bg-gray-100 transition flex items-center gap-2 ${ws.id === workspaceId ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                            }`}
                        >
                          <div className="flex-1 truncate text-sm">{ws.name}</div>
                          <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded capitalize">
                            {ws.permission}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Create New Workspace */}
                  {onCreateWorkspace && (
                    <div className="border-t border-gray-100 p-2">
                      <button
                        onClick={() => {
                          onCreateWorkspace();
                          setIsWorkspaceSwitcherOpen(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-md transition font-medium text-sm"
                      >
                        <Plus size={16} />
                        Create New Workspace
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
        {isCollapsed && (
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center mx-auto">
            <span className="text-white font-bold text-xs">
              {currentWorkspace?.name.charAt(0).toUpperCase() || 'W'}
            </span>
          </div>
        )}
      </div>

      {/* Navigation */}
      {!isCollapsed && (
        <nav className="flex-1 py-2 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                href={item.path}
                className={`flex items-center gap-3 px-4 py-2 mx-2 rounded-md transition-all text-sm ${item.active
                  ? 'bg-blue-100 text-blue-700 font-medium'
                  : 'text-gray-700 hover:bg-gray-100'
                  }`}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}

          {/* Spaces Section */}
          <div className="mt-6 px-2">
            <div className="w-full flex items-center justify-between px-2 py-2">
              <button
                onClick={() => setShowSpaces(!showSpaces)}
                className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700"
              >
                <span>Spaces</span>
                <ChevronDown
                  size={14}
                  className={`transition-transform ${showSpaces ? '' : '-rotate-90'}`}
                />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (currentWorkspace) {
                    setIsCreateSpaceModalOpen(true);
                  }
                }}
                className="p-0.5 hover:bg-gray-200 rounded text-gray-500 hover:text-gray-700"
                title="Create new space"
              >
                <Plus size={14} />
              </button>
            </div>

            {showSpaces && (
              <div className="mt-1 space-y-1">
                {spaces.map((space) => {
                  const isExpanded = expandedSpaces.has(space.id);
                  const spaceFolders = folders[space.id] || [];

                  return (
                    <div key={space.id}>
                      {/* Space Header */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => toggleSpace(space.id)}
                          className="p-1 hover:bg-gray-200 rounded"
                        >
                          <ChevronDown
                            size={14}
                            className={`text-gray-500 transition-transform ${isExpanded ? '' : '-rotate-90'
                              }`}
                          />
                        </button>
                        <button
                          onClick={() => router.push(`/?workspace=${workspaceId}&space=${space.id}`, { scroll: false })}
                          className={`flex-1 flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-all ${spaceId === space.id
                            ? 'bg-blue-50 text-blue-700 font-medium'
                            : 'text-gray-700 hover:bg-gray-100'
                            }`}
                        >
                          <div className={`w-5 h-5 rounded flex items-center justify-center text-xs font-bold ${space.color === 'purple'
                            ? 'bg-purple-500 text-white'
                            : space.color === 'red'
                              ? 'bg-red-500 text-white'
                              : space.color === 'green'
                                ? 'bg-green-500 text-white'
                                : 'bg-blue-500 text-white'
                            }`}>
                            {space.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="flex-1 truncate text-left">{space.name}</span>
                        </button>
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSpaceMenuOpen(spaceMenuOpen === space.id ? null : space.id);
                            }}
                            className="p-1 hover:bg-gray-200 rounded text-gray-500"
                          >
                            <MoreVertical size={14} />
                          </button>
                          {spaceMenuOpen === space.id && (
                            <div className="absolute right-0 mt-1 w-44 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-50">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // TODO: Add edit functionality
                                  setSpaceMenuOpen(null);
                                }}
                                className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                              >
                                <Edit2 size={14} />
                                Rename Space
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedSpaceForFolder(space.id);
                                  setIsCreateFolderModalOpen(true);
                                  setSpaceMenuOpen(null);
                                }}
                                className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                              >
                                <Plus size={14} />
                                New Folder
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedSpaceForList(space.id);
                                  setSelectedFolderForList(null);
                                  setIsCreateListModalOpen(true);
                                  setSpaceMenuOpen(null);
                                }}
                                className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                              >
                                <Plus size={14} />
                                New List
                              </button>
                              <hr className="my-1" />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteSpace(space.id, space.name);
                                }}
                                className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                              >
                                <Trash2 size={14} />
                                Delete Space
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Folders */}
                      {isExpanded && (
                        <div className="ml-5 mt-0.5 space-y-0.5">
                          {spaceFolders.map((folder) => {
                            const isActive = folderId === folder.id;
                            const isFolderExpanded = expandedFolders.has(folder.id);
                            const folderLists = lists[folder.id] || [];

                            return (
                              <div key={folder.id}>
                                {/* Folder Header */}
                                <div className="flex items-center gap-1 group">
                                  <button
                                    onClick={() => toggleFolder(folder.id)}
                                    className="p-1 hover:bg-gray-200 rounded"
                                  >
                                    <ChevronDown
                                      size={14}
                                      className={`text-gray-500 transition-transform ${isFolderExpanded ? '' : '-rotate-90'
                                        }`}
                                    />
                                  </button>
                                  <button
                                    onClick={() => router.push(`/?workspace=${workspaceId}&space=${space.id}&folder=${folder.id}`, { scroll: false })}
                                    className={`flex-1 flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-all ${isActive
                                      ? 'bg-blue-50 text-blue-700 font-medium'
                                      : 'text-gray-600 hover:bg-gray-100'
                                      }`}
                                  >
                                    <FolderOpen size={16} className={isActive ? 'text-blue-600' : 'text-red-400'} />
                                    <span className="text-left flex-1 truncate">{folder.name}</span>
                                  </button>
                                  <div className="relative">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setFolderMenuOpen(folderMenuOpen === folder.id ? null : folder.id);
                                      }}
                                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded text-gray-500"
                                    >
                                      <MoreVertical size={14} />
                                    </button>
                                    {folderMenuOpen === folder.id && (
                                      <div className="absolute right-0 mt-1 w-44 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-50">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedFolderToEdit(folder);
                                            setIsEditFolderModalOpen(true);
                                            setFolderMenuOpen(null);
                                          }}
                                          className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                        >
                                          <Edit2 size={14} />
                                          Rename Folder
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedFolderForList(folder.id);
                                            setSelectedSpaceForList(null);
                                            setIsCreateListModalOpen(true);
                                            setFolderMenuOpen(null);
                                          }}
                                          className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                        >
                                          <Plus size={14} />
                                          New List
                                        </button>
                                        <hr className="my-1" />
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteFolder(folder.id, folder.name, space.id);
                                            setFolderMenuOpen(null);
                                          }}
                                          className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                        >
                                          <Trash2 size={14} />
                                          Delete Folder
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Task Lists under Folder */}
                                {isFolderExpanded && (
                                  <div className="ml-6 mt-0.5 space-y-0.5">
                                    {folderLists.map((list) => (
                                      <div key={list.id} className="flex items-center gap-1 group">
                                        <button
                                          onClick={(e) => {
                                            e.preventDefault();
                                            router.push(`/l/${list.id}`, { scroll: false });
                                          }}
                                          className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-gray-600 hover:bg-gray-100 transition-all"
                                        >
                                          <CheckSquare size={14} className="text-gray-400" />
                                          <span className="flex-1 text-left truncate">{list.name}</span>
                                          {list.task_count !== undefined && list.task_count > 0 && (
                                            <span className="text-xs text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded">
                                              {list.task_count}
                                            </span>
                                          )}
                                        </button>
                                        <div className="relative">
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setListMenuOpen(listMenuOpen === list.id ? null : list.id);
                                            }}
                                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded text-gray-500"
                                          >
                                            <MoreVertical size={12} />
                                          </button>
                                          {listMenuOpen === list.id && (
                                            <div className="absolute right-0 mt-1 w-40 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-50">
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setSelectedListToEdit(list);
                                                  setIsEditListModalOpen(true);
                                                  setListMenuOpen(null);
                                                }}
                                                className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                              >
                                                <Edit2 size={14} />
                                                Rename
                                              </button>
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleDeleteList(list.id, list.name, folder.id, 'folder');
                                                  setListMenuOpen(null);
                                                }}
                                                className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                              >
                                                <Trash2 size={14} />
                                                Delete
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                    <button
                                      onClick={() => {
                                        setSelectedFolderForList(folder.id);
                                        setSelectedSpaceForList(null);
                                        setIsCreateListModalOpen(true);
                                      }}
                                      className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-all"
                                    >
                                      <Plus size={14} />
                                      <span>New List</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {/* Space-level Lists (no folder) */}
                          {(spaceLists[space.id] || []).map((list) => (
                            <div key={list.id} className="flex items-center gap-1 group">
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  router.push(`/l/${list.id}`, { scroll: false });
                                }}
                                className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-gray-600 hover:bg-gray-100 transition-all ml-4"
                              >
                                <CheckSquare size={14} className="text-blue-400" />
                                <span className="flex-1 text-left truncate">{list.name}</span>
                                {list.task_count !== undefined && list.task_count > 0 && (
                                  <span className="text-xs text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded">
                                    {list.task_count}
                                  </span>
                                )}
                              </button>
                              <div className="relative">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setListMenuOpen(listMenuOpen === list.id ? null : list.id);
                                  }}
                                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded text-gray-500"
                                >
                                  <MoreVertical size={12} />
                                </button>
                                {listMenuOpen === list.id && (
                                  <div className="absolute right-0 mt-1 w-40 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-50">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedListToEdit(list);
                                        setIsEditListModalOpen(true);
                                        setListMenuOpen(null);
                                      }}
                                      className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                    >
                                      <Edit2 size={14} />
                                      Rename
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteList(list.id, list.name, space.id, 'space');
                                        setListMenuOpen(null);
                                      }}
                                      className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                    >
                                      <Trash2 size={14} />
                                      Delete
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}

                          {/* Add List directly under space */}
                          <button
                            onClick={() => {
                              setSelectedSpaceForList(space.id);
                              setSelectedFolderForList(null);
                              setIsCreateListModalOpen(true);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-all ml-4"
                          >
                            <Plus size={14} />
                            <span>New List</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}

                <button
                  onClick={() => {
                    if (currentWorkspace) {
                      setIsCreateSpaceModalOpen(true);
                    }
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-all"
                >
                  <Plus size={16} />
                  <span>New Space</span>
                </button>
              </div>
            )}
          </div>
        </nav>
      )}

      {/* Collapse Toggle */}
      <div className="p-3 border-t border-gray-200 bg-white">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md hover:bg-gray-100 transition-all text-gray-600 hover:text-gray-900"
        >
          {isCollapsed ? (
            <ChevronRight size={18} />
          ) : (
            <>
              <ChevronLeft size={18} />
              <span className="text-sm font-medium">Collapse</span>
            </>
          )}
        </button>
      </div>

      {/* Create Space Modal */}
      {workspaceId && (
        <CreateSpaceModal
          isOpen={isCreateSpaceModalOpen}
          onClose={() => setIsCreateSpaceModalOpen(false)}
          workspaceId={workspaceId}
          onSpaceCreated={fetchWorkspaceAndSpaces}
        />
      )}

      {/* Create Folder Modal */}
      {selectedSpaceForFolder && (
        <CreateFolderModal
          isOpen={isCreateFolderModalOpen}
          onClose={() => {
            setIsCreateFolderModalOpen(false);
            setSelectedSpaceForFolder(null);
          }}
          spaceId={selectedSpaceForFolder}
          onFolderCreated={() => {
            if (selectedSpaceForFolder) {
              fetchFolders(selectedSpaceForFolder);
            }
          }}
        />
      )}

      {/* Create List Modal */}
      {(selectedFolderForList || selectedSpaceForList) && (
        <CreateListModal
          isOpen={isCreateListModalOpen}
          onClose={() => {
            setIsCreateListModalOpen(false);
            setSelectedFolderForList(null);
            setSelectedSpaceForList(null);
          }}
          folderId={selectedFolderForList}
          spaceId={selectedSpaceForList}
          onListCreated={() => {
            if (selectedFolderForList) {
              fetchLists(selectedFolderForList);
            } else if (selectedSpaceForList) {
              fetchSpaceLists(selectedSpaceForList);
            }
          }}
        />
      )}

      {/* Edit Folder Modal */}
      {selectedFolderToEdit && (
        <EditFolderModal
          isOpen={isEditFolderModalOpen}
          onClose={() => {
            setIsEditFolderModalOpen(false);
            setSelectedFolderToEdit(null);
          }}
          folder={selectedFolderToEdit}
          onFolderUpdated={() => {
            fetchWorkspaceAndSpaces();
            setSelectedFolderToEdit(null);
          }}
        />
      )}

      {/* Edit List Modal */}
      {selectedListToEdit && (
        <EditListModal
          isOpen={isEditListModalOpen}
          onClose={() => {
            setIsEditListModalOpen(false);
            setSelectedListToEdit(null);
          }}
          list={selectedListToEdit}
          onListUpdated={() => {
            if (selectedListToEdit.folder_id) {
              fetchLists(selectedListToEdit.folder_id);
            } else if (selectedListToEdit.space_id) {
              fetchSpaceLists(selectedListToEdit.space_id);
            }
            setSelectedListToEdit(null);
          }}
        />
      )}
    </div>
  );
}
