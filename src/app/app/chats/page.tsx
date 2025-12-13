'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  FaArrowLeft, FaSearch, FaPaperPlane, FaImage, FaSmile, 
  FaEllipsisV, FaCheck, FaCheckDouble, FaPhone, FaVideo,
  FaPlus, FaEnvelope
} from 'react-icons/fa';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

const GOLD = '#D4AF37';
const PLACEHOLDER_AVATAR = "https://cdn-icons-png.flaticon.com/512/847/847969.png";

interface Profile {
  id: string;
  username?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read?: boolean;
  type?: 'text' | 'image' | 'story';
  image_url?: string | null;
}

interface ConversationParticipant {
  id: string;
  conversation_id: string;
  user_id: string;
  profile?: Profile | null;
}

interface Conversation {
  id: string;
  is_group?: boolean;
  title?: string | null;
  created_at: string;
  participants?: ConversationParticipant[];
  lastMessage?: Message | null;
  unreadCount?: number;
  otherUser?: Profile | null;
}

export default function ChatsPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedChat, setSelectedChat] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Check auth
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/app/welcome');
        return;
      }
      setUserId(session.user.id);
      setLoading(false);
    };
    checkAuth();
  }, [router]);

  // Fetch conversations
  const fetchConversations = useCallback(async () => {
    if (!userId) return;

    setConversationsLoading(true);
    try {
      // Get conversation participants for this user
      const { data: participantRows, error: partError } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', userId);

      if (partError) {
        console.warn('[chats] fetchConversations participants err', partError);
        setConversations([]);
        return;
      }

      const conversationIds = (participantRows || []).map(p => p.conversation_id);

      if (conversationIds.length === 0) {
        setConversations([]);
        setConversationsLoading(false);
        return;
      }

      // Get conversations
      const { data: convRows, error: convError } = await supabase
        .from('conversations')
        .select('*')
        .in('id', conversationIds)
        .order('created_at', { ascending: false });

      if (convError) {
        console.warn('[chats] fetchConversations conversations err', convError);
        setConversations([]);
        return;
      }

      // Get all participants for these conversations
      const { data: allParticipants } = await supabase
        .from('conversation_participants')
        .select('*')
        .in('conversation_id', conversationIds);

      // Get profiles for all participants
      const allUserIds = Array.from(new Set((allParticipants || []).map(p => p.user_id)));
      const profilesMap: Record<string, Profile> = {};

      if (allUserIds.length > 0) {
        const { data: profRows } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url')
          .in('id', allUserIds);

        (profRows || []).forEach(p => {
          profilesMap[p.id] = { ...p, avatar_url: p.avatar_url || PLACEHOLDER_AVATAR };
        });
      }

      // Get last message for each conversation
      const conversationsWithDetails = await Promise.all(
        (convRows || []).map(async (conv) => {
          // Get last message
          const { data: lastMsgRows } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: false })
            .limit(1);

          const lastMessage = lastMsgRows && lastMsgRows.length > 0 ? lastMsgRows[0] : null;

          // Find other user in this conversation (for 1-on-1 chats)
          const participants = (allParticipants || []).filter(p => p.conversation_id === conv.id);
          const otherParticipant = participants.find(p => p.user_id !== userId);
          const otherUser = otherParticipant ? profilesMap[otherParticipant.user_id] : null;

          return {
            ...conv,
            lastMessage,
            participants: participants.map(p => ({
              ...p,
              profile: profilesMap[p.user_id],
            })),
            otherUser,
            unreadCount: 0, // Would need to track this separately
          };
        })
      );

      setConversations(conversationsWithDetails);
    } catch (err) {
      console.warn('[chats] fetchConversations exception', err);
      setConversations([]);
    } finally {
      setConversationsLoading(false);
    }
  }, [userId]);

  // Fetch messages for selected conversation
  const fetchMessages = useCallback(async (conversationId: string) => {
    setMessagesLoading(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(100);

      if (error) {
        console.warn('[chats] fetchMessages err', error);
        setMessages([]);
        return;
      }

      setMessages(data || []);
    } catch (err) {
      console.warn('[chats] fetchMessages exception', err);
      setMessages([]);
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  // Load conversations when userId is set
  useEffect(() => {
    if (userId) {
      fetchConversations();
    }
  }, [userId, fetchConversations]);

  // Load messages when chat is selected
  useEffect(() => {
    if (selectedChat) {
      fetchMessages(selectedChat.id);
    }
  }, [selectedChat, fetchMessages]);

  // Filter conversations
  const filteredConversations = conversations.filter(c => {
    const name = c.otherUser?.full_name || c.otherUser?.username || c.title || '';
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (selectedChat) scrollToBottom();
  }, [messages, selectedChat]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedChat || !userId) return;
    
    setSending(true);
    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          conversation_id: selectedChat.id,
          sender_id: userId,
          content: newMessage.trim(),
        });

      if (error) {
        console.warn('[chats] sendMessage err', error);
        return;
      }

      // Add message locally for instant feedback
      const tempMessage: Message = {
        id: Date.now().toString(),
        conversation_id: selectedChat.id,
        sender_id: userId,
        content: newMessage.trim(),
        created_at: new Date().toISOString(),
        type: 'text',
      };
      
      setMessages(prev => [...prev, tempMessage]);
      setNewMessage('');
      
      // Refresh messages to get server-side ID
      setTimeout(() => fetchMessages(selectedChat.id), 500);
    } catch (err) {
      console.warn('[chats] sendMessage exception', err);
    } finally {
      setSending(false);
    }
  };

  const formatTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      const mins = Math.floor(diff / 60000);
      const hours = Math.floor(mins / 60);
      const days = Math.floor(hours / 24);

      if (mins < 1) return 'Just now';
      if (mins < 60) return `${mins} min ago`;
      if (hours < 24) return `${hours}h ago`;
      if (days === 1) return 'Yesterday';
      return date.toLocaleDateString();
    } catch {
      return timestamp;
    }
  };

  const formatMessageTime = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return timestamp;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex">
      {/* Conversations List */}
      <div className={`w-full md:w-96 border-r border-white/10 flex flex-col ${selectedChat ? 'hidden md:flex' : 'flex'}`}>
        {/* Header */}
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center justify-between mb-4">
            <Link href="/app/home" className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <FaArrowLeft />
            </Link>
            <h1 className="text-xl font-bold">Messages</h1>
            <button 
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ backgroundColor: GOLD }}
            >
              <FaPlus className="text-black" />
            </button>
          </div>
          
          {/* Search */}
          <div className="relative">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search messages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/10 rounded-full py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 transition-all"
              style={{ '--tw-ring-color': GOLD } as React.CSSProperties}
            />
          </div>
        </div>

        {/* Conversations */}
        <div className="flex-1 overflow-y-auto">
          {conversationsLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="text-center py-12 text-white/50">
              <FaEnvelope className="text-4xl mx-auto mb-4 opacity-50" />
              <p>{searchQuery ? 'No conversations found' : 'No conversations yet'}</p>
              <p className="text-sm mt-2">Start a chat by messaging someone!</p>
            </div>
          ) : (
            <div>
              <p className="px-4 py-2 text-xs font-medium text-gray-400 uppercase">Conversations</p>
              {filteredConversations.map(renderConversation)}
            </div>
          )}
        </div>
      </div>

      {/* Chat View */}
      {selectedChat ? (
        <div className="flex-1 flex flex-col">
          {/* Chat Header */}
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setSelectedChat(null)}
                className="md:hidden p-2 hover:bg-white/10 rounded-full"
              >
                <FaArrowLeft />
              </button>
              <div className="relative">
                <img
                  src={selectedChat.otherUser?.avatar_url || PLACEHOLDER_AVATAR}
                  alt={selectedChat.otherUser?.full_name || selectedChat.otherUser?.username || 'User'}
                  className="w-10 h-10 rounded-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = PLACEHOLDER_AVATAR;
                  }}
                />
              </div>
              <div>
                <h2 className="font-semibold">
                  {selectedChat.is_group 
                    ? selectedChat.title 
                    : selectedChat.otherUser?.full_name || selectedChat.otherUser?.username || 'User'}
                </h2>
                <p className="text-xs text-gray-400">
                  {selectedChat.is_group 
                    ? `${selectedChat.participants?.length || 0} members`
                    : 'Tap to view profile'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <FaPhone className="text-gray-400" />
              </button>
              <button className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <FaVideo className="text-gray-400" />
              </button>
              <button className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <FaEllipsisV className="text-gray-400" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messagesLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-12 text-white/50">
                <p>No messages yet</p>
                <p className="text-sm mt-2">Send a message to start the conversation!</p>
              </div>
            ) : (
              messages.map((message, index) => {
                const isMe = message.sender_id === userId;
                const showAvatar = !isMe && (index === 0 || messages[index - 1].sender_id !== message.sender_id);
                
                return (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                  >
                    {!isMe && showAvatar && (
                      <img
                        src={selectedChat.otherUser?.avatar_url || PLACEHOLDER_AVATAR}
                        alt=""
                        className="w-8 h-8 rounded-full mr-2 self-end"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = PLACEHOLDER_AVATAR;
                        }}
                      />
                    )}
                    {!isMe && !showAvatar && <div className="w-10" />}
                    
                    <div className={`max-w-[70%] ${isMe ? 'items-end' : 'items-start'}`}>
                      {message.image_url ? (
                        <img
                          src={message.image_url}
                          alt=""
                          className="rounded-2xl max-w-full"
                        />
                      ) : (
                        <div
                          className={`px-4 py-2 rounded-2xl ${
                            isMe 
                              ? 'rounded-br-md' 
                              : 'bg-white/10 rounded-bl-md'
                          }`}
                          style={isMe ? { backgroundColor: GOLD, color: 'black' } : {}}
                        >
                          <p className="text-sm">{message.content}</p>
                        </div>
                      )}
                      <div className={`flex items-center gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <span className="text-xs text-gray-500">{formatMessageTime(message.created_at)}</span>
                        {isMe && (
                          message.read 
                            ? <FaCheckDouble className="text-xs" style={{ color: GOLD }} />
                            : <FaCheck className="text-xs text-gray-500" />
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <div className="p-4 border-t border-white/10">
            <div className="flex items-center gap-2">
              <button className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <FaImage className="text-gray-400" />
              </button>
              <input
                type="text"
                placeholder="Type a message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !sending && sendMessage()}
                disabled={sending}
                className="flex-1 bg-white/10 rounded-full py-2 px-4 focus:outline-none focus:ring-2 transition-all disabled:opacity-50"
                style={{ '--tw-ring-color': GOLD } as React.CSSProperties}
              />
              <button className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <FaSmile className="text-gray-400" />
              </button>
              <button
                onClick={sendMessage}
                disabled={sending || !newMessage.trim()}
                className="w-10 h-10 rounded-full flex items-center justify-center transition-transform active:scale-95 disabled:opacity-50"
                style={{ backgroundColor: GOLD }}
              >
                <FaPaperPlane className="text-black" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center text-gray-400">
          <div className="text-center">
            <FaEnvelope className="text-6xl mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">Select a conversation</p>
            <p className="text-sm">Choose from your existing conversations or start a new one</p>
          </div>
        </div>
      )}
    </div>
  );

  function renderConversation(conversation: Conversation) {
    const displayName = conversation.is_group 
      ? conversation.title 
      : conversation.otherUser?.full_name || conversation.otherUser?.username || 'User';
    const avatar = conversation.otherUser?.avatar_url || PLACEHOLDER_AVATAR;
    
    return (
      <motion.div
        key={conversation.id}
        onClick={() => setSelectedChat(conversation)}
        whileHover={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
        className={`p-4 cursor-pointer border-b border-white/5 ${
          selectedChat?.id === conversation.id ? 'bg-white/10' : ''
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="relative flex-shrink-0">
            <img
              src={avatar}
              alt={displayName || 'User'}
              className="w-12 h-12 rounded-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = PLACEHOLDER_AVATAR;
              }}
            />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold truncate">{displayName}</h3>
              {conversation.lastMessage && (
                <span className="text-xs text-gray-400">
                  {formatTime(conversation.lastMessage.created_at)}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between mt-1">
              <p className={`text-sm truncate ${conversation.unreadCount && conversation.unreadCount > 0 ? 'text-white font-medium' : 'text-gray-400'}`}>
                {conversation.lastMessage?.sender_id === userId && (
                  <FaCheck className="inline mr-1 text-gray-500" />
                )}
                {conversation.lastMessage?.content || 'No messages yet'}
              </p>
              {conversation.unreadCount && conversation.unreadCount > 0 && (
                <span 
                  className="w-5 h-5 rounded-full text-xs flex items-center justify-center text-black font-bold"
                  style={{ backgroundColor: GOLD }}
                >
                  {conversation.unreadCount}
                </span>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    );
  }
}
