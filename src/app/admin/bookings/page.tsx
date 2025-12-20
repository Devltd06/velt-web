"use client";
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { 
  FaCheck, FaTimes, FaEye, FaRocket, FaBan, FaSearch, 
  FaCalendarAlt, FaMoneyBillWave, FaClock, FaCheckCircle
} from 'react-icons/fa';

interface Booking {
  id: string;
  campaign_title: string;
  billboard_id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  total_price: number;
  price_per_day: number;
  total_days: number;
  status: string;
  created_at: string;
  rejection_reason?: string;
  is_paid?: boolean;
  session_started_at?: string;
  billboard_locations?: { id: string; name: string; city?: string; region?: string; };
  billboard_media?: { id: string; thumbnail_url?: string; };
  profiles?: { id: string; full_name?: string; email?: string; avatar_url?: string; };
  payments?: { id: string; amount: number; reference?: string; status?: string; created_at?: string; };
}

const STATUS: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  pending: { label: 'Pending', color: 'text-amber-400', bg: 'bg-amber-500/10', dot: 'bg-amber-400' },
  approved: { label: 'Approved', color: 'text-emerald-400', bg: 'bg-emerald-500/10', dot: 'bg-emerald-400' },
  paid: { label: 'Paid', color: 'text-violet-400', bg: 'bg-violet-500/10', dot: 'bg-violet-400' },
  rejected: { label: 'Rejected', color: 'text-red-400', bg: 'bg-red-500/10', dot: 'bg-red-400' },
  active: { label: 'Active', color: 'text-blue-400', bg: 'bg-blue-500/10', dot: 'bg-blue-400' },
  completed: { label: 'Completed', color: 'text-gray-400', bg: 'bg-gray-500/10', dot: 'bg-gray-400' },
  cancelled: { label: 'Cancelled', color: 'text-gray-500', bg: 'bg-gray-500/10', dot: 'bg-gray-500' }
};

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState<Booking | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [search, setSearch] = useState('');

  const stats = useMemo(() => ({
    pending: bookings.filter(b => b.status === 'pending').length,
    approved: bookings.filter(b => b.status === 'approved').length,
    paid: bookings.filter(b => b.status === 'paid').length,
    active: bookings.filter(b => b.status === 'active').length,
    revenue: bookings.filter(b => b.is_paid).reduce((s, b) => s + (b.total_price || 0), 0),
    total: bookings.length
  }), [bookings]);

  const filtered = useMemo(() => {
    let list = bookings;
    if (filter !== 'all') list = list.filter(b => b.status === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(b => 
        b.campaign_title?.toLowerCase().includes(q) ||
        b.billboard_locations?.name?.toLowerCase().includes(q) ||
        b.profiles?.full_name?.toLowerCase().includes(q) ||
        b.profiles?.email?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [bookings, filter, search]);

  const fetchBookings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('billboard_bookings')
        .select(`*, billboard_locations(id, name, city, region), billboard_media(id, thumbnail_url), profiles:user_id(id, full_name, email, avatar_url), payments:payment_id(id, amount, reference, status, created_at)`)
        .order('created_at', { ascending: false });
      if (!error) setBookings(data || []);
    } finally { setIsLoading(false); }
  }, []);

  // Initial fetch and real-time subscription
  useEffect(() => {
    fetchBookings();

    // Subscribe to real-time changes - updates in background without page reload
    const channel = supabase
      .channel('admin-bookings-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'billboard_bookings' },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            // Fetch the new booking with relations
            const { data } = await supabase
              .from('billboard_bookings')
              .select(`*, billboard_locations(id, name, city, region), billboard_media(id, thumbnail_url), profiles:user_id(id, full_name, email, avatar_url), payments:payment_id(id, amount, reference, status, created_at)`)
              .eq('id', payload.new.id)
              .single();
            if (data) {
              setBookings(prev => [data, ...prev]);
            }
          } else if (payload.eventType === 'UPDATE') {
            // Fetch updated booking with relations
            const { data } = await supabase
              .from('billboard_bookings')
              .select(`*, billboard_locations(id, name, city, region), billboard_media(id, thumbnail_url), profiles:user_id(id, full_name, email, avatar_url), payments:payment_id(id, amount, reference, status, created_at)`)
              .eq('id', payload.new.id)
              .single();
            if (data) {
              setBookings(prev => prev.map(b => b.id === data.id ? data : b));
              // Update selected booking if it's the one being viewed
              setSelected(prev => prev?.id === data.id ? data : prev);
            }
          } else if (payload.eventType === 'DELETE') {
            setBookings(prev => prev.filter(b => b.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchBookings]);

  const update = useCallback(async (id: string, data: Record<string, unknown>, notify?: { type: string; title: string; message: string }) => {
    const booking = bookings.find(b => b.id === id);
    const { error } = await supabase.from('billboard_bookings').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) { alert('Operation failed'); return false; }
    if (notify && booking) {
      await supabase.from('billboard_notifications').insert({ user_id: booking.user_id, booking_id: id, ...notify });
    }
    setBookings(prev => prev.map(b => b.id === id ? { ...b, ...data } : b));
    setShowModal(false);
    return true;
  }, [bookings]);

  const handleApprove = (id: string) => update(id, 
    { status: 'approved', status_changed_at: new Date().toISOString() },
    { type: 'booking_approved', title: 'Booking Approved! 🎉', message: `Your booking has been approved. Please proceed with payment.` }
  );

  const handleActivate = (id: string) => {
    if (!confirm('Activate this campaign?')) return;
    update(id, 
      { status: 'active', session_started_at: new Date().toISOString(), status_changed_at: new Date().toISOString() },
      { type: 'campaign_activated', title: 'Campaign is Live! 🚀', message: `Your campaign is now live!` }
    );
  };

  const handleComplete = (id: string) => {
    if (!confirm('Mark as completed?')) return;
    update(id, { status: 'completed', status_changed_at: new Date().toISOString() },
      { type: 'campaign_completed', title: 'Campaign Completed ✔', message: `Your campaign has been completed.` }
    );
  };

  const handleCancel = (id: string) => {
    if (!confirm('Cancel this booking?')) return;
    update(id, { status: 'cancelled', status_changed_at: new Date().toISOString() },
      { type: 'booking_cancelled', title: 'Booking Cancelled', message: `Your booking has been cancelled.` }
    );
  };

  const handleReject = async () => {
    if (!selected || !rejectReason.trim()) return;
    await update(selected.id, { status: 'rejected', rejection_reason: rejectReason, status_changed_at: new Date().toISOString() },
      { type: 'booking_rejected', title: 'Booking Not Approved', message: `Reason: ${rejectReason}` }
    );
    setShowReject(false);
    setRejectReason('');
  };

  const fmt = (n: number) => new Intl.NumberFormat('en-GH').format(n);
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const filters = [
    { key: 'all', label: 'All', count: stats.total },
    { key: 'pending', label: 'Pending', count: stats.pending },
    { key: 'approved', label: 'Approved', count: stats.approved },
    { key: 'paid', label: 'Paid', count: stats.paid },
    { key: 'active', label: 'Active', count: stats.active },
    { key: 'completed', label: 'Completed' },
    { key: 'rejected', label: 'Rejected' },
    { key: 'cancelled', label: 'Cancelled' },
  ];

  return (
    <div className="p-4 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-semibold">Bookings</h1>
          <p className="text-sm text-white/50 mt-1">Manage billboard booking requests</p>
        </div>
        <div className="relative w-full lg:w-80">
          <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            type="text"
            placeholder="Search bookings..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm placeholder-white/30 focus:border-[#D4AF37]/50 focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat icon={FaClock} label="Pending" value={stats.pending} color="amber" />
        <Stat icon={FaRocket} label="Active" value={stats.active} color="blue" />
        <Stat icon={FaMoneyBillWave} label="Revenue" value={`GHS ${fmt(stats.revenue)}`} color="gold" />
        <Stat icon={FaCalendarAlt} label="Total" value={stats.total} color="white" />
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${filter === f.key ? 'bg-[#D4AF37] text-black' : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'}`}
          >
            {f.label}
            {f.count !== undefined && f.count > 0 && (
              <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${filter === f.key ? 'bg-black/20' : 'bg-white/10'}`}>{f.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="border-b border-white/5">
                {['Campaign', 'Location', 'Client', 'Duration', 'Amount', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i}><td colSpan={7} className="px-5 py-4"><div className="h-10 bg-white/5 rounded animate-pulse" /></td></tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-16 text-center text-white/40">No bookings found</td></tr>
              ) : filtered.map((b) => (
                <tr key={b.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-4">
                    <p className="font-medium text-sm">{b.campaign_title || 'Unnamed'}</p>
                    <p className="text-xs text-white/40 font-mono">#{b.id.slice(0, 8)}</p>
                  </td>
                  <td className="px-5 py-4">
                    <p className="text-sm">{b.billboard_locations?.name || 'N/A'}</p>
                    <p className="text-xs text-white/40">{b.billboard_locations?.city || ''}</p>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-[#D4AF37] flex items-center justify-center text-black text-xs font-bold">
                        {(b.profiles?.full_name || b.profiles?.email || 'U')[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm">{b.profiles?.full_name || 'N/A'}</p>
                        <p className="text-xs text-white/40">{b.profiles?.email || ''}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <p className="text-sm">{fmtDate(b.start_date)}</p>
                    <p className="text-xs text-white/40">→ {fmtDate(b.end_date)}</p>
                  </td>
                  <td className="px-5 py-4">
                    <p className="text-sm font-semibold text-[#D4AF37]">GHS {fmt(b.total_price || 0)}</p>
                    {b.is_paid && <span className="inline-flex items-center gap-1 text-xs text-emerald-400"><FaCheckCircle className="w-3 h-3" /> Paid</span>}
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${STATUS[b.status]?.bg} ${STATUS[b.status]?.color}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${STATUS[b.status]?.dot}`} />
                      {STATUS[b.status]?.label || b.status}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1">
                      <Btn onClick={() => { setSelected(b); setShowModal(true); }} title="View"><FaEye /></Btn>
                      {b.status === 'pending' && (
                        <>
                          <Btn onClick={() => handleApprove(b.id)} color="emerald" title="Approve"><FaCheck /></Btn>
                          <Btn onClick={() => { setSelected(b); setShowReject(true); }} color="red" title="Reject"><FaTimes /></Btn>
                        </>
                      )}
                      {(b.status === 'paid' || (b.status === 'approved' && b.is_paid)) && (
                        <button onClick={() => handleActivate(b.id)} className="px-3 py-1.5 rounded-lg bg-violet-500/20 text-violet-400 hover:bg-violet-500/30 text-xs font-medium flex items-center gap-1.5">
                          <FaRocket className="w-3 h-3" /> Activate
                        </button>
                      )}
                      {b.status === 'active' && (
                        <>
                          <Btn onClick={() => handleComplete(b.id)} color="blue" title="Complete"><FaCheckCircle /></Btn>
                          <Btn onClick={() => handleCancel(b.id)} color="red" title="Cancel"><FaBan /></Btn>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-white/5 text-sm text-white/40">
            Showing {filtered.length} of {bookings.length}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {showModal && selected && (
        <Modal onClose={() => setShowModal(false)}>
          <div className="sticky top-0 bg-black border-b border-white/5 px-6 py-4 flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Booking Details</h3>
              <p className="text-xs text-white/40 font-mono">#{selected.id.slice(0, 12)}</p>
            </div>
            <Btn onClick={() => setShowModal(false)}><FaTimes /></Btn>
          </div>
          <div className="p-6 space-y-5">
            <div className="flex items-center gap-3 flex-wrap">
              <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${STATUS[selected.status]?.bg} ${STATUS[selected.status]?.color}`}>
                <span className={`w-2 h-2 rounded-full ${STATUS[selected.status]?.dot}`} />
                {STATUS[selected.status]?.label}
              </span>
              {selected.is_paid && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-emerald-500/10 text-emerald-400">
                  <FaCheckCircle className="w-3.5 h-3.5" /> Paid
                </span>
              )}
            </div>

            {selected.status === 'approved' && !selected.is_paid && (
              <Alert color="amber" icon="⏳" title="Awaiting Payment" desc="User has been notified to complete payment." />
            )}
            {(selected.status === 'paid' || (selected.status === 'approved' && selected.is_paid)) && (
              <Alert color="violet" icon="🚀" title="Ready to Activate" desc="Payment confirmed. Click activate to go live." />
            )}
            {selected.rejection_reason && (
              <Alert color="red" icon="✗" title="Rejection Reason" desc={selected.rejection_reason} />
            )}

            {selected.payments && (
              <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                <p className="text-xs text-white/40 uppercase tracking-wider mb-3 font-medium">Payment</p>
                <div className="grid grid-cols-2 gap-3">
                  <Info label="Amount" value={`GHS ${fmt(selected.payments.amount || 0)}`} highlight />
                  <Info label="Reference" value={selected.payments.reference || 'N/A'} mono />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Info label="Campaign" value={selected.campaign_title || 'Unnamed'} />
              <Info label="Billboard" value={selected.billboard_locations?.name || 'N/A'} />
              <Info label="Location" value={[selected.billboard_locations?.city, selected.billboard_locations?.region].filter(Boolean).join(', ') || 'N/A'} />
              <Info label="Client" value={selected.profiles?.full_name || selected.profiles?.email || 'N/A'} />
              <Info label="Start" value={fmtDate(selected.start_date)} />
              <Info label="End" value={fmtDate(selected.end_date)} />
            </div>

            <div className="p-4 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/20">
              <p className="text-xs text-white/40">Total Amount</p>
              <p className="text-2xl font-bold text-[#D4AF37]">GHS {fmt(selected.total_price || 0)}</p>
              <p className="text-xs text-white/40 mt-1">{selected.total_days || 0} days</p>
            </div>

            {selected.status === 'pending' && (
              <Actions>
                <ActionBtn onClick={() => handleApprove(selected.id)} color="emerald">Approve</ActionBtn>
                <ActionBtn onClick={() => setShowReject(true)} color="red">Reject</ActionBtn>
              </Actions>
            )}
            {(selected.status === 'paid' || (selected.status === 'approved' && selected.is_paid)) && (
              <Actions>
                <ActionBtn onClick={() => handleActivate(selected.id)} color="violet">Activate</ActionBtn>
                <ActionBtn onClick={() => setShowReject(true)} color="red">Reject</ActionBtn>
              </Actions>
            )}
            {selected.status === 'active' && (
              <Actions>
                <ActionBtn onClick={() => handleComplete(selected.id)} color="blue">Complete</ActionBtn>
                <ActionBtn onClick={() => handleCancel(selected.id)} color="red">Cancel</ActionBtn>
              </Actions>
            )}
          </div>
        </Modal>
      )}

      {/* Reject Modal */}
      {showReject && (
        <Modal onClose={() => setShowReject(false)} small>
          <div className="px-6 py-4 border-b border-white/5">
            <h3 className="font-semibold">Reject Booking</h3>
            <p className="text-sm text-white/40">Provide a reason</p>
          </div>
          <div className="p-6 space-y-4">
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full h-28 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm placeholder-white/30 resize-none focus:border-red-500/50 focus:outline-none"
              placeholder="Enter reason..."
            />
            <Actions>
              <ActionBtn onClick={() => { setShowReject(false); setRejectReason(''); }} color="gray">Cancel</ActionBtn>
              <ActionBtn onClick={handleReject} color="red" disabled={!rejectReason.trim()}>Reject</ActionBtn>
            </Actions>
          </div>
        </Modal>
      )}
    </div>
  );
}

// Components
function Stat({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string | number; color: string }) {
  const c: Record<string, { bg: string; text: string }> = {
    amber: { bg: 'bg-amber-500/10', text: 'text-amber-400' },
    blue: { bg: 'bg-blue-500/10', text: 'text-blue-400' },
    gold: { bg: 'bg-[#D4AF37]/10', text: 'text-[#D4AF37]' },
    white: { bg: 'bg-white/5', text: 'text-white' },
  };
  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-white/40">{label}</span>
        <div className={`w-9 h-9 rounded-lg ${c[color]?.bg} flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${c[color]?.text}`} />
        </div>
      </div>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}

function Btn({ onClick, children, color, title }: { onClick: () => void; children: React.ReactNode; color?: string; title?: string }) {
  const colors: Record<string, string> = {
    emerald: 'hover:bg-emerald-500/20 text-emerald-400',
    red: 'hover:bg-red-500/20 text-red-400',
    blue: 'hover:bg-blue-500/20 text-blue-400',
  };
  return (
    <button onClick={onClick} title={title} className={`p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors ${colors[color || ''] || ''}`}>
      {children}
    </button>
  );
}

function Modal({ children, onClose, small }: { children: React.ReactNode; onClose: () => void; small?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className={`bg-black border border-white/10 rounded-2xl w-full ${small ? 'max-w-md' : 'max-w-xl'} max-h-[85vh] overflow-auto`} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function Alert({ color, icon, title, desc }: { color: string; icon: string; title: string; desc: string }) {
  const colors: Record<string, string> = {
    amber: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
    violet: 'bg-violet-500/10 border-violet-500/20 text-violet-400',
    red: 'bg-red-500/10 border-red-500/20 text-red-400',
  };
  return (
    <div className={`p-4 rounded-xl border ${colors[color]}`}>
      <p className="font-medium text-sm">{icon} {title}</p>
      <p className="text-white/60 text-xs mt-1">{desc}</p>
    </div>
  );
}

function Info({ label, value, mono, highlight }: { label: string; value: string; mono?: boolean; highlight?: boolean }) {
  return (
    <div className="p-3 bg-white/5 rounded-xl">
      <p className="text-xs text-white/40 mb-1">{label}</p>
      <p className={`text-sm ${mono ? 'font-mono' : 'font-medium'} ${highlight ? 'text-emerald-400' : ''}`}>{value}</p>
    </div>
  );
}

function Actions({ children }: { children: React.ReactNode }) {
  return <div className="flex gap-3 pt-4 border-t border-white/5">{children}</div>;
}

function ActionBtn({ onClick, children, color, disabled }: { onClick: () => void; children: React.ReactNode; color: string; disabled?: boolean }) {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-600 hover:bg-emerald-500',
    red: 'bg-red-600 hover:bg-red-500',
    blue: 'bg-blue-600 hover:bg-blue-500',
    violet: 'bg-violet-600 hover:bg-violet-500',
    gray: 'bg-transparent border border-white/10 hover:bg-white/5',
  };
  return (
    <button onClick={onClick} disabled={disabled} className={`flex-1 py-3 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${colors[color]}`}>
      {children}
    </button>
  );
}
