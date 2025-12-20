"use client";
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { FaClock, FaPlay, FaDollarSign, FaMapMarkerAlt, FaChartLine } from 'react-icons/fa';

interface Stats {
  pending: number;
  active: number;
  revenue: number;
  locations: number;
  available: number;
}

interface Booking {
  id: string;
  campaign_name: string;
  status: string;
  price: number;
  created_at: string;
  user_email?: string;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats>({ pending: 0, active: 0, revenue: 0, locations: 0, available: 0 });
  const [pendingBookings, setPendingBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch stats - these would come from your actual tables
      // For now we'll use placeholder data since the billboard tables might not exist yet
      
      // Try to fetch from billboard_bookings if it exists
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('billboard_bookings')
        .select('*');

      if (!bookingsError && bookingsData) {
        const pending = bookingsData.filter(b => b.status === 'pending').length;
        const active = bookingsData.filter(b => b.status === 'active').length;
        const revenue = bookingsData
          .filter(b => b.status === 'approved' || b.status === 'active' || b.status === 'completed')
          .reduce((sum, b) => sum + (b.price || 0), 0);

        setStats(prev => ({ ...prev, pending, active, revenue }));
        setPendingBookings(bookingsData.filter(b => b.status === 'pending').slice(0, 5));
      }

      // Try to fetch locations
      const { data: locationsData, error: locationsError } = await supabase
        .from('billboard_locations')
        .select('*');

      if (!locationsError && locationsData) {
        const total = locationsData.length;
        const available = locationsData.filter(l => l.status === 'available').length;
        setStats(prev => ({ ...prev, locations: total, available }));
      }

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = () => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GH', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-orange-500/15 text-orange-500',
      approved: 'bg-green-500/15 text-green-500',
      rejected: 'bg-red-500/15 text-red-500',
      active: 'bg-blue-500/15 text-blue-500',
      completed: 'bg-gray-500/15 text-gray-500',
    };
    return styles[status] || 'bg-gray-500/15 text-gray-500';
  };

  return (
    <div className="p-4 lg:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-bold">Dashboard</h2>
          <p className="text-gray-400">Overview of billboard operations</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm text-gray-400">Today</p>
            <p className="font-semibold text-sm md:text-base">{formatDate()}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#D4AF37] flex items-center justify-center text-black font-bold">
            A
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8">
        {/* Pending Bookings */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-400 text-sm">Pending Bookings</p>
              <p className="text-3xl font-bold mt-2">
                {isLoading ? '-' : stats.pending}
              </p>
            </div>
            <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center">
              <FaClock className="w-6 h-6 text-orange-500" />
            </div>
          </div>
          <p className="text-orange-500 text-sm mt-4">Requires review</p>
        </div>

        {/* Active Campaigns */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-400 text-sm">Active Campaigns</p>
              <p className="text-3xl font-bold mt-2">
                {isLoading ? '-' : stats.active}
              </p>
            </div>
            <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
              <FaPlay className="w-6 h-6 text-blue-500" />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            <p className="text-green-500 text-sm">Live now</p>
          </div>
        </div>

        {/* Total Revenue */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-400 text-sm">Total Revenue</p>
              <p className="text-3xl font-bold mt-2">
                GHS {isLoading ? '-' : formatCurrency(stats.revenue)}
              </p>
            </div>
            <div className="w-12 h-12 rounded-full bg-[#D4AF37]/20 flex items-center justify-center">
              <FaDollarSign className="w-6 h-6 text-[#D4AF37]" />
            </div>
          </div>
          <p className="text-gray-400 text-sm mt-4">This month</p>
        </div>

        {/* Billboard Locations */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-400 text-sm">Billboard Locations</p>
              <p className="text-3xl font-bold mt-2">
                {isLoading ? '-' : stats.locations}
              </p>
            </div>
            <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center">
              <FaMapMarkerAlt className="w-6 h-6 text-purple-500" />
            </div>
          </div>
          <p className="text-green-500 text-sm mt-4">
            {isLoading ? '-' : stats.available} available
          </p>
        </div>
      </div>

      {/* Recent Bookings & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Bookings */}
        <div className="bg-gray-800 rounded-xl border border-gray-700">
          <div className="p-6 border-b border-gray-700 flex justify-between items-center">
            <h3 className="font-semibold">Pending Bookings</h3>
            <Link href="/admin/bookings" className="text-sm text-[#D4AF37] hover:underline">
              View all
            </Link>
          </div>
          <div className="divide-y divide-gray-700">
            {isLoading ? (
              <div className="p-6 text-center text-gray-400">Loading...</div>
            ) : pendingBookings.length === 0 ? (
              <div className="p-6 text-center text-gray-400">No pending bookings</div>
            ) : (
              pendingBookings.map((booking) => (
                <div key={booking.id} className="p-4 hover:bg-gray-700/50 transition">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">{booking.campaign_name || 'Unnamed Campaign'}</p>
                      <p className="text-sm text-gray-400">{booking.user_email || 'No email'}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadge(booking.status)}`}>
                      {booking.status}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-2 text-sm">
                    <span className="text-gray-400">
                      {new Date(booking.created_at).toLocaleDateString()}
                    </span>
                    <span className="font-semibold text-[#D4AF37]">
                      GHS {formatCurrency(booking.price || 0)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-gray-800 rounded-xl border border-gray-700">
          <div className="p-6 border-b border-gray-700">
            <h3 className="font-semibold">Recent Activity</h3>
          </div>
          <div className="divide-y divide-gray-700">
            {isLoading ? (
              <div className="p-6 text-center text-gray-400">Loading...</div>
            ) : (
              <div className="p-6 text-center text-gray-400">
                <FaChartLine className="mx-auto text-3xl mb-3 opacity-50" />
                <p>Activity tracking coming soon</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
