"use client";
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { FaTimes, FaEye, FaImage, FaVideo } from 'react-icons/fa';

interface UserProfile {
  id: string;
  full_name?: string;
  avatar_url?: string;
  email?: string;
}

interface MediaItem {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  media_type: string;
  media_url: string;
  thumbnail_url?: string;
  duration_seconds?: number;
  file_size_bytes?: number;
  width?: number;
  height?: number;
  is_approved: boolean | null;
  created_at: string;
  profiles?: UserProfile;
}

export default function AdminMediaPage() {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [filteredMedia, setFilteredMedia] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentFilter, setCurrentFilter] = useState('all');
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    fetchMedia();
  }, []);

  // Helper function to determine media status from is_approved
  // Note: is_approved defaults to true in DB, so false means rejected, null/undefined means pending
  const getMediaStatus = (item: MediaItem): string => {
    if (item.is_approved === true) return 'approved';
    if (item.is_approved === false) return 'rejected';
    return 'pending';
  };

  const filterMedia = React.useCallback(() => {
    if (currentFilter === 'all') {
      setFilteredMedia(media);
    } else {
      setFilteredMedia(media.filter(m => getMediaStatus(m) === currentFilter));
    }
  }, [media, currentFilter]);

  useEffect(() => {
    filterMedia();
  }, [filterMedia]);

  const fetchMedia = async () => {
    try {
      const { data, error } = await supabase
        .from('billboard_media')
        .select(`
          *,
          profiles:user_id (id, full_name, avatar_url, email)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching media:', error);
        return;
      }

      setMedia(data || []);
      setPendingCount((data || []).filter(m => m.is_approved === null || m.is_approved === undefined).length);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('billboard_media')
        .update({ is_approved: true })
        .eq('id', id)
        .select();

      if (error) {
        console.error('Supabase error:', error);
        alert(`Failed to approve media: ${error.message}`);
        return;
      }

      if (!data || data.length === 0) {
        console.error('No rows updated - RLS policy may be blocking the update');
        alert('Failed to approve media. You may not have permission to approve this item. Please check RLS policies.');
        return;
      }

      setMedia(prev =>
        prev.map(m => m.id === id ? { ...m, is_approved: true } : m)
      );
      setPendingCount(prev => Math.max(0, prev - 1));
      setShowModal(false);
    } catch (error) {
      console.error('Error approving media:', error);
      alert('An error occurred while approving the media.');
    }
  };

  const handleReject = async () => {
    if (!selectedMedia) return;

    try {
      const { data, error } = await supabase
        .from('billboard_media')
        .update({ is_approved: false })
        .eq('id', selectedMedia.id)
        .select();

      if (error) {
        console.error('Supabase error:', error);
        alert(`Failed to reject media: ${error.message}`);
        return;
      }

      if (!data || data.length === 0) {
        console.error('No rows updated - RLS policy may be blocking the update');
        alert('Failed to reject media. You may not have permission. Please check RLS policies.');
        return;
      }

      setMedia(prev =>
        prev.map(m => m.id === selectedMedia.id ? { ...m, is_approved: false } : m)
      );
      setPendingCount(prev => Math.max(0, prev - 1));
      setShowRejectModal(false);
      setShowModal(false);
      setRejectionReason('');
    } catch (error) {
      console.error('Error rejecting media:', error);
      alert('An error occurred while rejecting the media.');
    }
  };

  const getStatusBadge = (item: MediaItem) => {
    const status = getMediaStatus(item);
    const styles: Record<string, string> = {
      pending: 'bg-orange-500/15 text-orange-500',
      approved: 'bg-green-500/15 text-green-500',
      rejected: 'bg-red-500/15 text-red-500',
    };
    return styles[status] || 'bg-gray-500/15 text-gray-500';
  };

  const isVideo = (mediaType: string) => {
    return mediaType === 'video' || mediaType?.startsWith('video/') || mediaType?.includes('video');
  };

  const filters = [
    { key: 'all', label: 'All Media' },
    { key: 'pending', label: 'Pending Review', count: pendingCount },
    { key: 'approved', label: 'Approved' },
    { key: 'rejected', label: 'Rejected' },
  ];

  return (
    <div className="p-4 lg:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-bold">Media Library</h2>
          <p className="text-white/40">Review and manage uploaded billboard media</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 md:gap-4 mb-6 flex-wrap">
        {filters.map((filter) => (
          <button
            key={filter.key}
            onClick={() => setCurrentFilter(filter.key)}
            className={`px-3 md:px-4 py-2 rounded-lg border transition text-sm md:text-base ${
              currentFilter === filter.key
                ? 'bg-[#D4AF37] text-black border-[#D4AF37]'
                : 'bg-white/[0.02] border-white/[0.06] hover:border-white/[0.12]'
            }`}
          >
            {filter.label}
            {filter.count !== undefined && filter.count > 0 && (
              <span className="ml-1 md:ml-2 text-orange-500">({filter.count})</span>
            )}
          </button>
        ))}
      </div>

      {/* Media Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {isLoading ? (
          <div className="col-span-full text-center text-white/40 py-12">
            Loading...
          </div>
        ) : filteredMedia.length === 0 ? (
          <div className="col-span-full text-center text-white/40 py-12">
            <FaImage className="mx-auto text-5xl mb-4 opacity-50" />
            <p>No media found</p>
          </div>
        ) : (
          filteredMedia.map((item) => (
            <div
              key={item.id}
              className="bg-white/[0.02] rounded-xl border border-white/[0.04] overflow-hidden hover:border-white/[0.1] transition transform hover:-translate-y-1 hover:shadow-xl">
              {/* Media Preview */}
              <div 
                className="aspect-video bg-black relative cursor-pointer group"
                onClick={() => {
                  setSelectedMedia(item);
                  setShowModal(true);
                }}
              >
                {item.media_url ? (
                  isVideo(item.media_type) ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <FaVideo className="text-4xl text-white/20" />
                    </div>
                  ) : (
                    <img
                      src={item.thumbnail_url || item.media_url}
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                  )
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <FaImage className="text-4xl text-white/20" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                  <FaEye className="text-2xl text-white" />
                </div>
              </div>

              {/* Media Info */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium truncate flex-1">{item.title || 'Unnamed'}</p>
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ml-2 ${getStatusBadge(item)}`}>
                    {getMediaStatus(item)}
                  </span>
                </div>
                <p className="text-sm text-white/40 truncate">
                  {item.profiles?.full_name || item.profiles?.email || 'Unknown user'}
                </p>
                <p className="text-xs text-white/30 mt-1">
                  {new Date(item.created_at).toLocaleDateString()}
                </p>

                {/* Quick Actions */}
                {getMediaStatus(item) === 'pending' && (
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleApprove(item.id);
                      }}
                      className="flex-1 py-2 rounded-lg bg-green-500/20 text-green-500 hover:bg-green-500/30 transition text-sm font-medium"
                    >
                      Approve
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedMedia(item);
                        setShowRejectModal(true);
                      }}
                      className="flex-1 py-2 rounded-lg bg-red-500/20 text-red-500 hover:bg-red-500/30 transition text-sm font-medium"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Media Preview Modal */}
      {showModal && selectedMedia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-black rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-auto border border-white/[0.06]">
            <div className="p-6 border-b border-white/[0.06] flex justify-between items-center sticky top-0 bg-black z-10">
              <h3 className="text-lg font-bold">Media Details</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-white/40 hover:text-white"
              >
                <FaTimes className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              {/* Preview */}
              <div className="aspect-video bg-white/[0.02] rounded-lg overflow-hidden mb-6">
                {selectedMedia.media_url ? (
                  isVideo(selectedMedia.media_type) ? (
                    <video
                      src={selectedMedia.media_url}
                      controls
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <img
                      src={selectedMedia.media_url}
                      alt={selectedMedia.title}
                      className="w-full h-full object-contain"
                    />
                  )
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <FaImage className="text-5xl text-white/20" />
                  </div>
                )}
              </div>

              {/* Details */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-sm text-white/40">Title</p>
                  <p className="font-medium">{selectedMedia.title || 'Unnamed'}</p>
                </div>
                <div>
                  <p className="text-sm text-white/40">Status</p>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 ${getStatusBadge(selectedMedia)}`}>
                    {getMediaStatus(selectedMedia)}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-white/40">Media Type</p>
                  <p className="font-medium">{selectedMedia.media_type === 'video' ? '🎬 Video' : '🖼️ Image'}</p>
                </div>
                <div>
                  <p className="text-sm text-white/40">Uploaded By</p>
                  <p className="font-medium">{selectedMedia.profiles?.full_name || selectedMedia.profiles?.email || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-sm text-white/40">Upload Date</p>
                  <p className="font-medium">{new Date(selectedMedia.created_at).toLocaleString()}</p>
                </div>
                {selectedMedia.description && (
                  <div className="col-span-2">
                    <p className="text-sm text-white/40">Description</p>
                    <p className="font-medium">{selectedMedia.description}</p>
                  </div>
                )}
              </div>

              {/* Actions */}
              {getMediaStatus(selectedMedia) === 'pending' && (
                <div className="flex gap-4 pt-4 border-t border-white/[0.06]">
                  <button
                    onClick={() => handleApprove(selectedMedia.id)}
                    className="flex-1 py-3 rounded-lg bg-green-600 hover:bg-green-700 transition font-semibold"
                  >
                    Approve Media
                  </button>
                  <button
                    onClick={() => setShowRejectModal(true)}
                    className="flex-1 py-3 rounded-lg bg-red-600 hover:bg-red-700 transition font-semibold"
                  >
                    Reject Media
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-black rounded-2xl w-full max-w-md border border-white/[0.06]">
            <div className="p-6 border-b border-white/[0.06]">
              <h3 className="text-lg font-bold">Reject Media</h3>
            </div>
            <div className="p-6">
              <label className="block text-sm text-white/40 mb-2">
                Reason for rejection
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full bg-white/[0.02] border border-white/[0.06] rounded-lg p-3 text-white resize-none focus:border-[#D4AF37]/50 focus:outline-none"
                rows={4}
                placeholder="Enter the reason for rejecting this media..."
              />
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowRejectModal(false);
                    setRejectionReason('');
                  }}
                  className="flex-1 px-4 py-3 rounded-lg border border-white/[0.1] hover:bg-white/[0.04] transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReject}
                  className="flex-1 px-4 py-3 rounded-lg bg-red-600 hover:bg-red-700 transition font-semibold"
                >
                  Reject
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
