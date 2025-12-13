'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaBell, FaHeart, FaComment, FaUserPlus, FaAt, FaShare, 
  FaEnvelope, FaClock, FaGift, FaCompass, FaCheck, FaTrash,
  FaArrowLeft
} from 'react-icons/fa';
import Link from 'next/link';

const GOLD = '#D4AF37';

type NotificationType = 'like' | 'comment' | 'follow' | 'mention' | 'share' | 'message' | 'story' | 'product' | 'post';

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

// Mock notifications
const mockNotifications: Notification[] = [
  {
    id: '1',
    type: 'like',
    actor: { name: 'Sarah Johnson', avatar: 'https://i.pravatar.cc/150?img=1' },
    image: 'https://picsum.photos/100/100?random=1',
    read: false,
    timestamp: '2 min ago'
  },
  {
    id: '2',
    type: 'follow',
    actor: { name: 'Mike Chen', avatar: 'https://i.pravatar.cc/150?img=2' },
    read: false,
    timestamp: '15 min ago'
  },
  {
    id: '3',
    type: 'comment',
    actor: { name: 'Emma Wilson', avatar: 'https://i.pravatar.cc/150?img=3' },
    content: 'This is amazing! Love the creativity 🔥',
    read: false,
    timestamp: '1 hour ago'
  },
  {
    id: '4',
    type: 'message',
    actor: { name: 'James Brown', avatar: 'https://i.pravatar.cc/150?img=4' },
    content: 'Hey! Are you available for a collab?',
    read: true,
    timestamp: '3 hours ago'
  },
  {
    id: '5',
    type: 'story',
    actor: { name: 'Lisa Park', avatar: 'https://i.pravatar.cc/150?img=5' },
    read: true,
    timestamp: '5 hours ago'
  },
  {
    id: '6',
    type: 'product',
    actor: { name: 'Alex Kim', avatar: 'https://i.pravatar.cc/150?img=6' },
    content: 'New Designer Sneakers - Limited Edition',
    image: 'https://picsum.photos/100/100?random=2',
    read: true,
    timestamp: 'Yesterday'
  },
  {
    id: '7',
    type: 'mention',
    actor: { name: 'Chris Davis', avatar: 'https://i.pravatar.cc/150?img=7' },
    content: '@you check this out!',
    read: true,
    timestamp: 'Yesterday'
  },
  {
    id: '8',
    type: 'share',
    actor: { name: 'Nina Rodriguez', avatar: 'https://i.pravatar.cc/150?img=8' },
    read: true,
    timestamp: '2 days ago'
  },
];

type FilterType = 'all' | 'unread';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications);
  const [filter, setFilter] = useState<FilterType>('all');
  const [markingAllRead, setMarkingAllRead] = useState(false);

  const filteredNotifications = filter === 'all' 
    ? notifications 
    : notifications.filter(n => !n.read);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  };

  const markAllAsRead = async () => {
    setMarkingAllRead(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setMarkingAllRead(false);
  };

  const deleteNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
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
