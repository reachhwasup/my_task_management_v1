"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Home, Users, Plus, ChevronDown, Building2 } from 'lucide-react';

interface Workspace {
  id: string;
  name: string;
  type: string;
  owner_id: string;
  permission?: string;
  is_owner?: boolean;
}

interface Props {
  currentWorkspaceId: string | null;
  onWorkspaceChange: (workspaceId: string) => void;
  onCreateWorkspace: () => void;
  userId: string | null;
}

export default function WorkspaceSwitcher({ 
  currentWorkspaceId, 
  onWorkspaceChange, 
  onCreateWorkspace,
  userId 
}: Props) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) fetchWorkspaces();
  }, [userId]);

  async function fetchWorkspaces() {
    if (!userId) return;
    
    // Fetch all workspaces the user is a member of
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

    if (data) {
      const mapped = data.map((item: any) => ({
        id: item.workspaces.id,
        name: item.workspaces.name,
        type: item.workspaces.type,
        owner_id: item.workspaces.owner_id,
        permission: item.permission,
        is_owner: item.workspaces.owner_id === userId
      }));
      setWorkspaces(mapped);
    }
    setLoading(false);
  }

  const currentWorkspace = workspaces.find(w => w.id === currentWorkspaceId);

  // Separate personal and shared workspaces
  const personalWorkspaces = workspaces.filter(w => w.type === 'personal');
  const sharedWorkspaces = workspaces.filter(w => w.type === 'official');

  return (
    <div className="relative">
      {/* Workspace Selector Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 px-4 py-2.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition shadow-sm w-64"
      >
        <Building2 className="text-blue-600" size={20} />
        <div className="flex-1 text-left">
          <div className="text-sm font-semibold text-gray-800 truncate">
            {currentWorkspace?.name || 'Select Workspace'}
          </div>
          <div className="text-xs text-gray-400">
            {currentWorkspace?.permission && (
              <span className="capitalize">{currentWorkspace.permission}</span>
            )}
          </div>
        </div>
        <ChevronDown size={16} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 mt-2 w-72 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-20 max-h-96 overflow-y-auto">
            
            {/* Personal Workspaces */}
            {personalWorkspaces.length > 0 && (
              <div className="px-3 py-2">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                  <Home size={12} />
                  Personal
                </div>
                {personalWorkspaces.map(ws => (
                  <button
                    key={ws.id}
                    onClick={() => {
                      onWorkspaceChange(ws.id);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-md hover:bg-gray-100 transition flex items-center gap-2 ${
                      ws.id === currentWorkspaceId ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                    }`}
                  >
                    <div className="flex-1 truncate text-sm">{ws.name}</div>
                    {ws.is_owner && (
                      <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">Owner</span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Shared Workspaces */}
            {sharedWorkspaces.length > 0 && (
              <div className="px-3 py-2 border-t border-gray-100">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                  <Users size={12} />
                  Shared with Me
                </div>
                {sharedWorkspaces.map(ws => (
                  <button
                    key={ws.id}
                    onClick={() => {
                      onWorkspaceChange(ws.id);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-md hover:bg-gray-100 transition flex items-center gap-2 ${
                      ws.id === currentWorkspaceId ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
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
            <div className="border-t border-gray-100 mt-2 pt-2 px-3">
              <button
                onClick={() => {
                  onCreateWorkspace();
                  setIsOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-md transition font-medium text-sm"
              >
                <Plus size={16} />
                Create New Workspace
              </button>
            </div>

            {/* Empty State */}
            {workspaces.length === 0 && !loading && (
              <div className="px-4 py-6 text-center text-gray-400 text-sm">
                <p>No workspaces yet</p>
                <p className="text-xs mt-1">Create one to get started</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
