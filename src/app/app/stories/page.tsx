'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaPause, FaHeart, FaComment, FaShare,
  FaChevronLeft, FaChevronRight, FaVolumeUp, FaVolumeMute,
  FaEye, FaEllipsisH, FaTimes
} from 'react-icons/fa';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

const GOLD = '#D4AF37';

interface Story {
  id: string;
  user: {
    id: string;
    name: string;
    avatar: string;
  };
  media: {
    type: 'image' | 'video';
    url: string;
  };
  caption?: string;
  timestamp: string;
  views: number;
  likes: number;
  isLiked: boolean;
}

interface StoryGroup {
  userId: string;
  user: {
    name: string;
    avatar: string;
  };
  stories: Story[];
  hasUnviewed: boolean;
}

const mockStoryGroups: StoryGroup[] = [
  {
    userId: 'u1',
    user: { name: 'Sarah Johnson', avatar: 'https://i.pravatar.cc/150?img=1' },
    hasUnviewed: true,
    stories: [
      {
        id: 's1',
        user: { id: 'u1', name: 'Sarah Johnson', avatar: 'https://i.pravatar.cc/150?img=1' },
        media: { type: 'image', url: 'https://picsum.photos/1080/1920?random=1' },
        caption: 'Beautiful sunset today! 🌅',
        timestamp: '2h ago',
        views: 234,
        likes: 45,
        isLiked: false
      },
      {
        id: 's2',
        user: { id: 'u1', name: 'Sarah Johnson', avatar: 'https://i.pravatar.cc/150?img=1' },
        media: { type: 'image', url: 'https://picsum.photos/1080/1920?random=2' },
        caption: 'Coffee time ☕',
        timestamp: '1h ago',
        views: 189,
        likes: 32,
        isLiked: true
      },
    ]
  },
  {
    userId: 'u2',
    user: { name: 'Mike Chen', avatar: 'https://i.pravatar.cc/150?img=2' },
    hasUnviewed: true,
    stories: [
      {
        id: 's3',
        user: { id: 'u2', name: 'Mike Chen', avatar: 'https://i.pravatar.cc/150?img=2' },
        media: { type: 'image', url: 'https://picsum.photos/1080/1920?random=3' },
        caption: 'New project coming soon! 🚀',
        timestamp: '3h ago',
        views: 567,
        likes: 89,
        isLiked: false
      },
    ]
  },
  {
    userId: 'u3',
    user: { name: 'Emma Wilson', avatar: 'https://i.pravatar.cc/150?img=3' },
    hasUnviewed: false,
    stories: [
      {
        id: 's4',
        user: { id: 'u3', name: 'Emma Wilson', avatar: 'https://i.pravatar.cc/150?img=3' },
        media: { type: 'image', url: 'https://picsum.photos/1080/1920?random=4' },
        caption: 'Weekend vibes 🎉',
        timestamp: '5h ago',
        views: 345,
        likes: 67,
        isLiked: true
      },
    ]
  },
];

function StoryViewerContent() {
  const searchParams = useSearchParams();
  const initialUserId = searchParams.get('userId') || mockStoryGroups[0].userId;
  
  const [currentGroupIndex, setCurrentGroupIndex] = useState(
    mockStoryGroups.findIndex(g => g.userId === initialUserId) || 0
  );
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [stories, setStories] = useState(mockStoryGroups);

  const currentGroup = stories[currentGroupIndex];
  const currentStory = currentGroup?.stories[currentStoryIndex];
  const STORY_DURATION = 5000; // 5 seconds per story

  const goToNextStory = useCallback(() => {
    if (currentStoryIndex < currentGroup?.stories.length - 1) {
      setCurrentStoryIndex(prev => prev + 1);
      setProgress(0);
    } else if (currentGroupIndex < stories.length - 1) {
      setCurrentGroupIndex(prev => prev + 1);
      setCurrentStoryIndex(0);
      setProgress(0);
    }
  }, [currentStoryIndex, currentGroup?.stories.length, currentGroupIndex, stories.length]);

  useEffect(() => {
    if (isPaused || !currentStory) return;

    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          goToNextStory();
          return 0;
        }
        return prev + (100 / (STORY_DURATION / 100));
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isPaused, currentStory, goToNextStory, STORY_DURATION]);

  const goToPrevStory = () => {
    if (currentStoryIndex > 0) {
      setCurrentStoryIndex(prev => prev - 1);
      setProgress(0);
    } else if (currentGroupIndex > 0) {
      setCurrentGroupIndex(prev => prev - 1);
      const prevGroup = stories[currentGroupIndex - 1];
      setCurrentStoryIndex(prevGroup.stories.length - 1);
      setProgress(0);
    }
  };

  const handleLike = () => {
    setStories(prev => prev.map((group, gi) => {
      if (gi !== currentGroupIndex) return group;
      return {
        ...group,
        stories: group.stories.map((story, si) => {
          if (si !== currentStoryIndex) return story;
          return {
            ...story,
            isLiked: !story.isLiked,
            likes: story.isLiked ? story.likes - 1 : story.likes + 1
          };
        })
      };
    }));
  };

  if (!currentStory) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-white">No stories available</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black z-50">
      {/* Story Content */}
      <div 
        className="relative w-full h-full"
        onClick={(e) => {
          const x = e.clientX;
          const width = window.innerWidth;
          if (x < width / 3) goToPrevStory();
          else if (x > (width * 2) / 3) goToNextStory();
          else setIsPaused(!isPaused);
        }}
      >
        {/* Media */}
        <motion.div
          key={currentStory.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0"
        >
          {currentStory.media.type === 'video' ? (
            <video
              src={currentStory.media.url}
              className="w-full h-full object-cover"
              autoPlay
              muted={isMuted}
              loop
            />
          ) : (
            <img
              src={currentStory.media.url}
              alt=""
              className="w-full h-full object-cover"
            />
          )}
        </motion.div>

        {/* Gradient Overlays */}
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/60 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-60 bg-gradient-to-t from-black/80 to-transparent" />

        {/* Progress Bars */}
        <div className="absolute top-4 inset-x-4 flex gap-1 z-10">
          {currentGroup.stories.map((_, index) => (
            <div key={index} className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: GOLD }}
                initial={{ width: 0 }}
                animate={{
                  width: index < currentStoryIndex 
                    ? '100%' 
                    : index === currentStoryIndex 
                      ? `${progress}%` 
                      : '0%'
                }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-8 inset-x-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <Link href="/app/home" className="p-2 -ml-2">
              <FaTimes className="text-white text-xl" />
            </Link>
            <img
              src={currentStory.user.avatar}
              alt={currentStory.user.name}
              className="w-10 h-10 rounded-full border-2"
              style={{ borderColor: GOLD }}
            />
            <div>
              <p className="font-semibold text-white">{currentStory.user.name}</p>
              <p className="text-xs text-gray-300">{currentStory.timestamp}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button onClick={() => setIsMuted(!isMuted)} className="p-2">
              {isMuted ? (
                <FaVolumeMute className="text-white text-lg" />
              ) : (
                <FaVolumeUp className="text-white text-lg" />
              )}
            </button>
            <button className="p-2">
              <FaEllipsisH className="text-white text-lg" />
            </button>
          </div>
        </div>

        {/* Pause Indicator */}
        <AnimatePresence>
          {isPaused && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
              <div className="w-20 h-20 rounded-full bg-black/50 flex items-center justify-center">
                <FaPause className="text-white text-2xl" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation Arrows */}
        {currentGroupIndex > 0 || currentStoryIndex > 0 ? (
          <button
            onClick={(e) => { e.stopPropagation(); goToPrevStory(); }}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/30 flex items-center justify-center hover:bg-black/50 transition-colors z-10"
          >
            <FaChevronLeft className="text-white" />
          </button>
        ) : null}

        {currentGroupIndex < stories.length - 1 || currentStoryIndex < currentGroup.stories.length - 1 ? (
          <button
            onClick={(e) => { e.stopPropagation(); goToNextStory(); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/30 flex items-center justify-center hover:bg-black/50 transition-colors z-10"
          >
            <FaChevronRight className="text-white" />
          </button>
        ) : null}

        {/* Bottom Info */}
        <div className="absolute bottom-0 inset-x-0 p-4 z-10">
          {/* Caption */}
          {currentStory.caption && (
            <p className="text-white mb-4">{currentStory.caption}</p>
          )}

          {/* Stats & Actions */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4 text-white/80 text-sm">
              <span className="flex items-center gap-1">
                <FaEye /> {currentStory.views}
              </span>
            </div>
            
            <div className="flex items-center gap-4">
              <button 
                onClick={(e) => { e.stopPropagation(); handleLike(); }}
                className="flex items-center gap-2"
              >
                <FaHeart 
                  className={`text-xl ${currentStory.isLiked ? 'text-red-500' : 'text-white'}`}
                />
                <span className="text-white text-sm">{currentStory.likes}</span>
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); setShowReply(true); setIsPaused(true); }}
                className="text-white"
              >
                <FaComment className="text-xl" />
              </button>
              <button className="text-white">
                <FaShare className="text-xl" />
              </button>
            </div>
          </div>

          {/* Reply Input */}
          {showReply ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                type="text"
                placeholder={`Reply to ${currentStory.user.name}...`}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                autoFocus
                onBlur={() => { setShowReply(false); setIsPaused(false); }}
                className="flex-1 bg-white/10 backdrop-blur-lg rounded-full py-3 px-4 text-white placeholder-white/50 focus:outline-none"
              />
              <button 
                className="px-4 py-3 rounded-full font-medium"
                style={{ backgroundColor: GOLD, color: 'black' }}
              >
                Send
              </button>
            </motion.div>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); setShowReply(true); setIsPaused(true); }}
              className="w-full bg-white/10 backdrop-blur-lg rounded-full py-3 px-4 text-white/50 text-left"
            >
              Reply to {currentStory.user.name}...
            </button>
          )}
        </div>
      </div>

      {/* Story Preview Strip */}
      <div className="absolute bottom-32 left-1/2 -translate-x-1/2 flex gap-2 z-20">
        {stories.map((group, index) => (
          <button
            key={group.userId}
            onClick={() => {
              setCurrentGroupIndex(index);
              setCurrentStoryIndex(0);
              setProgress(0);
            }}
            className={`w-12 h-12 rounded-full border-2 overflow-hidden transition-all ${
              index === currentGroupIndex ? 'scale-110' : 'opacity-50'
            }`}
            style={{ borderColor: index === currentGroupIndex ? GOLD : 'transparent' }}
          >
            <img
              src={group.user.avatar}
              alt={group.user.name}
              className="w-full h-full object-cover"
            />
          </button>
        ))}
      </div>
    </div>
  );
}

export default function StoryViewerPage() {
  return (
    <Suspense fallback={
      <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2" style={{ borderColor: '#D4AF37' }} />
      </div>
    }>
      <StoryViewerContent />
    </Suspense>
  );
}
