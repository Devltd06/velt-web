"use client";
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { 
  FaCalendarAlt, FaMapMarkerAlt, FaTicketAlt, FaUsers, FaSearch, 
  FaDollarSign, FaChevronDown, FaChevronUp, FaEye,
  FaClock, FaUser
} from 'react-icons/fa';

interface Profile {
  id: string;
  full_name?: string;
  username?: string;
  email?: string;
  avatar_url?: string;
}

interface EventTicket {
  id: string;
  event_id: string;
  user_id: string;
  ticket_type?: string;
  price_paid: number;
  status: 'active' | 'used' | 'cancelled' | 'refunded';
  qr_code?: string;
  sold_by?: string;
  purchased_at?: string;
  used_at?: string;
  user?: Profile;
  seller?: Profile;
}

interface Event {
  id: string;
  title: string;
  description?: string;
  place_name: string;
  cover_image?: string;
  start_date: string;
  end_date?: string;
  ticket_price?: number;
  total_tickets?: number;
  tickets_sold?: number;
  is_free?: boolean;
  category?: string;
  created_by: string;
  created_at: string;
  organizer?: Profile;
  tickets?: EventTicket[];
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  active: { label: 'Active', color: 'text-emerald-400', bg: 'bg-emerald-500/10', dot: 'bg-emerald-400' },
  used: { label: 'Used', color: 'text-blue-400', bg: 'bg-blue-500/10', dot: 'bg-blue-400' },
  cancelled: { label: 'Cancelled', color: 'text-red-400', bg: 'bg-red-500/10', dot: 'bg-red-400' },
  refunded: { label: 'Refunded', color: 'text-amber-400', bg: 'bg-amber-500/10', dot: 'bg-amber-400' },
};

const CATEGORY_ICONS: Record<string, string> = {
  music: '🎵',
  sports: '⚽',
  tech: '💻',
  art: '🎨',
  food: '🍔',
  business: '💼',
  education: '📚',
  other: '🎉',
};

export default function AdminEventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past' | 'free' | 'paid'>('all');

  // Stats
  const stats = useMemo(() => {
    const now = new Date();
    const totalRevenue = events.reduce((sum, e) => {
      const ticketRevenue = e.tickets?.reduce((t, ticket) => t + (ticket.price_paid || 0), 0) || 0;
      return sum + ticketRevenue;
    }, 0);
    const totalTicketsSold = events.reduce((sum, e) => sum + (e.tickets_sold || 0), 0);
    const upcomingCount = events.filter(e => new Date(e.start_date) > now).length;
    
    return {
      total: events.length,
      upcoming: upcomingCount,
      past: events.length - upcomingCount,
      totalTicketsSold,
      totalRevenue,
    };
  }, [events]);

  // Filtered events
  const filteredEvents = useMemo(() => {
    const now = new Date();
    let list = events;
    
    if (filter === 'upcoming') list = list.filter(e => new Date(e.start_date) > now);
    else if (filter === 'past') list = list.filter(e => new Date(e.start_date) <= now);
    else if (filter === 'free') list = list.filter(e => e.is_free);
    else if (filter === 'paid') list = list.filter(e => !e.is_free);
    
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(e => 
        e.title?.toLowerCase().includes(q) ||
        e.place_name?.toLowerCase().includes(q) ||
        e.organizer?.full_name?.toLowerCase().includes(q) ||
        e.organizer?.username?.toLowerCase().includes(q)
      );
    }
    
    return list;
  }, [events, filter, search]);

  const fetchEvents = useCallback(async () => {
    try {
      // Fetch events
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .order('start_date', { ascending: false });

      if (eventsError) {
        console.error('Error fetching events:', eventsError);
        return;
      }

      if (!eventsData || eventsData.length === 0) {
        setEvents([]);
        setIsLoading(false);
        return;
      }

      // Get unique creator IDs
      const creatorIds = [...new Set(eventsData.map(e => e.created_by).filter(Boolean))];
      
      // Fetch organizer profiles
      const profilesMap: Record<string, Profile> = {};
      if (creatorIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, username, email, avatar_url')
          .in('id', creatorIds);
        
        profiles?.forEach(p => { profilesMap[p.id] = p; });
      }

      // Fetch all tickets for these events
      const eventIds = eventsData.map(e => e.id);
      const { data: ticketsData } = await supabase
        .from('event_tickets')
        .select('*')
        .in('event_id', eventIds)
        .order('purchased_at', { ascending: false });

      // Get buyer profiles
      const buyerIds = [...new Set((ticketsData || []).map(t => t.user_id).filter(Boolean))];
      const sellerIds = [...new Set((ticketsData || []).map(t => t.sold_by).filter(Boolean))];
      const allUserIds = [...new Set([...buyerIds, ...sellerIds])];
      
      if (allUserIds.length > 0) {
        const { data: userProfiles } = await supabase
          .from('profiles')
          .select('id, full_name, username, email, avatar_url')
          .in('id', allUserIds);
        
        userProfiles?.forEach(p => { profilesMap[p.id] = p; });
      }

      // Map tickets to events
      const ticketsByEvent: Record<string, EventTicket[]> = {};
      (ticketsData || []).forEach(t => {
        if (!ticketsByEvent[t.event_id]) ticketsByEvent[t.event_id] = [];
        ticketsByEvent[t.event_id].push({
          ...t,
          user: profilesMap[t.user_id],
          seller: t.sold_by ? profilesMap[t.sold_by] : undefined,
        });
      });

      // Combine data
      const eventsWithData = eventsData.map(e => ({
        ...e,
        organizer: profilesMap[e.created_by],
        tickets: ticketsByEvent[e.id] || [],
      }));

      setEvents(eventsWithData);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const formatDate = (date: string) => new Date(date).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  const formatCurrency = (amount: number) => `GHS ${new Intl.NumberFormat('en-GH').format(amount)}`;

  const isUpcoming = (date: string) => new Date(date) > new Date();

  const filters = [
    { key: 'all', label: 'All Events', count: stats.total },
    { key: 'upcoming', label: 'Upcoming', count: stats.upcoming },
    { key: 'past', label: 'Past', count: stats.past },
    { key: 'free', label: 'Free', count: events.filter(e => e.is_free).length },
    { key: 'paid', label: 'Paid', count: events.filter(e => !e.is_free).length },
  ];

  return (
    <div className="p-4 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-semibold">Events</h1>
          <p className="text-sm text-white/50 mt-1">Manage events and ticket sales</p>
        </div>
        <div className="relative w-full lg:w-80">
          <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            type="text"
            placeholder="Search events, organizers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm placeholder-white/30 focus:border-[#D4AF37]/50 focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard icon={FaCalendarAlt} label="Total Events" value={stats.total} color="white" />
        <StatCard icon={FaClock} label="Upcoming" value={stats.upcoming} color="blue" />
        <StatCard icon={FaTicketAlt} label="Tickets Sold" value={stats.totalTicketsSold} color="emerald" />
        <StatCard icon={FaDollarSign} label="Revenue" value={formatCurrency(stats.totalRevenue)} color="gold" />
        <StatCard icon={FaUsers} label="Past Events" value={stats.past} color="purple" />
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key as typeof filter)}
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

      {/* Events List */}
      <div className="space-y-4">
        {isLoading ? (
          [...Array(3)].map((_, i) => (
            <div key={i} className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 animate-pulse">
              <div className="flex gap-4">
                <div className="w-24 h-24 bg-white/5 rounded-xl" />
                <div className="flex-1 space-y-3">
                  <div className="h-5 w-1/3 bg-white/5 rounded" />
                  <div className="h-4 w-1/2 bg-white/5 rounded" />
                  <div className="h-4 w-1/4 bg-white/5 rounded" />
                </div>
              </div>
            </div>
          ))
        ) : filteredEvents.length === 0 ? (
          <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-12 text-center">
            <FaCalendarAlt className="w-12 h-12 text-white/10 mx-auto mb-4" />
            <p className="text-white/40">No events found</p>
          </div>
        ) : (
          filteredEvents.map((event) => (
            <div key={event.id} className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden hover:border-white/10 transition-colors">
              {/* Event Header */}
              <div className="p-5">
                <div className="flex gap-4">
                  {/* Cover Image */}
                  <div className="w-24 h-24 lg:w-32 lg:h-32 rounded-xl overflow-hidden flex-shrink-0 bg-white/5">
                    {event.cover_image ? (
                      <img src={event.cover_image} alt={event.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-3xl">
                        {CATEGORY_ICONS[event.category || 'other'] || '🎉'}
                      </div>
                    )}
                  </div>
                  
                  {/* Event Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-lg">{event.title}</h3>
                        <div className="flex items-center gap-2 mt-1 text-sm text-white/50">
                          <FaMapMarkerAlt className="w-3 h-3" />
                          <span>{event.place_name}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {event.is_free ? (
                          <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 rounded-lg text-xs font-medium">Free</span>
                        ) : (
                          <span className="px-2.5 py-1 bg-[#D4AF37]/10 text-[#D4AF37] rounded-lg text-xs font-medium">
                            {formatCurrency(event.ticket_price || 0)}
                          </span>
                        )}
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                          isUpcoming(event.start_date) ? 'bg-blue-500/10 text-blue-400' : 'bg-white/5 text-white/40'
                        }`}>
                          {isUpcoming(event.start_date) ? 'Upcoming' : 'Past'}
                        </span>
                      </div>
                    </div>
                    
                    {/* Date & Stats */}
                    <div className="flex flex-wrap items-center gap-4 mt-3 text-sm">
                      <div className="flex items-center gap-2 text-white/50">
                        <FaCalendarAlt className="w-3 h-3" />
                        <span>{formatDate(event.start_date)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-white/50">
                        <FaTicketAlt className="w-3 h-3" />
                        <span>{event.tickets_sold || 0} / {event.total_tickets || '∞'} sold</span>
                      </div>
                    </div>
                    
                    {/* Organizer */}
                    {event.organizer && (
                      <div className="flex items-center gap-2 mt-3 p-2 bg-white/5 rounded-lg w-fit">
                        {event.organizer.avatar_url ? (
                          <img src={event.organizer.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-[#D4AF37]/20 flex items-center justify-center">
                            <FaUser className="w-3 h-3 text-[#D4AF37]" />
                          </div>
                        )}
                        <span className="text-sm text-white/70">
                          Organized by <span className="text-white font-medium">{event.organizer.full_name || event.organizer.username || 'Unknown'}</span>
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Expand Button */}
                {event.tickets && event.tickets.length > 0 && (
                  <button
                    onClick={() => setExpandedEvent(expandedEvent === event.id ? null : event.id)}
                    className="flex items-center gap-2 mt-4 text-sm text-[#D4AF37] hover:text-[#D4AF37]/80 transition-colors"
                  >
                    <FaEye className="w-4 h-4" />
                    View {event.tickets.length} ticket buyer{event.tickets.length !== 1 ? 's' : ''}
                    {expandedEvent === event.id ? <FaChevronUp className="w-3 h-3" /> : <FaChevronDown className="w-3 h-3" />}
                  </button>
                )}
              </div>
              
              {/* Tickets Table (Expanded) */}
              {expandedEvent === event.id && event.tickets && event.tickets.length > 0 && (
                <div className="border-t border-white/5 bg-black/20">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[600px]">
                      <thead>
                        <tr className="border-b border-white/5">
                          <th className="text-left px-5 py-3 text-xs font-medium text-white/40 uppercase">Buyer</th>
                          <th className="text-left px-5 py-3 text-xs font-medium text-white/40 uppercase">Type</th>
                          <th className="text-left px-5 py-3 text-xs font-medium text-white/40 uppercase">Price Paid</th>
                          <th className="text-left px-5 py-3 text-xs font-medium text-white/40 uppercase">Status</th>
                          <th className="text-left px-5 py-3 text-xs font-medium text-white/40 uppercase">Purchased</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {event.tickets.map((ticket) => {
                          const statusConfig = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.active;
                          return (
                            <tr key={ticket.id} className="hover:bg-white/[0.02]">
                              <td className="px-5 py-3">
                                <div className="flex items-center gap-2">
                                  {ticket.user?.avatar_url ? (
                                    <img src={ticket.user.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                                  ) : (
                                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                                      <FaUser className="w-3 h-3 text-white/40" />
                                    </div>
                                  )}
                                  <div>
                                    <p className="text-sm font-medium">{ticket.user?.full_name || ticket.user?.username || 'Unknown'}</p>
                                    <p className="text-xs text-white/40">{ticket.user?.email}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-5 py-3">
                                <span className="text-sm capitalize">{ticket.ticket_type || 'General'}</span>
                              </td>
                              <td className="px-5 py-3">
                                <span className="text-sm text-[#D4AF37] font-medium">{formatCurrency(ticket.price_paid)}</span>
                              </td>
                              <td className="px-5 py-3">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.bg} ${statusConfig.color}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
                                  {statusConfig.label}
                                </span>
                              </td>
                              <td className="px-5 py-3">
                                <span className="text-sm text-white/50">{ticket.purchased_at ? formatDate(ticket.purchased_at) : '—'}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { 
  icon: React.ElementType; label: string; value: string | number; color: string;
}) {
  const colors: Record<string, { bg: string; text: string }> = {
    white: { bg: 'bg-white/5', text: 'text-white' },
    emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
    blue: { bg: 'bg-blue-500/10', text: 'text-blue-400' },
    gold: { bg: 'bg-[#D4AF37]/10', text: 'text-[#D4AF37]' },
    purple: { bg: 'bg-purple-500/10', text: 'text-purple-400' },
  };
  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 hover:border-white/10 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-white/40">{label}</span>
        <div className={`w-8 h-8 rounded-lg ${colors[color]?.bg} flex items-center justify-center`}>
          <Icon className={`w-3.5 h-3.5 ${colors[color]?.text}`} />
        </div>
      </div>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}
