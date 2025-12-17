"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { X, Mail, UserPlus, AlertCircle, Users, Crown, Trash2 } from 'lucide-react';

interface Props {
  workspaceId: string;
  onClose: () => void;
  onMemberInvited: () => void;
}

export default function InviteMemberModal({ workspaceId, onClose, onMemberInvited }: Props) {
  const [email, setEmail] = useState('');
  const [permission, setPermission] = useState<'viewer' | 'editor'>('editor');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [members, setMembers] = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    fetchMembers();
    getCurrentUser();
  }, [workspaceId]);

  async function getCurrentUser() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) setCurrentUserId(session.user.id);
  }

  async function fetchMembers() {
    const { data } = await supabase
      .from('workspace_members')
      .select(`
        id,
        user_id,
        permission,
        joined_at,
        profiles ( username, firstname, lastname )
      `)
      .eq('workspace_id', workspaceId)
      .order('joined_at', { ascending: true });

    if (data) {
      setMembers(data);
    }
  }

  async function handleRemoveMember(memberId: string, memberName: string) {
    if (!confirm(`Remove ${memberName} from this workspace?`)) return;

    const { error } = await supabase
      .from('workspace_members')
      .delete()
      .eq('id', memberId);

    if (error) {
      alert('Error removing member: ' + error.message);
    } else {
      await fetchMembers();
      onMemberInvited();
    }
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // 1. Find user by email
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, username')
        .eq('username', email.toLowerCase())
        .single();

      if (profileError || !profileData) {
        setError('User not found. Make sure they have an account.');
        setLoading(false);
        return;
      }

      // 2. Check if already a member
      const { data: existingMember } = await supabase
        .from('workspace_members')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('user_id', profileData.id)
        .single();

      if (existingMember) {
        setError('This user is already a member of this workspace.');
        setLoading(false);
        return;
      }

      // 3. Add member
      const { error: insertError } = await supabase
        .from('workspace_members')
        .insert({
          workspace_id: workspaceId,
          user_id: profileData.id,
          permission: permission
        });

      if (insertError) {
        setError(insertError.message);
      } else {
        // 4. Create notification (optional)
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await supabase
            .from('notifications')
            .insert({
              user_id: profileData.id,
              actor_id: session.user.id,
              type: 'invite',
              is_read: false
            });
        }

        setSuccess(`✓ ${email} has been invited as ${permission}`);
        setEmail('');
        await fetchMembers();
        onMemberInvited();
        
        setTimeout(() => {
          onClose();
        }, 1500);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to invite member');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-2">
            <UserPlus className="text-blue-600" size={24} />
            <h2 className="text-xl font-bold text-gray-800">Manage Members</h2>
          </div>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Existing Members Section */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Users size={18} className="text-gray-600" />
              <h3 className="font-bold text-gray-800">Current Members ({members.length})</h3>
            </div>
            
            <div className="space-y-2">
              {members.map((member: any) => {
                const isOwner = member.permission === 'owner';
                const isCurrentUser = member.user_id === currentUserId;
                const displayName = member.profiles?.firstname && member.profiles?.lastname
                  ? `${member.profiles.firstname} ${member.profiles.lastname}`
                  : member.profiles?.username || 'Unknown User';
                
                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-600">
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900">{displayName}</p>
                          {isCurrentUser && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">You</span>
                          )}
                          {isOwner && (
                            <Crown size={14} className="text-yellow-500" />
                          )}
                        </div>
                        <p className="text-sm text-gray-500">{member.profiles?.username}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium px-3 py-1 rounded-full ${
                        isOwner ? 'bg-yellow-100 text-yellow-700' :
                        member.permission === 'editor' ? 'bg-green-100 text-green-700' :
                        'bg-gray-200 text-gray-700'
                      }`}>
                        {isOwner ? '👑 Owner' : member.permission === 'editor' ? '✏️ Editor' : '👁️ Viewer'}
                      </span>
                      
                      {!isOwner && !isCurrentUser && (
                        <button
                          onClick={() => handleRemoveMember(member.id, displayName)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Remove member"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200"></div>

          {/* Invite New Member Section */}
          <div>
            <h3 className="font-bold text-gray-800 mb-4">Invite New Member</h3>
            
            <p className="text-sm text-gray-600 mb-4">
              Add a team member to this workspace. They'll be able to view and collaborate on tasks.
            </p>

        {/* Form */}
        <form onSubmit={handleInvite} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-800 mb-2">
              <Mail className="inline mr-1" size={14} />
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="colleague@company.com"
              className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-base"
              autoFocus
            />
            <p className="text-xs text-gray-500 mt-1">
              Make sure they have an account first
            </p>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-800 mb-2">
              Permission Level
            </label>
            <select
              value={permission}
              onChange={e => setPermission(e.target.value as 'viewer' | 'editor')}
              className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 bg-white text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
            >
              <option value="editor">✏️ Editor - Can create and edit tasks</option>
              <option value="viewer">👁️ Viewer - Read-only access</option>
            </select>
          </div>

          {/* Success Message */}
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-lg text-sm flex items-center gap-2">
              {success}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm flex items-center gap-2">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {loading ? 'Inviting...' : 'Send Invite'}
            </button>
          </div>
        </form>
          </div>
        </div>
      </div>
    </div>
  );
}
