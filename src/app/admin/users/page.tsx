"use client";
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { FaSearch, FaUser, FaTimes, FaEnvelope, FaCalendar, FaChartBar } from 'react-icons/fa';

interface UserStats {
  bookings: number;
  spent: number;
  media: number;
}

interface User {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  created_at: string;
  stats: UserStats;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [stats, setStats] = useState({ total: 0, active: 0, totalBookings: 0, totalRevenue: 0 });

  const filterUsers = React.useCallback(() => {
    if (!searchQuery.trim()) {
      setFilteredUsers(users);
      return;
    }
    const query = searchQuery.toLowerCase();
    setFilteredUsers(users.filter(u => 
      u.email?.toLowerCase().includes(query) ||
      u.full_name?.toLowerCase().includes(query)
    ));
  }, [users, searchQuery]);

  const calculateStats = React.useCallback(() => {
    setStats({
      total: users.length,
      active: users.filter(u => u.stats.bookings > 0).length,
      totalBookings: users.reduce((sum, u) => sum + u.stats.bookings, 0),
      totalRevenue: users.reduce((sum, u) => sum + u.stats.spent, 0),
    });
  }, [users]);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [filterUsers]);

  useEffect(() => {
    calculateStats();
  }, [calculateStats]);

  const fetchUsers = async () => {
    try {
      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        return;
      }

      // Fetch booking stats per user
      const { data: bookings } = await supabase
        .from('billboard_bookings')
        .select('user_id, price, status');

      // Fetch media counts per user
      const { data: mediaItems } = await supabase
        .from('billboard_media')
        .select('user_id');

      // Aggregate stats
      const userStatsMap: Record<string, UserStats> = {};

      bookings?.forEach((b: { user_id: string; price: number; status: string }) => {
        if (!userStatsMap[b.user_id]) {
          userStatsMap[b.user_id] = { bookings: 0, spent: 0, media: 0 };
        }
        userStatsMap[b.user_id].bookings++;
        if (['approved', 'active', 'completed'].includes(b.status)) {
          userStatsMap[b.user_id].spent += b.price || 0;
        }
      });

      mediaItems?.forEach((m: { user_id: string }) => {
        if (!userStatsMap[m.user_id]) {
          userStatsMap[m.user_id] = { bookings: 0, spent: 0, media: 0 };
        }
        userStatsMap[m.user_id].media++;
      });

      const usersWithStats = profiles?.map((p: { id: string; email: string; full_name?: string; avatar_url?: string; created_at: string }) => ({
        ...p,
        stats: userStatsMap[p.id] || { bookings: 0, spent: 0, media: 0 }
      })) || [];

      setUsers(usersWithStats);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GH', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const viewUserDetails = (user: User) => {
    setSelectedUser(user);
    setShowModal(true);
  };

  return (
    <div className="p-4 lg:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-bold">Users</h2>
          <p className="text-white/40">Billboard advertisers and their activity</p>
        </div>
        
        {/* Search */}
        <div className="relative w-full md:w-64">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <FaSearch className="text-white/30" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search users..."
            className="w-full bg-white/[0.02] border border-white/[0.06] rounded-lg pl-10 pr-4 py-2 text-white focus:border-[#D4AF37]/50 focus:outline-none placeholder:text-white/30"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white/[0.02] rounded-xl p-4 border border-white/[0.04]">
          <p className="text-white/40 text-sm">Total Users</p>
          <p className="text-2xl font-bold mt-1">{isLoading ? '-' : stats.total}</p>
        </div>
        <div className="bg-white/[0.02] rounded-xl p-4 border border-white/[0.04]">
          <p className="text-white/40 text-sm">Active Advertisers</p>
          <p className="text-2xl font-bold mt-1 text-green-500">{isLoading ? '-' : stats.active}</p>
        </div>
        <div className="bg-white/[0.02] rounded-xl p-4 border border-white/[0.04]">
          <p className="text-white/40 text-sm">Total Bookings</p>
          <p className="text-2xl font-bold mt-1 text-blue-500">{isLoading ? '-' : stats.totalBookings}</p>
        </div>
        <div className="bg-white/[0.02] rounded-xl p-4 border border-white/[0.04]">
          <p className="text-white/40 text-sm">Total Revenue</p>
          <p className="text-2xl font-bold mt-1 text-[#D4AF37]">GHS {isLoading ? '-' : formatCurrency(stats.totalRevenue)}</p>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white/[0.02] rounded-xl border border-white/[0.04] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-white/[0.02]">
              <tr>
                <th className="text-left px-4 md:px-6 py-4 text-sm font-semibold text-white/50">User</th>
                <th className="text-left px-4 md:px-6 py-4 text-sm font-semibold text-white/50 hidden md:table-cell">Joined</th>
                <th className="text-left px-4 md:px-6 py-4 text-sm font-semibold text-white/50">Bookings</th>
                <th className="text-left px-4 md:px-6 py-4 text-sm font-semibold text-white/50 hidden sm:table-cell">Media</th>
                <th className="text-left px-4 md:px-6 py-4 text-sm font-semibold text-white/50 hidden lg:table-cell">Total Spent</th>
                <th className="text-left px-4 md:px-6 py-4 text-sm font-semibold text-white/50">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-white/40">
                    <div className="flex items-center justify-center gap-3">
                      <div className="w-5 h-5 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin"></div>
                      Loading users...
                    </div>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-white/40">
                    No users found
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-white/[0.02] transition">
                    <td className="px-4 md:px-6 py-4">
                      <div className="flex items-center gap-3">
                        {user.avatar_url ? (
                          <img
                            src={user.avatar_url}
                            alt={user.full_name || 'User'}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-white/[0.04] flex items-center justify-center">
                            <FaUser className="text-white/40" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-medium truncate">{user.full_name || 'Unknown'}</p>
                          <p className="text-sm text-white/40 truncate">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-4 text-white/40 hidden md:table-cell">
                      {formatDate(user.created_at)}
                    </td>
                    <td className="px-4 md:px-6 py-4">
                      <span className="px-2 py-1 bg-blue-500/15 text-blue-500 rounded-full text-sm">
                        {user.stats.bookings}
                      </span>
                    </td>
                    <td className="px-4 md:px-6 py-4 hidden sm:table-cell">
                      <span className="px-2 py-1 bg-purple-500/15 text-purple-500 rounded-full text-sm">
                        {user.stats.media}
                      </span>
                    </td>
                    <td className="px-4 md:px-6 py-4 text-[#D4AF37] font-medium hidden lg:table-cell">
                      GHS {formatCurrency(user.stats.spent)}
                    </td>
                    <td className="px-4 md:px-6 py-4">
                      <button
                        onClick={() => viewUserDetails(user)}
                        className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] transition"
                        title="View Details"
                      >
                        <FaChartBar className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Detail Modal */}
      {showModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-black rounded-2xl w-full max-w-lg border border-white/[0.06] max-h-[90vh] overflow-auto">
            {/* Header */}
            <div className="p-6 border-b border-white/[0.06] flex justify-between items-center sticky top-0 bg-black">
              <h3 className="text-lg font-bold">User Details</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-white/40 hover:text-white transition"
              >
                <FaTimes className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* User Profile */}
              <div className="flex items-center gap-4">
                {selectedUser.avatar_url ? (
                  <img
                    src={selectedUser.avatar_url}
                    alt={selectedUser.full_name || 'User'}
                    className="w-16 h-16 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-white/[0.04] flex items-center justify-center">
                    <FaUser className="text-2xl text-white/40" />
                  </div>
                )}
                <div>
                  <h4 className="text-xl font-bold">{selectedUser.full_name || 'Unknown'}</h4>
                  <p className="text-white/40 flex items-center gap-2 mt-1">
                    <FaEnvelope className="text-sm" />
                    {selectedUser.email}
                  </p>
                </div>
              </div>

              {/* Joined Date */}
              <div className="flex items-center gap-3 text-white/40">
                <FaCalendar />
                <span>Joined {formatDate(selectedUser.created_at)}</span>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white/[0.02] rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-blue-500">{selectedUser.stats.bookings}</p>
                  <p className="text-sm text-white/40">Bookings</p>
                </div>
                <div className="bg-white/[0.02] rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-purple-500">{selectedUser.stats.media}</p>
                  <p className="text-sm text-white/40">Media</p>
                </div>
                <div className="bg-white/[0.02] rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-[#D4AF37]">GHS {formatCurrency(selectedUser.stats.spent)}</p>
                  <p className="text-sm text-white/40">Spent</p>
                </div>
              </div>

              {/* User ID */}
              <div className="p-4 bg-white/[0.02] rounded-xl">
                <p className="text-sm text-white/40">User ID</p>
                <p className="text-sm font-mono mt-1 break-all">{selectedUser.id}</p>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-white/[0.06]">
              <button
                onClick={() => setShowModal(false)}
                className="w-full py-3 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] transition font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
