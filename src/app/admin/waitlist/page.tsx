"use client";
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { 
  FaUsers, FaEnvelope, FaPhone, FaCalendarAlt, FaSearch, 
  FaTrash, FaCheck, FaChartLine, FaArrowUp, FaArrowDown 
} from 'react-icons/fa';

interface WaitlistEntry {
  id: string;
  email: string;
  full_name?: string;
  phone_number?: string;
  interests?: string[];
  status: 'pending' | 'confirmed' | 'joined';
  created_at: string;
  updated_at?: string;
}

interface ChartData {
  label: string;
  value: number;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  pending: { label: 'Pending', color: 'text-amber-400', bg: 'bg-amber-500/10', dot: 'bg-amber-400' },
  confirmed: { label: 'Confirmed', color: 'text-emerald-400', bg: 'bg-emerald-500/10', dot: 'bg-emerald-400' },
  joined: { label: 'Joined', color: 'text-blue-400', bg: 'bg-blue-500/10', dot: 'bg-blue-400' },
};

export default function AdminWaitlistPage() {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [chartPeriod, setChartPeriod] = useState<'day' | 'week' | 'month'>('week');
  const [chartData, setChartData] = useState<ChartData[]>([]);

  // Stats calculations
  const stats = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const todayCount = entries.filter(e => new Date(e.created_at) >= today).length;
    const weekCount = entries.filter(e => new Date(e.created_at) >= weekAgo).length;
    const monthCount = entries.filter(e => new Date(e.created_at) >= monthAgo).length;
    
    // Calculate trend (compare this week to last week)
    const lastWeekStart = new Date(weekAgo.getTime() - 7 * 24 * 60 * 60 * 1000);
    const lastWeekCount = entries.filter(e => {
      const date = new Date(e.created_at);
      return date >= lastWeekStart && date < weekAgo;
    }).length;
    const trend = lastWeekCount > 0 ? ((weekCount - lastWeekCount) / lastWeekCount) * 100 : 100;

    return {
      total: entries.length,
      pending: entries.filter(e => e.status === 'pending').length,
      confirmed: entries.filter(e => e.status === 'confirmed').length,
      joined: entries.filter(e => e.status === 'joined').length,
      todayCount,
      weekCount,
      monthCount,
      trend: Math.round(trend),
    };
  }, [entries]);

  // Generate chart data based on period
  const generateChartData = useCallback(() => {
    const now = new Date();
    const data: ChartData[] = [];

    if (chartPeriod === 'day') {
      // Last 24 hours by hour
      for (let i = 23; i >= 0; i--) {
        const hourStart = new Date(now.getTime() - i * 60 * 60 * 1000);
        const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);
        const count = entries.filter(e => {
          const date = new Date(e.created_at);
          return date >= hourStart && date < hourEnd;
        }).length;
        data.push({ 
          label: hourStart.toLocaleTimeString('en-US', { hour: 'numeric' }), 
          value: count 
        });
      }
    } else if (chartPeriod === 'week') {
      // Last 7 days
      for (let i = 6; i >= 0; i--) {
        const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
        const count = entries.filter(e => {
          const date = new Date(e.created_at);
          return date >= dayStart && date < dayEnd;
        }).length;
        data.push({ 
          label: dayStart.toLocaleDateString('en-US', { weekday: 'short' }), 
          value: count 
        });
      }
    } else {
      // Last 30 days grouped by week
      for (let i = 3; i >= 0; i--) {
        const weekStart = new Date(now.getTime() - (i + 1) * 7 * 24 * 60 * 60 * 1000);
        const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
        const count = entries.filter(e => {
          const date = new Date(e.created_at);
          return date >= weekStart && date < weekEnd;
        }).length;
        data.push({ 
          label: `Week ${4 - i}`, 
          value: count 
        });
      }
    }

    setChartData(data);
  }, [entries, chartPeriod]);

  useEffect(() => {
    generateChartData();
  }, [generateChartData]);

  // Filtered entries
  const filtered = useMemo(() => {
    let list = entries;
    if (filter !== 'all') list = list.filter(e => e.status === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(e =>
        e.email?.toLowerCase().includes(q) ||
        e.full_name?.toLowerCase().includes(q) ||
        e.phone_number?.includes(q)
      );
    }
    return list;
  }, [entries, filter, search]);

  // Fetch waitlist data
  const fetchWaitlist = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('waitlist')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error) setEntries(data || []);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWaitlist();

    // Real-time subscription
    const channel = supabase
      .channel('waitlist-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'waitlist' }, () => {
        fetchWaitlist();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchWaitlist]);

  // Update status
  const updateStatus = async (id: string, status: WaitlistEntry['status']) => {
    const { error } = await supabase
      .from('waitlist')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (!error) {
      setEntries(prev => prev.map(e => e.id === id ? { ...e, status } : e));
    }
  };

  // Bulk update
  const bulkUpdateStatus = async (status: WaitlistEntry['status']) => {
    if (selectedEntries.size === 0) return;
    
    const ids = Array.from(selectedEntries);
    const { error } = await supabase
      .from('waitlist')
      .update({ status, updated_at: new Date().toISOString() })
      .in('id', ids);

    if (!error) {
      setEntries(prev => prev.map(e => 
        selectedEntries.has(e.id) ? { ...e, status } : e
      ));
      setSelectedEntries(new Set());
    }
  };

  // Delete entry
  const deleteEntry = async (id: string) => {
    if (!confirm('Delete this entry?')) return;
    
    const { error } = await supabase.from('waitlist').delete().eq('id', id);
    if (!error) {
      setEntries(prev => prev.filter(e => e.id !== id));
    }
  };

  // Bulk delete
  const bulkDelete = async () => {
    if (selectedEntries.size === 0 || !confirm(`Delete ${selectedEntries.size} entries?`)) return;
    
    const ids = Array.from(selectedEntries);
    const { error } = await supabase.from('waitlist').delete().in('id', ids);
    if (!error) {
      setEntries(prev => prev.filter(e => !selectedEntries.has(e.id)));
      setSelectedEntries(new Set());
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedEntries);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedEntries(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedEntries.size === filtered.length) {
      setSelectedEntries(new Set());
    } else {
      setSelectedEntries(new Set(filtered.map(e => e.id)));
    }
  };

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-US', { 
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' 
  });

  const maxChartValue = Math.max(...chartData.map(d => d.value), 1);

  const filters = [
    { key: 'all', label: 'All', count: stats.total },
    { key: 'pending', label: 'Pending', count: stats.pending },
    { key: 'confirmed', label: 'Confirmed', count: stats.confirmed },
    { key: 'joined', label: 'Joined', count: stats.joined },
  ];

  return (
    <div className="p-4 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-semibold">Waitlist</h1>
          <p className="text-sm text-white/50 mt-1">Manage waitlist signups and track growth</p>
        </div>
        <div className="relative w-full lg:w-80">
          <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            type="text"
            placeholder="Search by name, email, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm placeholder-white/30 focus:border-[#D4AF37]/50 focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          icon={FaUsers} 
          label="Total Signups" 
          value={stats.total} 
          color="white"
          trend={stats.trend}
        />
        <StatCard 
          icon={FaCalendarAlt} 
          label="Today" 
          value={stats.todayCount} 
          color="emerald"
        />
        <StatCard 
          icon={FaChartLine} 
          label="This Week" 
          value={stats.weekCount} 
          color="blue"
        />
        <StatCard 
          icon={FaEnvelope} 
          label="This Month" 
          value={stats.monthCount} 
          color="gold"
        />
      </div>

      {/* Chart Section */}
      <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-medium">Signup Trend</h3>
          <div className="flex gap-1 bg-white/5 rounded-lg p-1">
            {(['day', 'week', 'month'] as const).map(period => (
              <button
                key={period}
                onClick={() => setChartPeriod(period)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  chartPeriod === period ? 'bg-[#D4AF37] text-black' : 'text-white/50 hover:text-white'
                }`}
              >
                {period.charAt(0).toUpperCase() + period.slice(1)}
              </button>
            ))}
          </div>
        </div>
        
        {/* Animated Bar Chart */}
        <div className="flex items-end gap-2 h-40">
          {chartData.map((item, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-2">
              <div className="w-full bg-white/5 rounded-t-lg relative overflow-hidden" style={{ height: '120px' }}>
                <div 
                  className="absolute bottom-0 w-full bg-gradient-to-t from-[#D4AF37] to-[#D4AF37]/60 rounded-t-lg transition-all duration-700 ease-out"
                  style={{ 
                    height: `${(item.value / maxChartValue) * 100}%`,
                    animationDelay: `${i * 100}ms`
                  }}
                >
                  {item.value > 0 && (
                    <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-semibold text-[#D4AF37]">
                      {item.value}
                    </span>
                  )}
                </div>
              </div>
              <span className="text-[10px] text-white/40">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Filters & Bulk Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                filter === f.key ? 'bg-[#D4AF37] text-black' : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
              }`}
            >
              {f.label}
              {f.count > 0 && (
                <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${filter === f.key ? 'bg-black/20' : 'bg-white/10'}`}>
                  {f.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {selectedEntries.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-white/50">{selectedEntries.size} selected</span>
            <button
              onClick={() => bulkUpdateStatus('confirmed')}
              className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 text-xs font-medium"
            >
              Confirm All
            </button>
            <button
              onClick={bulkDelete}
              className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 text-xs font-medium"
            >
              Delete All
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-5 py-4 w-12">
                  <input
                    type="checkbox"
                    checked={selectedEntries.size === filtered.length && filtered.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-white/20 bg-white/5 text-[#D4AF37] focus:ring-[#D4AF37]/50"
                  />
                </th>
                {['Name', 'Email', 'Phone', 'Status', 'Joined', 'Actions'].map(h => (
                  <th key={h} className="text-left px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}><td colSpan={7} className="px-5 py-4"><div className="h-10 bg-white/5 rounded animate-pulse" /></td></tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-16 text-center text-white/40">No entries found</td></tr>
              ) : filtered.map((entry) => (
                <tr key={entry.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-4">
                    <input
                      type="checkbox"
                      checked={selectedEntries.has(entry.id)}
                      onChange={() => toggleSelect(entry.id)}
                      className="w-4 h-4 rounded border-white/20 bg-white/5 text-[#D4AF37] focus:ring-[#D4AF37]/50"
                    />
                  </td>
                  <td className="px-5 py-4">
                    <p className="font-medium text-sm">{entry.full_name || 'N/A'}</p>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <FaEnvelope className="w-3 h-3 text-white/30" />
                      <span className="text-sm">{entry.email}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    {entry.phone_number ? (
                      <div className="flex items-center gap-2">
                        <FaPhone className="w-3 h-3 text-white/30" />
                        <span className="text-sm">{entry.phone_number}</span>
                      </div>
                    ) : (
                      <span className="text-white/30 text-sm">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_CONFIG[entry.status]?.bg} ${STATUS_CONFIG[entry.status]?.color}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_CONFIG[entry.status]?.dot}`} />
                      {STATUS_CONFIG[entry.status]?.label || entry.status}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-sm text-white/50">{fmtDate(entry.created_at)}</span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1">
                      {entry.status === 'pending' && (
                        <button
                          onClick={() => updateStatus(entry.id, 'confirmed')}
                          className="p-2 rounded-lg hover:bg-emerald-500/20 text-emerald-400 transition-colors"
                          title="Confirm"
                        >
                          <FaCheck className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {entry.status === 'confirmed' && (
                        <button
                          onClick={() => updateStatus(entry.id, 'joined')}
                          className="p-2 rounded-lg hover:bg-blue-500/20 text-blue-400 transition-colors"
                          title="Mark as Joined"
                        >
                          <FaUsers className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => deleteEntry(entry.id)}
                        className="p-2 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors"
                        title="Delete"
                      >
                        <FaTrash className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-white/5 text-sm text-white/40">
            Showing {filtered.length} of {entries.length}
          </div>
        )}
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({ icon: Icon, label, value, color, trend }: { 
  icon: React.ElementType; 
  label: string; 
  value: number; 
  color: string;
  trend?: number;
}) {
  const colors: Record<string, { bg: string; text: string }> = {
    white: { bg: 'bg-white/5', text: 'text-white' },
    emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
    blue: { bg: 'bg-blue-500/10', text: 'text-blue-400' },
    gold: { bg: 'bg-[#D4AF37]/10', text: 'text-[#D4AF37]' },
  };

  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-white/40">{label}</span>
        <div className={`w-9 h-9 rounded-lg ${colors[color]?.bg} flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${colors[color]?.text}`} />
        </div>
      </div>
      <div className="flex items-end justify-between">
        <p className="text-2xl font-semibold">{value}</p>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-xs font-medium ${trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {trend >= 0 ? <FaArrowUp className="w-3 h-3" /> : <FaArrowDown className="w-3 h-3" />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
    </div>
  );
}
