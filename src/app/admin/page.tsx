"use client";
import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { 
  FaClock, 
  FaPlay, 
  FaDollarSign, 
  FaMapMarkerAlt, 
  FaArrowRight,
  FaChartLine,
  FaCalendarAlt,
  FaEye
} from 'react-icons/fa';

interface Stats {
  pending: number;
  active: number;
  revenue: number;
  locations: number;
  available: number;
  totalBookings: number;
}

interface Booking {
  id: string;
  campaign_name: string;
  status: string;
  price: number;
  created_at: string;
  user_email?: string;
  billboard_locations?: {
    name: string;
  };
}

interface Location {
  id: string;
  name: string;
  location: string;
  status: string;
  daily_rate: number;
  image_url?: string;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats>({ 
    pending: 0, active: 0, revenue: 0, locations: 0, available: 0, totalBookings: 0 
  });
  const [recentBookings, setRecentBookings] = useState<Booking[]>([]);
  const [topLocations, setTopLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [greeting, setGreeting] = useState('');

  const getGreeting = useCallback(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  useEffect(() => {
    setGreeting(getGreeting());
    fetchDashboardData();
  }, [getGreeting]);

  const fetchDashboardData = async () => {
    try {
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('billboard_bookings')
        .select('*, billboard_locations(name)')
        .order('created_at', { ascending: false });

      if (!bookingsError && bookingsData) {
        const pending = bookingsData.filter(b => b.status === 'pending').length;
        const active = bookingsData.filter(b => b.status === 'active').length;
        const revenue = bookingsData
          .filter(b => ['approved', 'active', 'completed'].includes(b.status))
          .reduce((sum, b) => sum + (b.price || 0), 0);

        setStats(prev => ({ ...prev, pending, active, revenue, totalBookings: bookingsData.length }));
        setRecentBookings(bookingsData.slice(0, 5));
      }

      const { data: locationsData, error: locationsError } = await supabase
        .from('billboard_locations')
        .select('*')
        .order('daily_rate', { ascending: false })
        .limit(4);

      if (!locationsError && locationsData) {
        const { count: totalCount } = await supabase
          .from('billboard_locations')
          .select('*', { count: 'exact', head: true });
        
        const { count: availableCount } = await supabase
          .from('billboard_locations')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'available');

        setStats(prev => ({ ...prev, locations: totalCount || 0, available: availableCount || 0 }));
        setTopLocations(locationsData);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GH').format(amount);
  };

  const getStatusConfig = (status: string) => {
    const config: Record<string, { bg: string; text: string; dot: string }> = {
      pending: { bg: 'bg-amber-500/10', text: 'text-amber-400', dot: 'bg-amber-400' },
      approved: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400' },
      active: { bg: 'bg-blue-500/10', text: 'text-blue-400', dot: 'bg-blue-400' },
      completed: { bg: 'bg-gray-500/10', text: 'text-gray-400', dot: 'bg-gray-400' },
      rejected: { bg: 'bg-red-500/10', text: 'text-red-400', dot: 'bg-red-400' },
    };
    return config[status] || config.pending;
  };

  const StatCard = ({ label, value, icon: Icon, iconBg, iconColor, subtitle, subtitleColor = 'text-white/35' }: {
    label: string;
    value: string | number;
    icon: React.ElementType;
    iconBg: string;
    iconColor: string;
    subtitle?: string;
    subtitleColor?: string;
  }) => (
    <div className="group bg-white/[0.02] rounded-2xl p-5 border border-white/[0.04] hover:border-white/[0.08] transition-all duration-300">
      <div className="flex items-start justify-between">
        <div className="space-y-3">
          <p className="text-sm text-white/40">{label}</p>
          <p className="text-2xl lg:text-3xl font-semibold tracking-tight">
            {isLoading ? <span className="inline-block w-16 h-8 bg-white/5 rounded animate-pulse" /> : value}
          </p>
          {subtitle && <p className={`text-xs ${subtitleColor}`}>{subtitle}</p>}
        </div>
        <div className={`w-11 h-11 rounded-xl ${iconBg} flex items-center justify-center transition-transform duration-300 group-hover:scale-110`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-4 lg:p-8 space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <p className="text-white/40 text-sm">{greeting}</p>
          <h1 className="text-2xl lg:text-3xl font-semibold mt-1">Dashboard Overview</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-white/[0.02] rounded-xl border border-white/[0.04]">
            <FaCalendarAlt className="w-4 h-4 text-white/35" />
            <span className="text-sm text-white/50">
              {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Pending Review" value={stats.pending} icon={FaClock} iconBg="bg-amber-500/10" iconColor="text-amber-400" subtitle="Awaiting approval" subtitleColor="text-amber-400/70" />
        <StatCard label="Active Campaigns" value={stats.active} icon={FaPlay} iconBg="bg-blue-500/10" iconColor="text-blue-400" subtitle="Currently running" subtitleColor="text-blue-400/70" />
        <StatCard label="Total Revenue" value={`GHS ${formatCurrency(stats.revenue)}`} icon={FaDollarSign} iconBg="bg-emerald-500/10" iconColor="text-emerald-400" subtitle="All time earnings" subtitleColor="text-emerald-400/70" />
        <StatCard label="Locations" value={stats.locations} icon={FaMapMarkerAlt} iconBg="bg-purple-500/10" iconColor="text-purple-400" subtitle={`${stats.available} available`} subtitleColor="text-purple-400/70" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white/[0.02] rounded-2xl border border-white/[0.04] overflow-hidden">
          <div className="p-5 border-b border-white/[0.04] flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Recent Bookings</h2>
              <p className="text-xs text-white/40 mt-0.5">Latest booking requests</p>
            </div>
            <Link href="/admin/bookings" className="flex items-center gap-2 text-sm text-[#D4AF37] hover:text-[#D4AF37]/80 transition-colors">
              View all <FaArrowRight className="w-3 h-3" />
            </Link>
          </div>
          
          <div className="divide-y divide-white/[0.04]">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="p-4 animate-pulse">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-white/5" />
                    <div className="flex-1 space-y-2">
                      <div className="w-32 h-4 bg-white/5 rounded" />
                      <div className="w-24 h-3 bg-white/5 rounded" />
                    </div>
                  </div>
                </div>
              ))
            ) : recentBookings.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-16 h-16 mx-auto rounded-full bg-white/5 flex items-center justify-center mb-4">
                  <FaChartLine className="w-6 h-6 text-white/20" />
                </div>
                <p className="text-white/40 text-sm">No bookings yet</p>
              </div>
            ) : (
              recentBookings.map((booking) => {
                const statusConfig = getStatusConfig(booking.status);
                return (
                  <div key={booking.id} className="p-4 hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#D4AF37]/20 to-[#D4AF37]/5 flex items-center justify-center flex-shrink-0">
                        <FaEye className="w-4 h-4 text-[#D4AF37]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{booking.campaign_name || 'Unnamed Campaign'}</p>
                        <p className="text-xs text-white/40 truncate mt-0.5">
                          {booking.billboard_locations?.name || 'No location'} • {formatDate(booking.created_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-sm font-medium text-[#D4AF37] hidden sm:block">GHS {formatCurrency(booking.price || 0)}</span>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.bg} ${statusConfig.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
                          {booking.status}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="bg-white/[0.02] rounded-2xl border border-white/[0.04] overflow-hidden">
          <div className="p-5 border-b border-white/[0.04]">
            <h2 className="font-semibold">Top Locations</h2>
            <p className="text-xs text-white/40 mt-0.5">Highest daily rates</p>
          </div>
          
          <div className="p-3 space-y-2">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="p-3 rounded-xl bg-white/[0.02] animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-white/5" />
                    <div className="flex-1 space-y-2">
                      <div className="w-24 h-4 bg-white/5 rounded" />
                      <div className="w-16 h-3 bg-white/5 rounded" />
                    </div>
                  </div>
                </div>
              ))
            ) : topLocations.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-12 h-12 mx-auto rounded-full bg-white/5 flex items-center justify-center mb-3">
                  <FaMapMarkerAlt className="w-5 h-5 text-white/20" />
                </div>
                <p className="text-white/40 text-sm">No locations yet</p>
              </div>
            ) : (
              topLocations.map((location) => (
                <div key={location.id} className="p-3 rounded-xl hover:bg-white/[0.03] transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    {location.image_url ? (
                      <img src={location.image_url} alt={location.name} className="w-12 h-12 rounded-lg object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500/20 to-purple-500/5 flex items-center justify-center">
                        <FaMapMarkerAlt className="w-4 h-4 text-purple-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{location.name}</p>
                      <p className="text-xs text-white/40 truncate">{location.location}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-[#D4AF37]">GHS {formatCurrency(location.daily_rate)}</p>
                      <p className="text-[10px] text-white/35">per day</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          
          <div className="p-3 border-t border-white/[0.04]">
            <Link href="/admin/locations" className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm text-white/50 hover:text-white hover:bg-white/[0.04] transition-all">
              Manage all locations <FaArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
