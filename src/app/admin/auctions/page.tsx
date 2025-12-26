"use client";
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { 
  FaGavel, FaDollarSign, FaUser, FaSearch, 
  FaChartLine, FaFire, FaCheckCircle, FaEye
} from 'react-icons/fa';

interface Profile {
  id: string;
  full_name?: string;
  username?: string;
  email?: string;
  avatar_url?: string;
}

interface Bid {
  id: string;
  auction_id: string;
  user_id: string;
  amount: number;
  created_at: string;
  bidder?: Profile;
}

interface Auction {
  id: string;
  title: string;
  description?: string;
  images?: string[];
  starting_price: number;
  current_price?: number;
  buy_now_price?: number;
  reserve_price?: number;
  start_time: string;
  end_time: string;
  status: 'draft' | 'active' | 'ended' | 'sold' | 'cancelled';
  winner_id?: string;
  seller_id: string;
  category?: string;
  created_at: string;
  seller?: Profile;
  winner?: Profile;
  bids?: Bid[];
  bid_count?: number;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  draft: { label: 'Draft', color: 'text-gray-400', bg: 'bg-gray-500/10', dot: 'bg-gray-400' },
  active: { label: 'Live', color: 'text-emerald-400', bg: 'bg-emerald-500/10', dot: 'bg-emerald-400' },
  ended: { label: 'Ended', color: 'text-amber-400', bg: 'bg-amber-500/10', dot: 'bg-amber-400' },
  sold: { label: 'Sold', color: 'text-blue-400', bg: 'bg-blue-500/10', dot: 'bg-blue-400' },
  cancelled: { label: 'Cancelled', color: 'text-red-400', bg: 'bg-red-500/10', dot: 'bg-red-400' },
};

export default function AdminAuctionsPage() {
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'ended' | 'sold'>('all');
  const [expandedAuction, setExpandedAuction] = useState<string | null>(null);

  // Stats
  const stats = useMemo(() => {
    const active = auctions.filter(a => a.status === 'active').length;
    const ended = auctions.filter(a => a.status === 'ended' || a.status === 'sold').length;
    const totalBids = auctions.reduce((sum, a) => sum + (a.bid_count || 0), 0);
    const totalValue = auctions
      .filter(a => a.status === 'sold')
      .reduce((sum, a) => sum + (a.current_price || a.starting_price), 0);
    
    return { total: auctions.length, active, ended, totalBids, totalValue };
  }, [auctions]);

  // Filtered auctions
  const filteredAuctions = useMemo(() => {
    let list = auctions;
    
    if (filter === 'active') list = list.filter(a => a.status === 'active');
    else if (filter === 'ended') list = list.filter(a => a.status === 'ended');
    else if (filter === 'sold') list = list.filter(a => a.status === 'sold');
    
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(a => 
        a.title?.toLowerCase().includes(q) ||
        a.seller?.full_name?.toLowerCase().includes(q) ||
        a.category?.toLowerCase().includes(q)
      );
    }
    
    return list;
  }, [auctions, filter, search]);

  const fetchAuctions = useCallback(async () => {
    try {
      // Fetch auctions
      const { data: auctionsData, error } = await supabase
        .from('auctions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching auctions:', error);
        setIsLoading(false);
        return;
      }

      if (!auctionsData || auctionsData.length === 0) {
        setAuctions([]);
        setIsLoading(false);
        return;
      }

      // Get unique user IDs (sellers and winners)
      const sellerIds = [...new Set(auctionsData.map(a => a.seller_id).filter(Boolean))];
      const winnerIds = [...new Set(auctionsData.map(a => a.winner_id).filter(Boolean))];
      const allUserIds = [...new Set([...sellerIds, ...winnerIds])];
      
      const profilesMap: Record<string, Profile> = {};
      if (allUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, username, email, avatar_url')
          .in('id', allUserIds);
        profiles?.forEach(p => { profilesMap[p.id] = p; });
      }

      // Fetch bids for all auctions
      const auctionIds = auctionsData.map(a => a.id);
      const { data: bidsData } = await supabase
        .from('auction_bids')
        .select('*')
        .in('auction_id', auctionIds)
        .order('amount', { ascending: false });

      // Get bidder profiles
      const bidderIds = [...new Set((bidsData || []).map(b => b.user_id).filter(Boolean))];
      if (bidderIds.length > 0) {
        const { data: bidderProfiles } = await supabase
          .from('profiles')
          .select('id, full_name, username, email, avatar_url')
          .in('id', bidderIds);
        bidderProfiles?.forEach(p => { profilesMap[p.id] = p; });
      }

      // Group bids by auction
      const bidsByAuction: Record<string, Bid[]> = {};
      (bidsData || []).forEach(b => {
        if (!bidsByAuction[b.auction_id]) bidsByAuction[b.auction_id] = [];
        bidsByAuction[b.auction_id].push({
          ...b,
          bidder: profilesMap[b.user_id],
        });
      });

      // Combine data
      const auctionsWithData = auctionsData.map(a => ({
        ...a,
        seller: profilesMap[a.seller_id],
        winner: a.winner_id ? profilesMap[a.winner_id] : undefined,
        bids: bidsByAuction[a.id] || [],
        bid_count: (bidsByAuction[a.id] || []).length,
      }));

      setAuctions(auctionsWithData);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAuctions();
  }, [fetchAuctions]);

  const formatCurrency = (amount: number) => `GHS ${new Intl.NumberFormat('en-GH').format(amount)}`;
  const formatDate = (date: string) => new Date(date).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  const getTimeRemaining = (endTime: string) => {
    const now = new Date();
    const end = new Date(endTime);
    const diff = end.getTime() - now.getTime();
    
    if (diff <= 0) return 'Ended';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const isLive = (auction: Auction) => {
    const now = new Date();
    return auction.status === 'active' && new Date(auction.end_time) > now;
  };

  const filters = [
    { key: 'all', label: 'All Auctions', count: stats.total },
    { key: 'active', label: 'Live', count: stats.active },
    { key: 'ended', label: 'Ended', count: auctions.filter(a => a.status === 'ended').length },
    { key: 'sold', label: 'Sold', count: auctions.filter(a => a.status === 'sold').length },
  ];

  return (
    <div className="p-4 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-semibold">Auctions</h1>
          <p className="text-sm text-white/50 mt-1">Manage auctions and bids</p>
        </div>
        <div className="relative w-full lg:w-80">
          <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            type="text"
            placeholder="Search auctions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm placeholder-white/30 focus:border-[#D4AF37]/50 focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard icon={FaGavel} label="Total Auctions" value={stats.total} color="white" />
        <StatCard icon={FaFire} label="Live Now" value={stats.active} color="red" />
        <StatCard icon={FaCheckCircle} label="Completed" value={stats.ended} color="emerald" />
        <StatCard icon={FaChartLine} label="Total Bids" value={stats.totalBids} color="blue" />
        <StatCard icon={FaDollarSign} label="Total Sold" value={formatCurrency(stats.totalValue)} color="gold" />
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

      {/* Auctions List */}
      <div className="space-y-4">
        {isLoading ? (
          [...Array(3)].map((_, i) => (
            <div key={i} className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 animate-pulse">
              <div className="flex gap-4">
                <div className="w-24 h-24 bg-white/5 rounded-xl" />
                <div className="flex-1 space-y-3">
                  <div className="h-5 w-1/3 bg-white/5 rounded" />
                  <div className="h-4 w-1/2 bg-white/5 rounded" />
                </div>
              </div>
            </div>
          ))
        ) : filteredAuctions.length === 0 ? (
          <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-12 text-center">
            <FaGavel className="w-12 h-12 text-white/10 mx-auto mb-4" />
            <p className="text-white/40">No auctions found</p>
          </div>
        ) : (
          filteredAuctions.map((auction) => {
            const statusConfig = STATUS_CONFIG[auction.status] || STATUS_CONFIG.draft;
            const live = isLive(auction);
            
            return (
              <div key={auction.id} className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden hover:border-white/10 transition-colors">
                <div className="p-5">
                  <div className="flex gap-4">
                    {/* Image */}
                    <div className="w-24 h-24 lg:w-32 lg:h-32 rounded-xl overflow-hidden flex-shrink-0 bg-white/5">
                      {auction.images && auction.images[0] ? (
                        <img src={auction.images[0]} alt={auction.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <FaGavel className="w-8 h-8 text-white/20" />
                        </div>
                      )}
                    </div>
                    
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-lg">{auction.title}</h3>
                          {auction.category && (
                            <p className="text-sm text-white/40 mt-0.5 capitalize">{auction.category}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {live && (
                            <span className="flex items-center gap-1.5 px-2.5 py-1 bg-red-500/20 text-red-400 rounded-lg text-xs font-medium animate-pulse">
                              <span className="w-2 h-2 rounded-full bg-red-400" />
                              LIVE
                            </span>
                          )}
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${statusConfig.bg} ${statusConfig.color}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
                            {statusConfig.label}
                          </span>
                        </div>
                      </div>
                      
                      {/* Pricing */}
                      <div className="flex flex-wrap items-center gap-4 mt-3">
                        <div>
                          <p className="text-xs text-white/40">Current Bid</p>
                          <p className="text-xl font-semibold text-[#D4AF37]">
                            {formatCurrency(auction.current_price || auction.starting_price)}
                          </p>
                        </div>
                        {auction.buy_now_price && (
                          <div>
                            <p className="text-xs text-white/40">Buy Now</p>
                            <p className="text-lg font-medium text-white/70">{formatCurrency(auction.buy_now_price)}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-xs text-white/40">Bids</p>
                          <p className="text-lg font-medium">{auction.bid_count || 0}</p>
                        </div>
                        {live && (
                          <div>
                            <p className="text-xs text-white/40">Time Left</p>
                            <p className="text-lg font-medium text-amber-400">{getTimeRemaining(auction.end_time)}</p>
                          </div>
                        )}
                      </div>
                      
                      {/* Seller & Winner */}
                      <div className="flex flex-wrap items-center gap-4 mt-3">
                        {auction.seller && (
                          <div className="flex items-center gap-2 p-2 bg-white/5 rounded-lg">
                            {auction.seller.avatar_url ? (
                              <img src={auction.seller.avatar_url} alt="" className="w-6 h-6 rounded-full" />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-[#D4AF37]/20 flex items-center justify-center">
                                <FaUser className="w-3 h-3 text-[#D4AF37]" />
                              </div>
                            )}
                            <span className="text-sm text-white/70">
                              Seller: <span className="text-white font-medium">{auction.seller.full_name || auction.seller.username}</span>
                            </span>
                          </div>
                        )}
                        {auction.winner && (
                          <div className="flex items-center gap-2 p-2 bg-emerald-500/10 rounded-lg">
                            {auction.winner.avatar_url ? (
                              <img src={auction.winner.avatar_url} alt="" className="w-6 h-6 rounded-full" />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                                <FaUser className="w-3 h-3 text-emerald-400" />
                              </div>
                            )}
                            <span className="text-sm text-emerald-400">
                              Winner: <span className="font-medium">{auction.winner.full_name || auction.winner.username}</span>
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Expand Bids */}
                  {auction.bids && auction.bids.length > 0 && (
                    <button
                      onClick={() => setExpandedAuction(expandedAuction === auction.id ? null : auction.id)}
                      className="flex items-center gap-2 mt-4 text-sm text-[#D4AF37] hover:text-[#D4AF37]/80 transition-colors"
                    >
                      <FaEye className="w-4 h-4" />
                      View {auction.bids.length} bid{auction.bids.length !== 1 ? 's' : ''}
                      {expandedAuction === auction.id ? (
                        <span className="ml-1">▲</span>
                      ) : (
                        <span className="ml-1">▼</span>
                      )}
                    </button>
                  )}
                </div>
                
                {/* Bids Table */}
                {expandedAuction === auction.id && auction.bids && auction.bids.length > 0 && (
                  <div className="border-t border-white/5 bg-black/20">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[500px]">
                        <thead>
                          <tr className="border-b border-white/5">
                            <th className="text-left px-5 py-3 text-xs font-medium text-white/40 uppercase">Rank</th>
                            <th className="text-left px-5 py-3 text-xs font-medium text-white/40 uppercase">Bidder</th>
                            <th className="text-left px-5 py-3 text-xs font-medium text-white/40 uppercase">Amount</th>
                            <th className="text-left px-5 py-3 text-xs font-medium text-white/40 uppercase">Time</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {auction.bids.map((bid, index) => (
                            <tr key={bid.id} className={`hover:bg-white/[0.02] ${index === 0 ? 'bg-[#D4AF37]/5' : ''}`}>
                              <td className="px-5 py-3">
                                <span className={`text-sm font-medium ${index === 0 ? 'text-[#D4AF37]' : 'text-white/50'}`}>
                                  #{index + 1}
                                </span>
                              </td>
                              <td className="px-5 py-3">
                                <div className="flex items-center gap-2">
                                  {bid.bidder?.avatar_url ? (
                                    <img src={bid.bidder.avatar_url} alt="" className="w-8 h-8 rounded-full" />
                                  ) : (
                                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                                      <FaUser className="w-3 h-3 text-white/40" />
                                    </div>
                                  )}
                                  <div>
                                    <p className="text-sm font-medium">{bid.bidder?.full_name || bid.bidder?.username || 'Unknown'}</p>
                                    <p className="text-xs text-white/40">{bid.bidder?.email}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-5 py-3">
                                <span className={`text-sm font-semibold ${index === 0 ? 'text-[#D4AF37]' : ''}`}>
                                  {formatCurrency(bid.amount)}
                                </span>
                              </td>
                              <td className="px-5 py-3">
                                <span className="text-sm text-white/50">{formatDate(bid.created_at)}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })
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
    red: { bg: 'bg-red-500/10', text: 'text-red-400' },
    emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
    blue: { bg: 'bg-blue-500/10', text: 'text-blue-400' },
    gold: { bg: 'bg-[#D4AF37]/10', text: 'text-[#D4AF37]' },
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
