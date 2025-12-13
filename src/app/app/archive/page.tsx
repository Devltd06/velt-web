'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaArrowLeft, FaPlay, FaPause, FaRedo, FaTrash, FaDownload,
  FaHeart, FaComment, FaEye, FaCalendar, FaChartBar,
  FaImage, FaVideo, FaTimes, FaChevronLeft, FaChevronRight
} from 'react-icons/fa';
import Link from 'next/link';

const GOLD = '#D4AF37';

interface ExpiredStory {
  id: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  caption?: string;
  createdAt: string;
  expiredAt: string;
  views: number;
  likes: number;
  comments: number;
  isHD?: boolean;
}

const mockExpiredStories: ExpiredStory[] = [
  {
    id: '1',
    mediaUrl: 'https://picsum.photos/400/600?random=20',
    mediaType: 'image',
    caption: 'Beautiful sunset at the beach 🌅',
    createdAt: '2024-01-10',
    expiredAt: '2024-01-11',
    views: 1234,
    likes: 89,
    comments: 12,
    isHD: true
  },
  {
    id: '2',
    mediaUrl: 'https://picsum.photos/400/600?random=21',
    mediaType: 'image',
    caption: 'New product launch! 🚀',
    createdAt: '2024-01-08',
    expiredAt: '2024-01-09',
    views: 2456,
    likes: 156,
    comments: 34,
  },
  {
    id: '3',
    mediaUrl: 'https://picsum.photos/400/600?random=22',
    mediaType: 'video',
    caption: 'Behind the scenes 🎬',
    createdAt: '2024-01-05',
    expiredAt: '2024-01-06',
    views: 3789,
    likes: 234,
    comments: 56,
    isHD: true
  },
  {
    id: '4',
    mediaUrl: 'https://picsum.photos/400/600?random=23',
    mediaType: 'image',
    createdAt: '2024-01-03',
    expiredAt: '2024-01-04',
    views: 987,
    likes: 67,
    comments: 8,
  },
  {
    id: '5',
    mediaUrl: 'https://picsum.photos/400/600?random=24',
    mediaType: 'image',
    caption: 'Monday motivation 💪',
    createdAt: '2024-01-01',
    expiredAt: '2024-01-02',
    views: 1567,
    likes: 123,
    comments: 21,
  },
  {
    id: '6',
    mediaUrl: 'https://picsum.photos/400/600?random=25',
    mediaType: 'video',
    caption: 'Happy New Year! 🎉',
    createdAt: '2023-12-31',
    expiredAt: '2024-01-01',
    views: 5678,
    likes: 456,
    comments: 89,
    isHD: true
  },
];

type FilterType = 'all' | 'images' | 'videos';

export default function ExpiredStoriesPage() {
  const [stories, setStories] = useState(mockExpiredStories);
  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedStory, setSelectedStory] = useState<ExpiredStory | null>(null);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  const filteredStories = filter === 'all' 
    ? stories 
    : stories.filter(s => filter === 'images' ? s.mediaType === 'image' : s.mediaType === 'video');

  const analytics = {
    totalViews: stories.reduce((sum, s) => sum + s.views, 0),
    totalLikes: stories.reduce((sum, s) => sum + s.likes, 0),
    totalStories: stories.length,
    avgEngagement: (stories.reduce((sum, s) => sum + s.likes + s.comments, 0) / stories.length).toFixed(1)
  };

  const handleRevive = (story: ExpiredStory) => {
    // In real app, this would repost the story
    alert(`Story "${story.caption || 'Untitled'}" will be revived!`);
  };

  const handleDelete = (storyId: string) => {
    setStories(prev => prev.filter(s => s.id !== storyId));
    if (selectedStory?.id === storyId) {
      setSelectedStory(null);
    }
  };

  const openViewer = (story: ExpiredStory, index: number) => {
    setSelectedStory(story);
    setViewerIndex(index);
  };

  const navigateViewer = (direction: 'prev' | 'next') => {
    const newIndex = direction === 'next' 
      ? Math.min(viewerIndex + 1, filteredStories.length - 1)
      : Math.max(viewerIndex - 1, 0);
    setViewerIndex(newIndex);
    setSelectedStory(filteredStories[newIndex]);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-black/90 backdrop-blur-lg border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/app/profile" className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <FaArrowLeft />
              </Link>
              <div>
                <h1 className="text-xl font-bold">Story Archive</h1>
                <p className="text-sm text-gray-400">{stories.length} expired stories</p>
              </div>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-2 mt-4">
            {(['all', 'images', 'videos'] as FilterType[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                  filter === f 
                    ? 'text-black' 
                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
                style={filter === f ? { backgroundColor: GOLD } : {}}
              >
                {f === 'images' && <FaImage />}
                {f === 'videos' && <FaVideo />}
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Analytics Summary */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-white/5 rounded-xl p-4 text-center">
            <FaEye className="mx-auto mb-2 text-gray-400" />
            <p className="text-2xl font-bold">{analytics.totalViews.toLocaleString()}</p>
            <p className="text-xs text-gray-400">Total Views</p>
          </div>
          <div className="bg-white/5 rounded-xl p-4 text-center">
            <FaHeart className="mx-auto mb-2 text-red-400" />
            <p className="text-2xl font-bold">{analytics.totalLikes.toLocaleString()}</p>
            <p className="text-xs text-gray-400">Total Likes</p>
          </div>
          <div className="bg-white/5 rounded-xl p-4 text-center">
            <FaChartBar className="mx-auto mb-2" style={{ color: GOLD }} />
            <p className="text-2xl font-bold">{analytics.avgEngagement}</p>
            <p className="text-xs text-gray-400">Avg. Engagement</p>
          </div>
          <div className="bg-white/5 rounded-xl p-4 text-center">
            <FaCalendar className="mx-auto mb-2 text-blue-400" />
            <p className="text-2xl font-bold">{analytics.totalStories}</p>
            <p className="text-xs text-gray-400">Total Stories</p>
          </div>
        </div>

        {/* Stories Grid */}
        {filteredStories.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <FaImage className="text-5xl mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No expired stories</p>
            <p className="text-sm">Your archived stories will appear here</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {filteredStories.map((story, index) => (
              <motion.div
                key={story.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                className="relative aspect-[3/4] rounded-xl overflow-hidden group cursor-pointer"
                onClick={() => openViewer(story, index)}
              >
                <img
                  src={story.mediaUrl}
                  alt=""
                  className="w-full h-full object-cover"
                />
                
                {/* Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                
                {/* HD Badge */}
                {story.isHD && (
                  <div className="absolute top-2 right-2 px-2 py-0.5 bg-black/60 rounded text-xs font-bold">
                    HD
                  </div>
                )}
                
                {/* Video indicator */}
                {story.mediaType === 'video' && (
                  <div className="absolute top-2 left-2 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center">
                    <FaPlay className="text-xs" />
                  </div>
                )}
                
                {/* Stats */}
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <div className="flex items-center gap-3 text-sm">
                    <span className="flex items-center gap-1">
                      <FaEye className="text-xs" /> {story.views}
                    </span>
                    <span className="flex items-center gap-1">
                      <FaHeart className="text-xs" /> {story.likes}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{formatDate(story.expiredAt)}</p>
                </div>

                {/* Hover Actions */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRevive(story); }}
                    className="w-12 h-12 rounded-full flex items-center justify-center transition-colors"
                    style={{ backgroundColor: GOLD }}
                  >
                    <FaRedo className="text-black" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(story.id); }}
                    className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center hover:bg-red-500/40 transition-colors"
                  >
                    <FaTrash className="text-red-400" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Full Screen Viewer */}
      <AnimatePresence>
        {selectedStory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black z-50"
          >
            {/* Media */}
            <div className="absolute inset-0 flex items-center justify-center">
              {selectedStory.mediaType === 'video' ? (
                <video
                  src={selectedStory.mediaUrl}
                  className="max-w-full max-h-full object-contain"
                  autoPlay={isPlaying}
                  loop
                  muted
                />
              ) : (
                <img
                  src={selectedStory.mediaUrl}
                  alt=""
                  className="max-w-full max-h-full object-contain"
                />
              )}
            </div>

            {/* Controls */}
            <div className="absolute inset-x-0 top-0 p-4 bg-gradient-to-b from-black/60 to-transparent">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setSelectedStory(null)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <FaTimes className="text-xl" />
                </button>
                <div className="text-center">
                  <p className="text-sm text-gray-400">{formatDate(selectedStory.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button className="p-2 hover:bg-white/10 rounded-full transition-colors">
                    <FaDownload />
                  </button>
                </div>
              </div>
            </div>

            {/* Bottom Info */}
            <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
              {selectedStory.caption && (
                <p className="text-white mb-4">{selectedStory.caption}</p>
              )}
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-2">
                    <FaEye /> {selectedStory.views.toLocaleString()}
                  </span>
                  <span className="flex items-center gap-2">
                    <FaHeart /> {selectedStory.likes.toLocaleString()}
                  </span>
                  <span className="flex items-center gap-2">
                    <FaComment /> {selectedStory.comments}
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleRevive(selectedStory)}
                    className="px-4 py-2 rounded-full font-medium flex items-center gap-2"
                    style={{ backgroundColor: GOLD, color: 'black' }}
                  >
                    <FaRedo /> Revive
                  </button>
                </div>
              </div>
            </div>

            {/* Navigation */}
            {viewerIndex > 0 && (
              <button
                onClick={() => navigateViewer('prev')}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/50 flex items-center justify-center hover:bg-black/70 transition-colors"
              >
                <FaChevronLeft />
              </button>
            )}
            {viewerIndex < filteredStories.length - 1 && (
              <button
                onClick={() => navigateViewer('next')}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/50 flex items-center justify-center hover:bg-black/70 transition-colors"
              >
                <FaChevronRight />
              </button>
            )}

            {/* Play/Pause for video */}
            {selectedStory.mediaType === 'video' && (
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="absolute bottom-24 right-4 w-12 h-12 rounded-full bg-black/50 flex items-center justify-center"
              >
                {isPlaying ? <FaPause /> : <FaPlay />}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
