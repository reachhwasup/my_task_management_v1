"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Bell, Check, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Notification {
  id: string;
  type: string;
  is_read: boolean;
  created_at: string;
  task_id: string | null;
  actor: {
    firstname: string;
    lastname: string;
  };
}

interface Props {
  onTaskClick: (taskId: string) => void;
}

export default function NotificationsPanel({ onTaskClick }: Props) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const router = useRouter();

  useEffect(() => {
    fetchNotifications();
    
    // Set up real-time subscription
    const channel = supabase
      .channel('notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
      }, () => {
        fetchNotifications();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchNotifications() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data, error } = await supabase
      .from('notifications')
      .select(`
        *,
        actor:actor_id (
          firstname,
          lastname
        )
      `)
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (data) {
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.is_read).length);
    }
  }

  async function markAsRead(notifId: string) {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notifId);
    fetchNotifications();
  }

  async function markAllAsRead() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', session.user.id)
      .eq('is_read', false);
    
    fetchNotifications();
  }

  function getNotificationIcon(type: string) {
    switch (type) {
      case 'mention': return '💬';
      case 'invite': return '🤝';
      case 'assignment': return '📋';
      case 'overdue': return '⚠️';
      case 'reply': return '↩️';
      default: return '🔔';
    }
  }

  function getNotificationMessage(notif: Notification) {
    const actorName = `${notif.actor.firstname} ${notif.actor.lastname}`;
    switch (notif.type) {
      case 'mention':
        return `${actorName} mentioned you in a comment`;
      case 'invite':
        return `${actorName} invited you to a workspace`;
      case 'assignment':
        return `${actorName} assigned you to a task`;
      case 'reply':
        return `${actorName} replied to your comment`;
      default:
        return 'New notification';
    }
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'now';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    return date.toLocaleDateString();
  }

  return (
    <div className="relative">
      {/* Bell Icon Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-20 max-h-[500px] flex flex-col">
            
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-800">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  Mark all read
                </button>
              )}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-400 text-sm">
                  <Bell size={32} className="mx-auto mb-2 opacity-50" />
                  <p>No notifications yet</p>
                </div>
              ) : (
                notifications.map(notif => (
                  <div
                    key={notif.id}
                    className={`px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition cursor-pointer ${
                      !notif.is_read ? 'bg-blue-50/50' : ''
                    }`}
                    onClick={() => {
                      markAsRead(notif.id);
                      if (notif.task_id) {
                        onTaskClick(notif.task_id);
                      }
                      setIsOpen(false);
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{getNotificationIcon(notif.type)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800">
                          {getNotificationMessage(notif)}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {formatDate(notif.created_at)}
                        </p>
                      </div>
                      {!notif.is_read && (
                        <div className="w-2 h-2 bg-blue-600 rounded-full shrink-0 mt-1.5" />
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
