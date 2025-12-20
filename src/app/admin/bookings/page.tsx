"use client";
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { FaCheck, FaTimes, FaEye } from 'react-icons/fa';

interface Booking {
  id: string;
  campaign_name: string;
  billboard_id: string;
  user_id: string;
  user_email?: string;
  start_date: string;
  end_date: string;
  price: number;
  status: string;
  created_at: string;
  rejection_reason?: string;
  billboard?: {
    name: string;
    location: string;
  };
}

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filteredBookings, setFilteredBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentFilter, setCurrentFilter] = useState('all');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    fetchBookings();
  }, []);

  const filterBookings = React.useCallback(() => {
    if (currentFilter === 'all') {
      setFilteredBookings(bookings);
    } else {
      setFilteredBookings(bookings.filter(b => b.status === currentFilter));
    }
  }, [bookings, currentFilter]);

  useEffect(() => {
    filterBookings();
  }, [filterBookings]);

  const fetchBookings = async () => {
    try {
      const { data, error } = await supabase
        .from('billboard_bookings')
        .select(`
          *,
          billboard:billboard_locations(name, location)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching bookings:', error);
        return;
      }

      setBookings(data || []);
      setPendingCount((data || []).filter(b => b.status === 'pending').length);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const { error } = await supabase
        .from('billboard_bookings')
        .update({ status: 'approved' })
        .eq('id', id);

      if (error) throw error;
      
      setBookings(prev => 
        prev.map(b => b.id === id ? { ...b, status: 'approved' } : b)
      );
      setPendingCount(prev => Math.max(0, prev - 1));
      setShowModal(false);
    } catch (error) {
      console.error('Error approving booking:', error);
    }
  };

  const handleReject = async () => {
    if (!selectedBooking) return;

    try {
      const { error } = await supabase
        .from('billboard_bookings')
        .update({ status: 'rejected', rejection_reason: rejectionReason })
        .eq('id', selectedBooking.id);

      if (error) throw error;

      setBookings(prev =>
        prev.map(b => b.id === selectedBooking.id ? { ...b, status: 'rejected', rejection_reason: rejectionReason } : b)
      );
      setPendingCount(prev => Math.max(0, prev - 1));
      setShowRejectModal(false);
      setShowModal(false);
      setRejectionReason('');
    } catch (error) {
      console.error('Error rejecting booking:', error);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GH', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-orange-500/15 text-orange-500',
      approved: 'bg-green-500/15 text-green-500',
      rejected: 'bg-red-500/15 text-red-500',
      active: 'bg-blue-500/15 text-blue-500',
      completed: 'bg-gray-500/15 text-gray-500',
      cancelled: 'bg-gray-500/15 text-gray-500',
    };
    return styles[status] || 'bg-gray-500/15 text-gray-500';
  };

  const filters = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending', count: pendingCount },
    { key: 'approved', label: 'Approved' },
    { key: 'active', label: 'Active' },
    { key: 'completed', label: 'Completed' },
    { key: 'rejected', label: 'Rejected' },
  ];

  return (
    <div className="p-4 lg:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-bold">Bookings</h2>
          <p className="text-gray-400">Manage billboard booking requests</p>
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

      {/* Bookings Table */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead className="bg-gray-700/50">
              <tr>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-300">Campaign</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-300">Billboard</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-300">User</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-300">Dates</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-300">Price</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-300">Status</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-400">
                    Loading...
                  </td>
                </tr>
              ) : filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-400">
                    No bookings found
                  </td>
                </tr>
              ) : (
                filteredBookings.map((booking) => (
                  <tr key={booking.id} className="hover:bg-gray-700/30 transition">
                    <td className="px-6 py-4">
                      <p className="font-medium">{booking.campaign_name || 'Unnamed'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm">{booking.billboard?.name || 'N/A'}</p>
                      <p className="text-xs text-gray-500">{booking.billboard?.location || ''}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm">{booking.user_email || 'N/A'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm">{formatDate(booking.start_date)}</p>
                      <p className="text-xs text-gray-500">to {formatDate(booking.end_date)}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-semibold text-[#D4AF37]">
                        GHS {formatCurrency(booking.price || 0)}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 ${getStatusBadge(booking.status)}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                        {booking.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedBooking(booking);
                            setShowModal(true);
                          }}
                          className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition"
                          title="View Details"
                        >
                          <FaEye className="w-4 h-4" />
                        </button>
                        {booking.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleApprove(booking.id)}
                              className="p-2 rounded-lg bg-green-500/20 text-green-500 hover:bg-green-500/30 transition"
                              title="Approve"
                            >
                              <FaCheck className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedBooking(booking);
                                setShowRejectModal(true);
                              }}
                              className="p-2 rounded-lg bg-red-500/20 text-red-500 hover:bg-red-500/30 transition"
                              title="Reject"
                            >
                              <FaTimes className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Booking Detail Modal */}
      {showModal && selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="bg-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-auto border border-gray-700">
            <div className="p-6 border-b border-gray-700 flex justify-between items-center sticky top-0 bg-gray-800">
              <h3 className="text-lg font-bold">Booking Details</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <FaTimes className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-400">Campaign Name</p>
                  <p className="font-medium">{selectedBooking.campaign_name || 'Unnamed'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Status</p>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 ${getStatusBadge(selectedBooking.status)}`}>
                    {selectedBooking.status}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Billboard</p>
                  <p className="font-medium">{selectedBooking.billboard?.name || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Location</p>
                  <p className="font-medium">{selectedBooking.billboard?.location || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Start Date</p>
                  <p className="font-medium">{formatDate(selectedBooking.start_date)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">End Date</p>
                  <p className="font-medium">{formatDate(selectedBooking.end_date)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Price</p>
                  <p className="font-bold text-[#D4AF37]">GHS {formatCurrency(selectedBooking.price || 0)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">User Email</p>
                  <p className="font-medium">{selectedBooking.user_email || 'N/A'}</p>
                </div>
              </div>

              {selectedBooking.rejection_reason && (
                <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                  <p className="text-sm text-red-400 font-medium mb-1">Rejection Reason</p>
                  <p className="text-gray-300">{selectedBooking.rejection_reason}</p>
                </div>
              )}

              {selectedBooking.status === 'pending' && (
                <div className="flex gap-4 pt-4 border-t border-gray-700">
                  <button
                    onClick={() => handleApprove(selectedBooking.id)}
                    className="flex-1 py-3 rounded-lg bg-green-600 hover:bg-green-700 transition font-semibold"
                  >
                    Approve Booking
                  </button>
                  <button
                    onClick={() => setShowRejectModal(true)}
                    className="flex-1 py-3 rounded-lg bg-red-600 hover:bg-red-700 transition font-semibold"
                  >
                    Reject Booking
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Rejection Reason Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80">
          <div className="bg-gray-800 rounded-2xl w-full max-w-md border border-gray-700">
            <div className="p-6 border-b border-gray-700">
              <h3 className="text-lg font-bold">Reject Booking</h3>
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
                placeholder="Enter the reason for rejecting this booking..."
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
