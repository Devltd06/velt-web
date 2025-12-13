'use client';

import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  FaArrowLeft, FaSearch, FaPaperPlane, FaImage, FaSmile, 
  FaEllipsisV, FaCheck, FaCheckDouble, FaPhone, FaVideo,
  FaBellSlash, FaPlus, FaEnvelope, FaThumbtack
} from 'react-icons/fa';
import Link from 'next/link';

const GOLD = '#D4AF37';

interface Message {
  id: string;
  senderId: string;
  content: string;
  timestamp: string;
  read: boolean;
  type: 'text' | 'image' | 'story';
  imageUrl?: string;
}

interface Conversation {
  id: string;
  user: {
    id: string;
    name: string;
    avatar: string;
    online: boolean;
  };
  lastMessage: Message;
  unreadCount: number;
  pinned: boolean;
  muted: boolean;
}

const mockConversations: Conversation[] = [
  {
    id: '1',
    user: {
      id: 'u1',
      name: 'Sarah Johnson',
      avatar: 'https://i.pravatar.cc/150?img=1',
      online: true
    },
    lastMessage: {
      id: 'm1',
      senderId: 'u1',
      content: 'Hey! Did you see the new billboard design?',
      timestamp: '2 min ago',
      read: false,
      type: 'text'
    },
    unreadCount: 3,
    pinned: true,
    muted: false
  },
  {
    id: '2',
    user: {
      id: 'u2',
      name: 'Mike Chen',
      avatar: 'https://i.pravatar.cc/150?img=2',
      online: true
    },
    lastMessage: {
      id: 'm2',
      senderId: 'me',
      content: 'I\'ll send the files tomorrow 👍',
      timestamp: '15 min ago',
      read: true,
      type: 'text'
    },
    unreadCount: 0,
    pinned: true,
    muted: false
  },
  {
    id: '3',
    user: {
      id: 'u3',
      name: 'Emma Wilson',
      avatar: 'https://i.pravatar.cc/150?img=3',
      online: false
    },
    lastMessage: {
      id: 'm3',
      senderId: 'u3',
      content: 'Shared a story',
      timestamp: '1 hour ago',
      read: true,
      type: 'story'
    },
    unreadCount: 0,
    pinned: false,
    muted: false
  },
  {
    id: '4',
    user: {
      id: 'u4',
      name: 'James Brown',
      avatar: 'https://i.pravatar.cc/150?img=4',
      online: false
    },
    lastMessage: {
      id: 'm4',
      senderId: 'u4',
      content: 'Thanks for the help!',
      timestamp: '3 hours ago',
      read: true,
      type: 'text'
    },
    unreadCount: 0,
    pinned: false,
    muted: true
  },
  {
    id: '5',
    user: {
      id: 'u5',
      name: 'Lisa Park',
      avatar: 'https://i.pravatar.cc/150?img=5',
      online: true
    },
    lastMessage: {
      id: 'm5',
      senderId: 'me',
      content: 'Sent a photo',
      timestamp: 'Yesterday',
      read: true,
      type: 'image'
    },
    unreadCount: 0,
    pinned: false,
    muted: false
  },
];

// Chat Messages for selected conversation
const mockMessages: Message[] = [
  { id: '1', senderId: 'u1', content: 'Hey there! 👋', timestamp: '10:30 AM', read: true, type: 'text' },
  { id: '2', senderId: 'me', content: 'Hi Sarah! How are you?', timestamp: '10:31 AM', read: true, type: 'text' },
  { id: '3', senderId: 'u1', content: 'I\'m great! Working on a new project', timestamp: '10:32 AM', read: true, type: 'text' },
  { id: '4', senderId: 'u1', content: 'Check out this design I made', timestamp: '10:33 AM', read: true, type: 'image', imageUrl: 'https://picsum.photos/400/300?random=1' },
  { id: '5', senderId: 'me', content: 'Wow, that looks amazing! 🔥', timestamp: '10:35 AM', read: true, type: 'text' },
  { id: '6', senderId: 'u1', content: 'Thanks! I spent hours on it', timestamp: '10:36 AM', read: true, type: 'text' },
  { id: '7', senderId: 'me', content: 'The attention to detail is incredible', timestamp: '10:37 AM', read: true, type: 'text' },
  { id: '8', senderId: 'u1', content: 'Hey! Did you see the new billboard design?', timestamp: '10:40 AM', read: false, type: 'text' },
];

export default function ChatsPage() {
  const [conversations] = useState(mockConversations);
  const [selectedChat, setSelectedChat] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>(mockMessages);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const filteredConversations = conversations.filter(c =>
    c.user.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pinnedConversations = filteredConversations.filter(c => c.pinned);
  const regularConversations = filteredConversations.filter(c => !c.pinned);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (selectedChat) scrollToBottom();
  }, [messages, selectedChat]);

  const sendMessage = () => {
    if (!newMessage.trim()) return;
    
    const message: Message = {
      id: Date.now().toString(),
      senderId: 'me',
      content: newMessage,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      read: false,
      type: 'text'
    };
    
    setMessages(prev => [...prev, message]);
    setNewMessage('');
  };

  const formatTime = (timestamp: string) => {
    if (timestamp.includes('ago') || timestamp === 'Yesterday') return timestamp;
    return timestamp;
  };

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
          {pinnedConversations.length > 0 && (
            <div>
              <p className="px-4 py-2 text-xs font-medium text-gray-400 uppercase">Pinned</p>
              {pinnedConversations.map(renderConversation)}
            </div>
          )}
          
          {regularConversations.length > 0 && (
            <div>
              <p className="px-4 py-2 text-xs font-medium text-gray-400 uppercase">All Messages</p>
              {regularConversations.map(renderConversation)}
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
                  src={selectedChat.user.avatar}
                  alt={selectedChat.user.name}
                  className="w-10 h-10 rounded-full object-cover"
                />
                {selectedChat.user.online && (
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-black" />
                )}
              </div>
              <div>
                <h2 className="font-semibold">{selectedChat.user.name}</h2>
                <p className="text-xs text-gray-400">
                  {selectedChat.user.online ? 'Online' : 'Offline'}
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
            {messages.map((message, index) => {
              const isMe = message.senderId === 'me';
              const showAvatar = !isMe && (index === 0 || messages[index - 1].senderId !== message.senderId);
              
              return (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                >
                  {!isMe && showAvatar && (
                    <img
                      src={selectedChat.user.avatar}
                      alt=""
                      className="w-8 h-8 rounded-full mr-2 self-end"
                    />
                  )}
                  {!isMe && !showAvatar && <div className="w-10" />}
                  
                  <div className={`max-w-[70%] ${isMe ? 'items-end' : 'items-start'}`}>
                    {message.type === 'image' && message.imageUrl ? (
                      <img
                        src={message.imageUrl}
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
                      <span className="text-xs text-gray-500">{message.timestamp}</span>
                      {isMe && (
                        message.read 
                          ? <FaCheckDouble className="text-xs" style={{ color: GOLD }} />
                          : <FaCheck className="text-xs text-gray-500" />
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
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
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                className="flex-1 bg-white/10 rounded-full py-2 px-4 focus:outline-none focus:ring-2 transition-all"
                style={{ '--tw-ring-color': GOLD } as React.CSSProperties}
              />
              <button className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <FaSmile className="text-gray-400" />
              </button>
              <button
                onClick={sendMessage}
                className="w-10 h-10 rounded-full flex items-center justify-center transition-transform active:scale-95"
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
              src={conversation.user.avatar}
              alt={conversation.user.name}
              className="w-12 h-12 rounded-full object-cover"
            />
            {conversation.user.online && (
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-black" />
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold truncate">{conversation.user.name}</h3>
              <span className="text-xs text-gray-400">{formatTime(conversation.lastMessage.timestamp)}</span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <p className={`text-sm truncate ${conversation.unreadCount > 0 ? 'text-white font-medium' : 'text-gray-400'}`}>
                {conversation.lastMessage.senderId === 'me' && (
                  conversation.lastMessage.read 
                    ? <FaCheckDouble className="inline mr-1" style={{ color: GOLD }} />
                    : <FaCheck className="inline mr-1 text-gray-500" />
                )}
                {conversation.lastMessage.content}
              </p>
              {conversation.unreadCount > 0 && (
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
        
        {/* Status indicators */}
        <div className="flex items-center gap-2 mt-2 pl-15">
          {conversation.pinned && (
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <FaThumbtack /> Pinned
            </span>
          )}
          {conversation.muted && (
            <FaBellSlash className="text-xs text-gray-500" />
          )}
        </div>
      </motion.div>
    );
  }
}
