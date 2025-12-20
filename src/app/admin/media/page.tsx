"use client";
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { FaTimes, FaEye, FaImage, FaVideo } from 'react-icons/fa';

interface MediaItem {
  id: string;
  user_id: string;
  user_email?: string;
  file_url: string;
  file_type: string;
  file_name: string;
  status: string;
  rejection_reason?: string;
  created_at: string;
  booking_id?: string;
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

  const filterMedia = React.useCallback(() => {
    if (currentFilter === 'all') {
      setFilteredMedia(media);
    } else {
      setFilteredMedia(media.filter(m => m.status === currentFilter));
    }
  }, [media, currentFilter]);

  useEffect(() => {
    filterMedia();
  }, [filterMedia]);

  const fetchMedia = async () => {
    try {
      const { data, error } = await supabase
        .from('billboard_media')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching media:', error);
        return;
      }

      setMedia(data || []);
      setPendingCount((data || []).filter(m => m.status === 'pending').length);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const { error } = await supabase
        .from('billboard_media')
        .update({ status: 'approved' })
        .eq('id', id);

      if (error) throw error;

      setMedia(prev =>
        prev.map(m => m.id === id ? { ...m, status: 'approved' } : m)
      );
      setPendingCount(prev => Math.max(0, prev - 1));
      setShowModal(false);
    } catch (error) {
      console.error('Error approving media:', error);
    }
  };

  const handleReject = async () => {
    if (!selectedMedia) return;

    try {
      const { error } = await supabase
        .from('billboard_media')
        .update({ status: 'rejected', rejection_reason: rejectionReason })
        .eq('id', selectedMedia.id);

      if (error) throw error;

      setMedia(prev =>
        prev.map(m => m.id === selectedMedia.id ? { ...m, status: 'rejected', rejection_reason: rejectionReason } : m)
      );
      setPendingCount(prev => Math.max(0, prev - 1));
      setShowRejectModal(false);
      setShowModal(false);
      setRejectionReason('');
    } catch (error) {
      console.error('Error rejecting media:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-orange-500/15 text-orange-500',
      approved: 'bg-green-500/15 text-green-500',
      rejected: 'bg-red-500/15 text-red-500',
    };
    return styles[status] || 'bg-gray-500/15 text-gray-500';
  };

  const isVideo = (fileType: string) => {
    return fileType?.startsWith('video/') || fileType?.includes('video');
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
          <p className="text-gray-400">Review and manage uploaded billboard media</p>
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
                : 'bg-gray-800 border-gray-700 hover:border-gray-600'
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
          <div className="col-span-full text-center text-gray-400 py-12">
            Loading...
          </div>
        ) : filteredMedia.length === 0 ? (
          <div className="col-span-full text-center text-gray-400 py-12">
            <FaImage className="mx-auto text-5xl mb-4 opacity-50" />
            <p>No media found</p>
          </div>
        ) : (
          filteredMedia.map((item) => (
            <div
              key={item.id}
              className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden hover:border-gray-600 transition transform hover:-translate-y-1 hover:shadow-xl"
            >
              {/* Media Preview */}
              <div 
                className="aspect-video bg-gray-900 relative cursor-pointer group"
                onClick={() => {
                  setSelectedMedia(item);
                  setShowModal(true);
                }}
              >
                {item.file_url ? (
                  isVideo(item.file_type) ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <FaVideo className="text-4xl text-gray-600" />
                    </div>
                  ) : (
                    <img
                      src={item.file_url}
                      alt={item.file_name}
                      className="w-full h-full object-cover"
                    />
                  )
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <FaImage className="text-4xl text-gray-600" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                  <FaEye className="text-2xl text-white" />
                </div>
              </div>

              {/* Media Info */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium truncate flex-1">{item.file_name || 'Unnamed'}</p>
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ml-2 ${getStatusBadge(item.status)}`}>
                    {item.status}
                  </span>
                </div>
                <p className="text-sm text-gray-400 truncate">{item.user_email || 'Unknown user'}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {new Date(item.created_at).toLocaleDateString()}
                </p>

                {/* Quick Actions */}
                {item.status === 'pending' && (
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="bg-gray-800 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-auto border border-gray-700">
            <div className="p-6 border-b border-gray-700 flex justify-between items-center sticky top-0 bg-gray-800 z-10">
              <h3 className="text-lg font-bold">Media Details</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <FaTimes className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              {/* Preview */}
              <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden mb-6">
                {selectedMedia.file_url ? (
                  isVideo(selectedMedia.file_type) ? (
                    <video
                      src={selectedMedia.file_url}
                      controls
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <img
                      src={selectedMedia.file_url}
                      alt={selectedMedia.file_name}
                      className="w-full h-full object-contain"
                    />
                  )
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <FaImage className="text-5xl text-gray-600" />
                  </div>
                )}
              </div>

              {/* Details */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-sm text-gray-400">File Name</p>
                  <p className="font-medium">{selectedMedia.file_name || 'Unnamed'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Status</p>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 ${getStatusBadge(selectedMedia.status)}`}>
                    {selectedMedia.status}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-400">File Type</p>
                  <p className="font-medium">{selectedMedia.file_type || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Uploaded By</p>
                  <p className="font-medium">{selectedMedia.user_email || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Upload Date</p>
                  <p className="font-medium">{new Date(selectedMedia.created_at).toLocaleString()}</p>
                </div>
              </div>

              {selectedMedia.rejection_reason && (
                <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 mb-6">
                  <p className="text-sm text-red-400 font-medium mb-1">Rejection Reason</p>
                  <p className="text-gray-300">{selectedMedia.rejection_reason}</p>
                </div>
              )}

              {/* Actions */}
              {selectedMedia.status === 'pending' && (
                <div className="flex gap-4 pt-4 border-t border-gray-700">
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80">
          <div className="bg-gray-800 rounded-2xl w-full max-w-md border border-gray-700">
            <div className="p-6 border-b border-gray-700">
              <h3 className="text-lg font-bold">Reject Media</h3>
            </div>
            <div className="p-6">
              <label className="block text-sm text-gray-400 mb-2">
                Reason for rejection
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white resize-none focus:border-[#D4AF37] focus:outline-none"
                rows={4}
                placeholder="Enter the reason for rejecting this media..."
              />
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowRejectModal(false);
                    setRejectionReason('');
                  }}
                  className="flex-1 px-4 py-3 rounded-lg border border-gray-600 hover:bg-gray-700 transition"
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
