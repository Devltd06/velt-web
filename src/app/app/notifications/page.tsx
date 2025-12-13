'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaBell, FaHeart, FaComment, FaUserPlus, FaAt, FaShare, 
  FaEnvelope, FaClock, FaGift, FaCompass, FaCheck, FaTrash,
  FaArrowLeft
} from 'react-icons/fa';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

const GOLD = '#D4AF37';
const PLACEHOLDER_AVATAR = "https://cdn-icons-png.flaticon.com/512/847/847969.png";

type NotificationType = 'like' | 'comment' | 'follow' | 'mention' | 'share' | 'message' | 'story' | 'product' | 'post';

interface Profile {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

interface NotificationDB {
  id: string;
  recipient_id: string;
  sender_id: string | null;
  type: string;
  content: string | null;
  reference_id: string | null;
  reference_type: string | null;
  is_read: boolean;
  created_at: string;
  sender?: Profile;
}

interface Notification {
  id: string;
  type: NotificationType;
  actor: {
    name: string;
    avatar: string;
  };
  content?: string;
  image?: string;
  read: boolean;
  timestamp: string;
}

const getNotificationIcon = (type: NotificationType) => {
  switch (type) {
    case 'like': return { icon: FaHeart, color: '#FF4D6D' };
    case 'comment': return { icon: FaComment, color: GOLD };
    case 'follow': return { icon: FaUserPlus, color: '#8B5CF6' };
    case 'mention': return { icon: FaAt, color: '#F59E0B' };
    case 'share': return { icon: FaShare, color: '#10B981' };
    case 'message': return { icon: FaEnvelope, color: GOLD };
    case 'story': return { icon: FaClock, color: '#EC4899' };
    case 'product': return { icon: FaGift, color: '#F97316' };
    case 'post': return { icon: FaCompass, color: GOLD };
    default: return { icon: FaBell, color: '#6B7280' };
  }
};

const getNotificationText = (type: NotificationType, actorName: string) => {
  switch (type) {
    case 'like': return `${actorName} liked your post`;
    case 'comment': return `${actorName} commented on your post`;
    case 'follow': return `${actorName} started following you`;
    case 'mention': return `${actorName} mentioned you`;
    case 'share': return `${actorName} shared your post`;
    case 'message': return `New message from ${actorName}`;
    case 'story': return `${actorName} posted a new story`;
    case 'product': return `${actorName} listed a new product`;
    case 'post': return `${actorName} posted something new`;
    default: return 'New notification';
  }
};

// Helper to format relative time
const formatRelativeTime = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
};

type FilterType = 'all' | 'unread';

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  // Fetch notifications from Supabase
  const fetchNotifications = useCallback(async (uid: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('notifications')
      .select(`
        *,
        sender:sender_id(id, username, full_name, avatar_url)
      `)
      .eq('recipient_id', uid)
      .order('created_at', { ascending: false })
      .limit(50);

    if (!error && data) {
      const formatted: Notification[] = data.map((n: NotificationDB) => ({
        id: n.id,
        type: (n.type || 'post') as NotificationType,
        actor: {
          name: n.sender?.full_name || n.sender?.username || 'Someone',
          avatar: n.sender?.avatar_url || PLACEHOLDER_AVATAR,
        },
        content: n.content || undefined,
        read: n.is_read,
        timestamp: formatRelativeTime(n.created_at),
      }));
      setNotifications(formatted);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/loginlister');
        return;
      }
      setUserId(session.user.id);
      fetchNotifications(session.user.id);
    };
    checkAuth();
  }, [router, fetchNotifications]);

  const filteredNotifications = filter === 'all' 
    ? notifications 
    : notifications.filter(n => !n.read);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = async (id: string) => {
    // Update local state
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
    // Update in database
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);
  };

  const markAllAsRead = async () => {
    if (!userId) return;
    setMarkingAllRead(true);
    
    // Update in database
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('recipient_id', userId)
      .eq('is_read', false);
    
    // Update local state
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setMarkingAllRead(false);
  };

  const deleteNotification = async (id: string) => {
    // Update local state
    setNotifications(prev => prev.filter(n => n.id !== id));
    // Delete from database
    await supabase
      .from('notifications')
      .delete()
      .eq('id', id);
  };

  // Group notifications by date
  const groupedNotifications = filteredNotifications.reduce((groups, notification) => {
    const date = notification.timestamp.includes('ago') || notification.timestamp === 'Yesterday' 
      ? notification.timestamp.includes('day') ? 'Earlier' : 'Today'
      : 'Earlier';
    
    if (!groups[date]) groups[date] = [];
    groups[date].push(notification);
    return groups;
  }, {} as Record<string, Notification[]>);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-black/90 backdrop-blur-lg border-b border-white/10">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/app/home" className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <FaArrowLeft className="text-lg" />
              </Link>
              <div>
                <h1 className="text-xl font-bold">Notifications</h1>
                {unreadCount > 0 && (
                  <p className="text-sm text-gray-400">{unreadCount} unread</p>
                )}
              </div>
            </div>
            
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                disabled={markingAllRead}
                className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors"
                style={{ backgroundColor: `${GOLD}20`, color: GOLD }}
              >
                {markingAllRead ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <FaCheck />
                )}
                Mark all read
              </button>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-2 mt-4">
            {(['all', 'unread'] as FilterType[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  filter === f 
                    ? 'text-black' 
                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
                style={filter === f ? { backgroundColor: GOLD } : {}}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
                {f === 'unread' && unreadCount > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-black/20 rounded-full text-xs">
                    {unreadCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <div className="max-w-2xl mx-auto">
        {filteredNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <FaBell className="text-5xl mb-4 opacity-50" />
            <p className="text-lg font-medium">No notifications</p>
            <p className="text-sm">You&apos;re all caught up!</p>
          </div>
        ) : (
          Object.entries(groupedNotifications).map(([date, items]) => (
            <div key={date}>
              <div className="px-4 py-2 bg-white/5">
                <p className="text-xs font-medium text-gray-400 uppercase">{date}</p>
              </div>
              
              <AnimatePresence>
                {items.map((notification, index) => {
                  const { icon: Icon, color } = getNotificationIcon(notification.type);
                  
                  return (
                    <motion.div
                      key={notification.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => markAsRead(notification.id)}
                      className={`relative px-4 py-4 border-b border-white/5 cursor-pointer transition-colors ${
                        notification.read ? 'bg-transparent' : 'bg-white/5'
                      } hover:bg-white/10`}
                    >
                      <div className="flex gap-3">
                        {/* Avatar with Icon Badge */}
                        <div className="relative flex-shrink-0">
                          <img
                            src={notification.actor.avatar}
                            alt={notification.actor.name}
                            className="w-12 h-12 rounded-full object-cover"
                          />
                          <div 
                            className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: color }}
                          >
                            <Icon className="text-white text-xs" />
                          </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm">
                            <span className="font-semibold">{notification.actor.name}</span>
                            {' '}
                            <span className="text-gray-400">
                              {getNotificationText(notification.type, '').replace(notification.actor.name, '').trim()}
                            </span>
                          </p>
                          
                          {notification.content && (
                            <p className="text-sm text-gray-400 mt-1 truncate">
                              {notification.content}
                            </p>
                          )}
                          
                          <p className="text-xs text-gray-500 mt-1">
                            {notification.timestamp}
                          </p>
                        </div>

                        {/* Image Preview */}
                        {notification.image && (
                          <img
                            src={notification.image}
                            alt=""
                            className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                          />
                        )}

                        {/* Unread Indicator */}
                        {!notification.read && (
                          <div 
                            className="absolute left-2 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full"
                            style={{ backgroundColor: GOLD }}
                          />
                        )}

                        {/* Delete Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification(notification.id);
                          }}
                          className="p-2 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 rounded-full transition-all"
                        >
                          <FaTrash className="text-red-400 text-sm" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
