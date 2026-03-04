"use client";

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { MessageCircle, Send, Reply, Trash2, Edit2, Paperclip, X, Check, Download, Smile } from 'lucide-react';

interface Comment {
  id: string;
  message: string;
  user_id: string;
  parent_id: string | null;
  created_at: string;
  edited_at?: string;
  attachment_url?: string;
  attachment_name?: string;
  profiles: {
    username: string;
    firstname: string;
    lastname: string;
    avatar_url?: string;
  };
  replies?: Comment[];
  reactions?: { [key: string]: string[] }; // reaction: [user_ids]
}

interface Props {
  taskId: string;
  isReadOnly: boolean;
}

export default function CommentsSection({ taskId, isReadOnly }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
  const [mentionSuggestions, setMentionSuggestions] = useState<any[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const reactions = ['👍', '❤️', '😄', '🎉', '👀', '🚀'];

  useEffect(() => {
    fetchComments();
    getCurrentUser();
    fetchWorkspaceMembers();
  }, [taskId]);

  useEffect(() => {
    // Check for @ mentions in text
    const lastWord = newComment.split(' ').pop() || '';
    if (lastWord.startsWith('@') && lastWord.length > 1) {
      const query = lastWord.substring(1).toLowerCase();
      const filtered = mentionSuggestions.filter(m => 
        m.username.toLowerCase().includes(query) ||
        m.firstname.toLowerCase().includes(query) ||
        m.lastname.toLowerCase().includes(query)
      );
      if (filtered.length > 0) {
        setShowMentions(true);
      }
    } else {
      setShowMentions(false);
    }
  }, [newComment]);

  async function getCurrentUser() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) setCurrentUserId(session.user.id);
  }

  async function fetchWorkspaceMembers() {
    // Get workspace members for mention suggestions
    const { data: taskData } = await supabase
      .from('tasks')
      .select('workspace_id')
      .eq('id', taskId)
      .single();

    if (taskData) {
      const { data } = await supabase
        .from('workspace_members')
        .select('user_id, profiles ( username, firstname, lastname, avatar_url )')
        .eq('workspace_id', taskData.workspace_id);

      if (data) {
        setMentionSuggestions(data.map((m: any) => ({
          id: m.user_id,
          username: m.profiles?.username,
          firstname: m.profiles?.firstname,
          lastname: m.profiles?.lastname,
          avatar_url: m.profiles?.avatar_url
        })));
      }
    }
  }

  async function fetchComments() {
    // Fetch comments with reactions
    const { data, error } = await supabase
      .from('comments')
      .select(`
        *,
        profiles (
          username,
          firstname,
          lastname,
          avatar_url
        )
      `)
      .eq('task_id', taskId)
      .order('created_at', { ascending: true });

    if (data) {
      // Fetch reactions for all comments
      const commentIds = data.map(c => c.id);
      const { data: reactionsData } = await supabase
        .from('comment_reactions')
        .select('*')
        .in('comment_id', commentIds);

      // Group reactions by comment
      const reactionsByComment: { [key: string]: { [key: string]: string[] } } = {};
      if (reactionsData) {
        reactionsData.forEach((r: any) => {
          if (!reactionsByComment[r.comment_id]) {
            reactionsByComment[r.comment_id] = {};
          }
          if (!reactionsByComment[r.comment_id][r.reaction]) {
            reactionsByComment[r.comment_id][r.reaction] = [];
          }
          reactionsByComment[r.comment_id][r.reaction].push(r.user_id);
        });
      }

      // Build threaded structure
      const topLevel = data.filter(c => !c.parent_id);
      const threaded = topLevel.map(comment => ({
        ...comment,
        reactions: reactionsByComment[comment.id] || {},
        replies: data
          .filter(c => c.parent_id === comment.id)
          .map(reply => ({
            ...reply,
            reactions: reactionsByComment[reply.id] || {}
          }))
      }));
      setComments(threaded);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newComment.trim() || isReadOnly) return;

    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Handle file upload if there's an attachment
    let attachmentData = null;
    if (attachmentFile) {
      attachmentData = await handleFileUpload(attachmentFile);
    }

    const { error } = await supabase
      .from('comments')
      .insert({
        task_id: taskId,
        user_id: session.user.id,
        message: newComment.trim(),
        parent_id: replyTo,
        attachment_url: attachmentData?.url || null,
        attachment_name: attachmentData?.name || null
      });

    if (!error) {
      setNewComment('');
      setReplyTo(null);
      setAttachmentFile(null);
      fetchComments();
      
      // Check for mentions and create notifications
      const mentions = newComment.match(/@(\S+)/g);
      if (mentions) {
        console.log('Found mentions:', mentions);
        for (const mention of mentions) {
          const username = mention.substring(1);
          console.log('Looking for user:', username);
          
          const { data: mentionedUser, error: userError } = await supabase
            .from('profiles')
            .select('id')
            .eq('username', username)
            .maybeSingle();

          console.log('Found user:', mentionedUser, 'Error:', userError);

          if (mentionedUser && mentionedUser.id !== session.user.id) {
            const { error: notifError } = await supabase
              .from('notifications')
              .insert({
                user_id: mentionedUser.id,
                actor_id: session.user.id,
                type: 'mention',
                task_id: taskId,
                is_read: false
              });
            
            console.log('Notification created, error:', notifError);
          }
        }
      }
    }
    setLoading(false);
  }

  async function handleDelete(commentId: string) {
    if (!confirm('Delete this comment?')) return;
    await supabase.from('comments').delete().eq('id', commentId);
    fetchComments();
  }

  async function handleFileUpload(file: File) {
    try {
      setUploadingFile(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;

      const fileExt = file.name.split('.').pop();
      const fileName = `${session.user.id}/${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('comment-attachments')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('comment-attachments')
        .getPublicUrl(filePath);

      return { url: publicUrl, name: file.name };
    } catch (error: any) {
      alert('Error uploading file: ' + error.message);
      return null;
    } finally {
      setUploadingFile(false);
    }
  }

  async function startEdit(comment: Comment) {
    setEditingId(comment.id);
    setEditText(comment.message);
  }

  async function saveEdit(commentId: string) {
    if (!editText.trim()) return;

    const { error } = await supabase
      .from('comments')
      .update({
        message: editText.trim(),
        edited_at: new Date().toISOString()
      })
      .eq('id', commentId);

    if (!error) {
      setEditingId(null);
      setEditText('');
      fetchComments();
    }
  }

  async function toggleReaction(commentId: string, reaction: string) {
    if (!currentUserId) return;

    const { data: existing } = await supabase
      .from('comment_reactions')
      .select('id')
      .eq('comment_id', commentId)
      .eq('user_id', currentUserId)
      .eq('reaction', reaction)
      .single();

    if (existing) {
      // Remove reaction
      await supabase
        .from('comment_reactions')
        .delete()
        .eq('id', existing.id);
    } else {
      // Add reaction
      await supabase
        .from('comment_reactions')
        .insert({
          comment_id: commentId,
          user_id: currentUserId,
          reaction
        });
    }

    setShowReactionPicker(null);
    fetchComments();
  }

  function insertMention(username: string) {
    const words = newComment.split(' ');
    words[words.length - 1] = `@${username} `;
    setNewComment(words.join(' '));
    setShowMentions(false);
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  }

  function renderComment(comment: Comment, isReply = false) {
    const isOwn = comment.user_id === currentUserId;
    const displayName = `${comment.profiles.firstname} ${comment.profiles.lastname}`;
    const isEditing = editingId === comment.id;

    return (
      <div key={comment.id} className={`${isReply ? 'ml-10 mt-2' : 'mt-3'}`}>
        <div className="flex gap-3 group">
          {/* Avatar */}
          {comment.profiles.avatar_url ? (
            <img
              src={comment.profiles.avatar_url}
              alt={displayName}
              className="w-8 h-8 rounded-full object-cover shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {comment.profiles.firstname[0]}{comment.profiles.lastname[0]}
            </div>
          )}

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold text-gray-800">{displayName}</span>
                <span className="text-xs text-gray-400">
                  {formatDate(comment.created_at)}
                  {comment.edited_at && ' (edited)'}
                </span>
              </div>
              
              {isEditing ? (
                <div className="space-y-2">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveEdit(comment.id)}
                      className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center gap-1"
                    >
                      <Check size={12} />
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="text-xs px-2 py-1 text-gray-600 hover:bg-gray-200 rounded"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">
                    {comment.message}
                  </p>
                  {comment.attachment_url && (
                    <a
                      href={comment.attachment_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-2 text-xs text-blue-600 hover:text-blue-700 bg-blue-50 px-2 py-1 rounded"
                    >
                      <Paperclip size={12} />
                      {comment.attachment_name}
                      <Download size={12} />
                    </a>
                  )}
                </>
              )}
            </div>

            {/* Reactions */}
            {!isEditing && Object.keys(comment.reactions || {}).length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {Object.entries(comment.reactions || {}).map(([reaction, userIds]) => (
                  <button
                    key={reaction}
                    onClick={() => toggleReaction(comment.id, reaction)}
                    className={`text-xs px-2 py-0.5 rounded-full border transition ${
                      userIds.includes(currentUserId || '')
                        ? 'bg-blue-100 border-blue-300'
                        : 'bg-gray-100 border-gray-200 hover:bg-gray-200'
                    }`}
                  >
                    {reaction} {userIds.length}
                  </button>
                ))}
              </div>
            )}

            {/* Actions */}
            {!isEditing && (
              <div className="flex items-center gap-3 mt-1 px-1 relative">
                {!isReadOnly && (
                  <button
                    onClick={() => setReplyTo(isReply ? comment.parent_id : comment.id)}
                    className="text-xs text-gray-500 hover:text-blue-600 flex items-center gap-1"
                  >
                    <Reply size={12} />
                    Reply
                  </button>
                )}
                {!isReadOnly && (
                  <div className="relative">
                    <button
                      onClick={() => setShowReactionPicker(showReactionPicker === comment.id ? null : comment.id)}
                      className="text-xs text-gray-500 hover:text-blue-600 flex items-center gap-1"
                    >
                      <Smile size={12} />
                      React
                    </button>
                    {showReactionPicker === comment.id && (
                      <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-2 flex gap-1 z-10">
                        {reactions.map(reaction => (
                          <button
                            key={reaction}
                            onClick={() => toggleReaction(comment.id, reaction)}
                            className="text-lg hover:scale-125 transition"
                          >
                            {reaction}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {isOwn && !isReadOnly && (
                  <>
                    <button
                      onClick={() => startEdit(comment)}
                      className="text-xs text-gray-500 hover:text-blue-600 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition"
                    >
                      <Edit2 size={12} />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(comment.id)}
                      className="text-xs text-gray-500 hover:text-red-600 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition"
                    >
                      <Trash2 size={12} />
                      Delete
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Replies */}
            {comment.replies && comment.replies.length > 0 && (
              <div className="mt-2">
                {comment.replies.map(reply => renderComment(reply, true))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-gray-100 pt-4">
      <div className="flex items-center gap-2 mb-4">
        <MessageCircle size={16} className="text-gray-400" />
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
          Comments ({comments.reduce((acc, c) => acc + 1 + (c.replies?.length || 0), 0)})
        </h3>
      </div>

      {/* Comments List */}
      <div className="space-y-1 mb-4 max-h-64 overflow-y-auto">
        {comments.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">
            No comments yet. Start the conversation!
          </p>
        ) : (
          comments.map(comment => renderComment(comment))
        )}
      </div>

      {/* New Comment Form */}
      {!isReadOnly && (
        <div className="relative">
          <form onSubmit={handleSubmit} className="space-y-2">
            <div className="relative">
              <input
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                placeholder={replyTo ? "Write a reply... (use @username to mention)" : "Write a comment... (use @username to mention)"}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
              />
              
              {/* Mention Autocomplete */}
              {showMentions && (
                <div className="absolute bottom-full left-0 mb-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto z-10">
                  {mentionSuggestions
                    .filter(m => {
                      const lastWord = newComment.split(' ').pop() || '';
                      const query = lastWord.substring(1).toLowerCase();
                      return (
                        m.username.toLowerCase().includes(query) ||
                        m.firstname.toLowerCase().includes(query) ||
                        m.lastname.toLowerCase().includes(query)
                      );
                    })
                    .map(member => (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => insertMention(member.username)}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left"
                      >
                        {member.avatar_url ? (
                          <img src={member.avatar_url} alt={member.username} className="w-6 h-6 rounded-full" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">
                            {member.firstname[0]}{member.lastname[0]}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">
                            {member.firstname} {member.lastname}
                          </div>
                          <div className="text-xs text-gray-500 truncate">@{member.username}</div>
                        </div>
                      </button>
                    ))}
                </div>
              )}
            </div>
            
            {/* File Attachment Preview */}
            {attachmentFile && (
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg">
                <Paperclip size={14} className="text-blue-600" />
                <span className="text-xs text-gray-700 flex-1">{attachmentFile.name}</span>
                <button
                  type="button"
                  onClick={() => setAttachmentFile(null)}
                  className="text-gray-400 hover:text-red-600"
                >
                  <X size={14} />
                </button>
              </div>
            )}
            
            <div className="flex items-center gap-2">
              {replyTo && (
                <button
                  type="button"
                  onClick={() => setReplyTo(null)}
                  className="px-3 py-1.5 text-xs text-gray-500 hover:text-red-600 bg-gray-100 rounded"
                >
                  Cancel Reply
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                onChange={(e) => e.target.files && setAttachmentFile(e.target.files[0])}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingFile}
                className="px-3 py-1.5 text-gray-600 hover:text-gray-900 bg-gray-100 rounded-lg transition disabled:opacity-50 flex items-center gap-1 text-xs font-medium"
              >
                <Paperclip size={14} />
                Attach
              </button>
              <button
                type="submit"
                disabled={loading || uploadingFile || !newComment.trim()}
                className="px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-medium ml-auto"
              >
                <Send size={14} />
                {loading ? 'Sending...' : 'Send'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
