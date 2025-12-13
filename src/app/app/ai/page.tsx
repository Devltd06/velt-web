'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaArrowLeft, FaPaperPlane, FaRobot, FaLightbulb, FaCode, 
  FaChartLine, FaMagic, FaSpinner, FaHistory, FaTrash,
  FaMicrophone
} from 'react-icons/fa';
import Link from 'next/link';

const GOLD = '#D4AF37';

interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: Date;
  loading?: boolean;
}

const quickPrompts = [
  { icon: FaLightbulb, text: "What's trending in advertising?" },
  { icon: FaCode, text: "Help me design a campaign" },
  { icon: FaChartLine, text: "Analyze my billboard performance" },
  { icon: FaMagic, text: "Generate ad copy ideas" },
];

const aiResponses: Record<string, string> = {
  "what's trending in advertising?": "🔥 **Current Advertising Trends:**\n\n1. **Interactive Digital Billboards** - Billboards that respond to weather, time, and audience demographics\n\n2. **Sustainability Messaging** - Brands highlighting eco-friendly practices\n\n3. **AR Integration** - QR codes linking to augmented reality experiences\n\n4. **User-Generated Content** - Featuring real customer stories\n\n5. **Minimalist Design** - Clean, bold visuals with less text\n\nWould you like me to dive deeper into any of these trends?",
  
  "help me design a campaign": "🎯 **Let's design your campaign!**\n\nI'll need a few details:\n\n1. **Target Audience** - Who are you trying to reach?\n2. **Campaign Goal** - Brand awareness, sales, event promotion?\n3. **Budget Range** - This helps determine billboard locations\n4. **Timeline** - When should the campaign run?\n\nShare these details and I'll create a customized campaign strategy for you!",
  
  "analyze my billboard performance": "📊 **Billboard Performance Analysis**\n\nBased on your recent campaigns:\n\n• **Impressions:** 2.4M (↑ 18% vs last month)\n• **Engagement Rate:** 3.2%\n• **Best Performing Location:** Accra CBD\n• **Peak Hours:** 7-9 AM, 5-7 PM\n\n**Recommendations:**\n- Consider adding QR codes for tracking\n- Test different color schemes\n- Extend duration in high-performing areas\n\nWant a detailed breakdown?",
  
  "generate ad copy ideas": "✨ **Ad Copy Ideas:**\n\n**For Brand Awareness:**\n\"Your brand. Their world. VELT connects them.\"\n\n**For Sales:**\n\"See the difference. Feel the impact. Book your billboard today.\"\n\n**For Events:**\n\"Don't just announce. Dominate the streets.\"\n\n**For Local Business:**\n\"Your neighbors are watching. Make it count.\"\n\nWant me to customize these for your specific industry?",
};

export default function AISearchPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'ai',
      content: "👋 Hi! I'm your VELT AI assistant. I can help you with:\n\n• Advertising trends and insights\n• Campaign design and strategy\n• Billboard performance analysis\n• Creative copy generation\n\nHow can I assist you today?",
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const simulateAIResponse = async (userMessage: string): Promise<string> => {
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
    
    const lowerMessage = userMessage.toLowerCase();
    
    // Check for matching prompts
    for (const [key, response] of Object.entries(aiResponses)) {
      if (lowerMessage.includes(key.split(' ')[0]) || lowerMessage === key) {
        return response;
      }
    }
    
    // Default response
    return `Thanks for your message! I understand you're asking about "${userMessage}".\n\nI'm designed to help with:\n- Billboard advertising strategies\n- Campaign optimization\n- Market trends\n- Creative assistance\n\nCould you provide more details about what you're looking for?`;
  };

  const handleSend = async (text?: string) => {
    const messageText = (text || input).trim();
    if (!messageText || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: messageText,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Add loading message
    const loadingId = `loading-${Date.now()}`;
    setMessages(prev => [...prev, {
      id: loadingId,
      role: 'ai',
      content: '',
      timestamp: new Date(),
      loading: true,
    }]);

    try {
      const response = await simulateAIResponse(messageText);
      
      setMessages(prev => prev.filter(m => m.id !== loadingId));
      
      const aiMessage: Message = {
        id: `ai-${Date.now()}`,
        role: 'ai',
        content: response,
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, aiMessage]);
    } catch {
      setMessages(prev => prev.filter(m => m.id !== loadingId));
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'ai',
        content: '❌ Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([{
      id: 'welcome',
      role: 'ai',
      content: "👋 Chat cleared! How can I help you?",
      timestamp: new Date(),
    }]);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-black/90 backdrop-blur-lg border-b border-white/10">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/app/home" className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <FaArrowLeft />
              </Link>
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: `${GOLD}20` }}
                >
                  <FaRobot style={{ color: GOLD }} />
                </div>
                <div>
                  <h1 className="font-bold">VELT AI</h1>
                  <p className="text-xs text-gray-400">Powered by AI</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <FaHistory className="text-gray-400" />
              </button>
              <button
                onClick={clearChat}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <FaTrash className="text-gray-400" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Prompts */}
      <div className="px-4 py-3 border-b border-white/5 overflow-x-auto">
        <div className="max-w-3xl mx-auto">
          <div className="flex gap-2">
            {quickPrompts.map((prompt, index) => (
              <motion.button
                key={index}
                onClick={() => handleSend(prompt.text)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 text-sm whitespace-nowrap transition-colors"
              >
                <prompt.icon style={{ color: GOLD }} />
                {prompt.text}
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-6">
          <AnimatePresence>
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[85%] ${message.role === 'user' ? 'order-2' : ''}`}>
                  {message.role === 'ai' && (
                    <div className="flex items-center gap-2 mb-2">
                      <div 
                        className="w-6 h-6 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: `${GOLD}20` }}
                      >
                        <FaRobot className="text-xs" style={{ color: GOLD }} />
                      </div>
                      <span className="text-xs text-gray-400">VELT AI</span>
                    </div>
                  )}
                  
                  <div
                    className={`px-4 py-3 rounded-2xl ${
                      message.role === 'user'
                        ? 'rounded-br-md'
                        : 'bg-white/10 rounded-bl-md'
                    }`}
                    style={message.role === 'user' ? { backgroundColor: GOLD, color: 'black' } : {}}
                  >
                    {message.loading ? (
                      <div className="flex items-center gap-2">
                        <FaSpinner className="animate-spin" style={{ color: GOLD }} />
                        <span className="text-gray-400">Thinking...</span>
                      </div>
                    ) : (
                      <div className="text-sm whitespace-pre-wrap">
                        {message.content.split('\n').map((line, i) => (
                          <p key={i} className={line.startsWith('**') ? 'font-semibold' : ''}>
                            {line.replace(/\*\*/g, '')}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <p className={`text-xs text-gray-500 mt-1 ${message.role === 'user' ? 'text-right' : ''}`}>
                    {formatTime(message.timestamp)}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="sticky bottom-0 bg-black/90 backdrop-blur-lg border-t border-white/10 p-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Ask me anything..."
                disabled={isLoading}
                className="w-full bg-white/10 rounded-full py-3 px-5 pr-12 focus:outline-none focus:ring-2 transition-all disabled:opacity-50"
                style={{ '--tw-ring-color': GOLD } as React.CSSProperties}
              />
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <FaMicrophone className="text-gray-400" />
              </button>
            </div>
            <motion.button
              onClick={() => handleSend()}
              disabled={!input.trim() || isLoading}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="w-12 h-12 rounded-full flex items-center justify-center transition-all disabled:opacity-50"
              style={{ backgroundColor: GOLD }}
            >
              {isLoading ? (
                <FaSpinner className="animate-spin text-black" />
              ) : (
                <FaPaperPlane className="text-black" />
              )}
            </motion.button>
          </div>
          
          <p className="text-center text-xs text-gray-500 mt-2">
            VELT AI can make mistakes. Consider checking important information.
          </p>
        </div>
      </div>
    </div>
  );
}
