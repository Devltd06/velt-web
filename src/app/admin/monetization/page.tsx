"use client";
import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { 
  FaDollarSign, FaGlobe, FaUser, FaSearch, FaChartLine,
  FaCheckCircle, FaClock, FaFire, FaStar,
  FaRocket, FaCheck, FaTimes, FaCalendarAlt, FaCrown
} from 'react-icons/fa';

interface MonthlyStarRecord {
  id: string;
  user_id: string;
  month_start: string;
  total_stars: number;
  tier_achieved: 'orion' | 'titan' | 'phoenix' | null;
  payout_amount: number;
  payout_currency: string;
  payout_status: 'pending' | 'eligible' | 'processing' | 'paid' | 'failed';
  payout_date: string | null;
  payout_reference: string | null;
  user?: {
    id: string;
    email: string;
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
    country: string | null;
  };
}

interface CountryConfig {
  id: string;
  country_code: string;
  currency_code: string;
  currency_symbol: string;
  payout_orion: number;
  payout_titan: number;
  payout_phoenix: number;
  is_enabled: boolean;
  signature_price: number;
}

interface SubscriptionRecord {
  id: string;
  user_id: string;
  subscription_type: string;
  amount_paid: number;
  currency: string;
  billing_cycle: string;
  starts_at: string;
  ends_at: string | null;
  is_active: boolean;
  user?: {
    email: string;
    full_name: string | null;
    country: string | null;
  };
}

interface Stats {
  totalSubscriptionRevenue: number;
  totalPayoutDue: number;
  totalPaidOut: number;
  orionEarners: number;
  titanEarners: number;
  phoenixEarners: number;
  totalCountries: number;
  enabledCountries: number;
  pendingPayouts: number;
  completedPayouts: number;
}

export default function MonetizationPage() {
  const [monthlyStars, setMonthlyStars] = useState<MonthlyStarRecord[]>([]);
  const [countryConfigs, setCountryConfigs] = useState<CountryConfig[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalSubscriptionRevenue: 0,
    totalPayoutDue: 0,
    totalPaidOut: 0,
    orionEarners: 0,
    titanEarners: 0,
    phoenixEarners: 0,
    totalCountries: 0,
    enabledCountries: 0,
    pendingPayouts: 0,
    completedPayouts: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'earners' | 'countries' | 'subscriptions'>('earners');
  const [tierFilter, setTierFilter] = useState('all');
  const [payoutFilter, setPayoutFilter] = useState<'all' | 'pending' | 'eligible' | 'paid'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch monthly star records with user profiles
      const { data: starsData, error: starsError } = await supabase
        .from('location_monthly_stars')
        .select(`
          *,
          user:profiles (
            id, email, full_name, username, avatar_url, country
          )
        `)
        .order('month_start', { ascending: false });

      if (starsError) {
        console.error('Error fetching monthly stars:', starsError);
      } else {
        setMonthlyStars(starsData || []);
      }

      // Fetch country monetization configs
      const { data: countriesData, error: countriesError } = await supabase
        .from('country_monetization_config')
        .select('*')
        .order('country_code', { ascending: true });

      if (countriesError) {
        console.error('Error fetching country configs:', countriesError);
      } else {
        setCountryConfigs(countriesData || []);
      }

      // Fetch subscription records (without join first, then get user info separately)
      const { data: subsData, error: subsError } = await supabase
        .from('subscription_records')
        .select('*')
        .order('created_at', { ascending: false });

      if (subsError) {
        console.error('Error fetching subscriptions:', subsError);
      } else {
        // Fetch user profiles for subscriptions
        if (subsData && subsData.length > 0) {
          const userIds = [...new Set(subsData.map(s => s.user_id).filter(Boolean))];
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('id, email, full_name, country')
            .in('id', userIds);
          
          const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);
          const subsWithUsers = subsData.map(sub => ({
            ...sub,
            user: profilesMap.get(sub.user_id) || null
          }));
          setSubscriptions(subsWithUsers);
        } else {
          setSubscriptions(subsData || []);
        }
      }

      // Calculate stats
      const orionEarners = starsData?.filter(s => s.tier_achieved === 'orion').length || 0;
      const titanEarners = starsData?.filter(s => s.tier_achieved === 'titan').length || 0;
      const phoenixEarners = starsData?.filter(s => s.tier_achieved === 'phoenix').length || 0;
      
      const pendingPayouts = starsData?.filter(s => ['pending', 'eligible', 'processing'].includes(s.payout_status)).length || 0;
      const completedPayouts = starsData?.filter(s => s.payout_status === 'paid').length || 0;
      
      const totalPayoutDue = starsData
        ?.filter(s => ['pending', 'eligible', 'processing'].includes(s.payout_status))
        .reduce((sum, s) => sum + (s.payout_amount || 0), 0) || 0;
      
      const totalPaidOut = starsData
        ?.filter(s => s.payout_status === 'paid')
        .reduce((sum, s) => sum + (s.payout_amount || 0), 0) || 0;

      // Calculate total subscription revenue (ALL subscriptions, not just active)
      const totalSubscriptionRevenue = subsData
        ?.reduce((sum, s) => sum + (s.amount_paid || 0), 0) || 0;

      const totalCountries = countriesData?.length || 0;
      const enabledCountries = countriesData?.filter(c => c.is_enabled).length || 0;

      setStats({
        totalSubscriptionRevenue,
        totalPayoutDue,
        totalPaidOut,
        orionEarners,
        titanEarners,
        phoenixEarners,
        totalCountries,
        enabledCountries,
        pendingPayouts,
        completedPayouts
      });

    } catch (error) {
      console.error('Error fetching monetization data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleUpdatePayoutStatus = async (recordId: string, newStatus: string) => {
    try {
      const updateData: Record<string, unknown> = { payout_status: newStatus };
      if (newStatus === 'paid') {
        updateData.payout_date = new Date().toISOString();
      }
      
      const { error } = await supabase
        .from('location_monthly_stars')
        .update(updateData)
        .eq('id', recordId);

      if (error) throw error;
      fetchData();
    } catch (error) {
      console.error('Error updating payout status:', error);
    }
  };

  const formatCurrency = (amount: number, currency = 'GHS', divideBy100 = true) => {
    const value = divideBy100 ? amount / 100 : amount;
    return `${currency} ${new Intl.NumberFormat('en-GH').format(value)}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatMonth = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric'
    });
  };

  const getTierConfig = (tier: string | null) => {
    const config: Record<string, { bg: string; text: string; icon: React.ElementType; label: string }> = {
      orion: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', icon: FaStar, label: 'Orion' },
      titan: { bg: 'bg-orange-500/10', text: 'text-orange-400', icon: FaFire, label: 'Titan' },
      phoenix: { bg: 'bg-rose-500/10', text: 'text-rose-400', icon: FaRocket, label: 'Phoenix' },
    };
    return tier ? config[tier] : null;
  };

  const getStatusConfig = (status: string) => {
    const config: Record<string, { bg: string; text: string; label: string }> = {
      pending: { bg: 'bg-gray-500/10', text: 'text-gray-400', label: 'Pending' },
      eligible: { bg: 'bg-amber-500/10', text: 'text-amber-400', label: 'Eligible' },
      processing: { bg: 'bg-blue-500/10', text: 'text-blue-400', label: 'Processing' },
      paid: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'Paid' },
      failed: { bg: 'bg-red-500/10', text: 'text-red-400', label: 'Failed' },
    };
    return config[status] || config.pending;
  };

  // Filter earners
  const filteredEarners = monthlyStars.filter(record => {
    const matchesTier = tierFilter === 'all' || record.tier_achieved === tierFilter;
    const matchesPayout = payoutFilter === 'all' || 
      (payoutFilter === 'pending' && ['pending', 'eligible', 'processing'].includes(record.payout_status)) || 
      (payoutFilter === 'paid' && record.payout_status === 'paid');
    const matchesSearch = searchQuery === '' || 
      record.user?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.user?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.user?.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.user?.country?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTier && matchesPayout && matchesSearch;
  });

  const StatCard = ({ label, value, icon: Icon, iconBg, iconColor, subtitle }: {
    label: string;
    value: string | number;
    icon: React.ElementType;
    iconBg: string;
    iconColor: string;
    subtitle?: string;
  }) => (
    <div className="bg-white/[0.02] rounded-2xl p-5 border border-white/[0.04]">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm text-white/40">{label}</p>
          <p className="text-2xl font-semibold">
            {isLoading ? <span className="inline-block w-16 h-6 bg-white/5 rounded animate-pulse" /> : value}
          </p>
          {subtitle && <p className="text-xs text-white/35">{subtitle}</p>}
        </div>
        <div className={`w-11 h-11 rounded-xl ${iconBg} flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-4 lg:p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-semibold">Monetization</h1>
        <p className="text-white/40 text-sm mt-1">Track star earners, payouts, and subscription revenue</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          label="Subscription Revenue" 
          value={formatCurrency(stats.totalSubscriptionRevenue)} 
          icon={FaDollarSign} 
          iconBg="bg-emerald-500/10" 
          iconColor="text-emerald-400"
          subtitle="From signature subs"
        />
        <StatCard 
          label="Payout Pending" 
          value={formatCurrency(stats.totalPayoutDue)} 
          icon={FaClock} 
          iconBg="bg-amber-500/10" 
          iconColor="text-amber-400"
          subtitle={`${stats.pendingPayouts} earners`}
        />
        <StatCard 
          label="Total Paid Out" 
          value={formatCurrency(stats.totalPaidOut)} 
          icon={FaCheckCircle} 
          iconBg="bg-blue-500/10" 
          iconColor="text-blue-400"
          subtitle={`${stats.completedPayouts} payouts`}
        />
        <StatCard 
          label="Countries" 
          value={stats.totalCountries} 
          icon={FaGlobe} 
          iconBg="bg-purple-500/10" 
          iconColor="text-purple-400"
          subtitle={`${stats.enabledCountries} enabled`}
        />
      </div>

      {/* Tier Stats Row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-cyan-500/5 rounded-2xl p-5 border border-cyan-500/10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center">
              <FaStar className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-cyan-400">{stats.orionEarners}</p>
              <p className="text-sm text-white/50">Orion Earners</p>
            </div>
          </div>
        </div>
        <div className="bg-orange-500/5 rounded-2xl p-5 border border-orange-500/10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center">
              <FaFire className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-orange-400">{stats.titanEarners}</p>
              <p className="text-sm text-white/50">Titan Earners</p>
            </div>
          </div>
        </div>
        <div className="bg-rose-500/5 rounded-2xl p-5 border border-rose-500/10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center">
              <FaRocket className="w-5 h-5 text-rose-400" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-rose-400">{stats.phoenixEarners}</p>
              <p className="text-sm text-white/50">Phoenix Earners</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/[0.06] pb-4">
        {[
          { key: 'earners', label: 'Star Earners', icon: FaStar },
          { key: 'countries', label: 'Country Config', icon: FaGlobe },
          { key: 'subscriptions', label: 'Subscription Revenue', icon: FaDollarSign },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key 
                ? 'bg-[#D4AF37] text-black' 
                : 'text-white/50 hover:text-white hover:bg-white/5'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Star Earners Tab */}
      {activeTab === 'earners' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 w-4 h-4" />
              <input
                type="text"
                placeholder="Search earners..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white/[0.02] border border-white/[0.06] rounded-xl text-sm focus:outline-none focus:border-[#D4AF37]/50"
              />
            </div>
            <select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value)}
              className="px-4 py-2.5 bg-white/[0.02] border border-white/[0.06] rounded-xl text-sm focus:outline-none focus:border-[#D4AF37]/50"
            >
              <option value="all">All Tiers</option>
              <option value="orion">Orion</option>
              <option value="titan">Titan</option>
              <option value="phoenix">Phoenix</option>
            </select>
            <select
              value={payoutFilter}
              onChange={(e) => setPayoutFilter(e.target.value as typeof payoutFilter)}
              className="px-4 py-2.5 bg-white/[0.02] border border-white/[0.06] rounded-xl text-sm focus:outline-none focus:border-[#D4AF37]/50"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending/Eligible</option>
              <option value="paid">Paid</option>
            </select>
          </div>

          {/* Earners Table */}
          <div className="bg-white/[0.02] rounded-2xl border border-white/[0.04] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-left p-4 text-xs font-medium text-white/40 uppercase tracking-wider">User</th>
                    <th className="text-left p-4 text-xs font-medium text-white/40 uppercase tracking-wider">Month</th>
                    <th className="text-left p-4 text-xs font-medium text-white/40 uppercase tracking-wider">Stars</th>
                    <th className="text-left p-4 text-xs font-medium text-white/40 uppercase tracking-wider">Tier</th>
                    <th className="text-left p-4 text-xs font-medium text-white/40 uppercase tracking-wider">Country</th>
                    <th className="text-left p-4 text-xs font-medium text-white/40 uppercase tracking-wider">Payout</th>
                    <th className="text-left p-4 text-xs font-medium text-white/40 uppercase tracking-wider">Status</th>
                    <th className="text-left p-4 text-xs font-medium text-white/40 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        <td colSpan={8} className="p-4">
                          <div className="h-12 bg-white/5 rounded animate-pulse" />
                        </td>
                      </tr>
                    ))
                  ) : filteredEarners.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-12 text-center">
                        <div className="w-16 h-16 mx-auto rounded-full bg-white/5 flex items-center justify-center mb-4">
                          <FaStar className="w-6 h-6 text-white/20" />
                        </div>
                        <p className="text-white/40">No star earners found</p>
                        <p className="text-white/25 text-sm mt-1">Users who reach tier thresholds will appear here</p>
                      </td>
                    </tr>
                  ) : (
                    filteredEarners.map((record) => {
                      const tierConfig = getTierConfig(record.tier_achieved);
                      const statusConfig = getStatusConfig(record.payout_status);
                      return (
                        <tr key={record.id} className="hover:bg-white/[0.02]">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              {record.user?.avatar_url ? (
                                <img src={record.user.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                                  <FaUser className="w-4 h-4 text-white/40" />
                                </div>
                              )}
                              <div>
                                <p className="font-medium text-sm">{record.user?.full_name || record.user?.username || 'Anonymous'}</p>
                                <p className="text-xs text-white/40">{record.user?.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <FaCalendarAlt className="w-3 h-3 text-white/30" />
                              <span className="text-sm">{formatMonth(record.month_start)}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <span className="text-sm font-medium text-[#D4AF37]">{record.total_stars} ⭐</span>
                          </td>
                          <td className="p-4">
                            {tierConfig ? (
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${tierConfig.bg} ${tierConfig.text}`}>
                                <tierConfig.icon className="w-3 h-3" />
                                {tierConfig.label}
                              </span>
                            ) : (
                              <span className="text-xs text-white/30">No tier</span>
                            )}
                          </td>
                          <td className="p-4">
                            <span className="text-sm">{record.user?.country || 'Unknown'}</span>
                          </td>
                          <td className="p-4">
                            <span className="text-sm font-medium">{formatCurrency(record.payout_amount, record.payout_currency)}</span>
                          </td>
                          <td className="p-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.bg} ${statusConfig.text}`}>
                              {statusConfig.label}
                            </span>
                          </td>
                          <td className="p-4">
                            {record.payout_status === 'paid' ? (
                              <button
                                onClick={() => handleUpdatePayoutStatus(record.id, 'pending')}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                              >
                                <FaTimes className="w-3 h-3" />
                                Undo
                              </button>
                            ) : (
                              <button
                                onClick={() => handleUpdatePayoutStatus(record.id, 'paid')}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                              >
                                <FaCheck className="w-3 h-3" />
                                Mark Paid
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Countries Tab */}
      {activeTab === 'countries' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Country Config List */}
            <div className="bg-white/[0.02] rounded-2xl border border-white/[0.04] overflow-hidden">
              <div className="p-5 border-b border-white/[0.04]">
                <h3 className="font-semibold">Country Payout Rates</h3>
                <p className="text-xs text-white/40 mt-0.5">Payout amounts per tier by country</p>
              </div>
              <div className="divide-y divide-white/[0.04] max-h-[500px] overflow-y-auto">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="p-4">
                      <div className="h-16 bg-white/5 rounded animate-pulse" />
                    </div>
                  ))
                ) : countryConfigs.length === 0 ? (
                  <div className="p-12 text-center">
                    <FaGlobe className="w-8 h-8 text-white/20 mx-auto mb-3" />
                    <p className="text-white/40">No country configs</p>
                  </div>
                ) : (
                  countryConfigs.map((country) => (
                    <div key={country.id} className="p-4 hover:bg-white/[0.02] transition-colors">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${country.is_enabled ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                            <FaGlobe className={`w-4 h-4 ${country.is_enabled ? 'text-emerald-400' : 'text-red-400'}`} />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{country.country_code}</p>
                            <p className="text-xs text-white/40">{country.currency_symbol} ({country.currency_code})</p>
                          </div>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full ${country.is_enabled ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                          {country.is_enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="p-2 rounded-lg bg-cyan-500/5">
                          <p className="text-xs text-white/40">Orion</p>
                          <p className="text-sm font-medium text-cyan-400">{country.currency_symbol} {country.payout_orion / 100}</p>
                        </div>
                        <div className="p-2 rounded-lg bg-orange-500/5">
                          <p className="text-xs text-white/40">Titan</p>
                          <p className="text-sm font-medium text-orange-400">{country.currency_symbol} {country.payout_titan / 100}</p>
                        </div>
                        <div className="p-2 rounded-lg bg-rose-500/5">
                          <p className="text-xs text-white/40">Phoenix</p>
                          <p className="text-sm font-medium text-rose-400">{country.currency_symbol} {country.payout_phoenix / 100}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Country Stats Summary */}
            <div className="space-y-4">
              <div className="bg-white/[0.02] rounded-2xl border border-white/[0.04] p-5">
                <h3 className="font-semibold mb-4">Country Summary</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02]">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                        <FaGlobe className="w-4 h-4 text-purple-400" />
                      </div>
                      <span className="text-sm">Total Countries</span>
                    </div>
                    <span className="text-xl font-semibold">{stats.totalCountries}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02]">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                        <FaCheckCircle className="w-4 h-4 text-emerald-400" />
                      </div>
                      <span className="text-sm">Enabled Countries</span>
                    </div>
                    <span className="text-xl font-semibold text-emerald-400">{stats.enabledCountries}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02]">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                        <FaTimes className="w-4 h-4 text-red-400" />
                      </div>
                      <span className="text-sm">Disabled Countries</span>
                    </div>
                    <span className="text-xl font-semibold text-red-400">{stats.totalCountries - stats.enabledCountries}</span>
                  </div>
                </div>
              </div>

              {/* Signature Price by Country */}
              <div className="bg-white/[0.02] rounded-2xl border border-white/[0.04] p-5">
                <h3 className="font-semibold mb-4">Signature Subscription Prices</h3>
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {countryConfigs.filter(c => c.is_enabled).map((country) => (
                    <div key={country.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-white/[0.02]">
                      <span className="text-sm">{country.country_code}</span>
                      <span className="text-sm font-medium text-[#D4AF37]">{country.currency_symbol} {country.signature_price / 100}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Subscriptions Tab */}
      {activeTab === 'subscriptions' && (
        <div className="space-y-4">
          {/* Subscription Revenue Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-white/[0.02] rounded-2xl border border-white/[0.04] p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <FaDollarSign className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm text-white/40">Total Revenue</p>
                  <p className="text-2xl font-semibold text-emerald-400">
                    {formatCurrency(stats.totalSubscriptionRevenue)}
                  </p>
                </div>
              </div>
              <p className="text-xs text-white/40">
                From {subscriptions.filter(s => s.is_active).length} active subscriptions
              </p>
            </div>
            <div className="bg-white/[0.02] rounded-2xl border border-white/[0.04] p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-[#D4AF37]/10 flex items-center justify-center">
                  <FaCrown className="w-5 h-5 text-[#D4AF37]" />
                </div>
                <div>
                  <p className="text-sm text-white/40">Active Signatures</p>
                  <p className="text-2xl font-semibold text-[#D4AF37]">
                    {subscriptions.filter(s => s.is_active).length}
                  </p>
                </div>
              </div>
              <p className="text-xs text-white/40">
                Current paying subscribers
              </p>
            </div>
            <div className="bg-white/[0.02] rounded-2xl border border-white/[0.04] p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-gray-500/10 flex items-center justify-center">
                  <FaChartLine className="w-5 h-5 text-gray-400" />
                </div>
                <div>
                  <p className="text-sm text-white/40">All Time Subscriptions</p>
                  <p className="text-2xl font-semibold">
                    {subscriptions.length}
                  </p>
                </div>
              </div>
              <p className="text-xs text-white/40">
                Total subscription records
              </p>
            </div>
          </div>

          {/* Subscriptions Table */}
          <div className="bg-white/[0.02] rounded-2xl border border-white/[0.04] overflow-hidden">
            <div className="p-5 border-b border-white/[0.04]">
              <h3 className="font-semibold">Subscription Records</h3>
              <p className="text-xs text-white/40 mt-0.5">All signature subscription payments</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-left p-4 text-xs font-medium text-white/40 uppercase tracking-wider">User</th>
                    <th className="text-left p-4 text-xs font-medium text-white/40 uppercase tracking-wider">Type</th>
                    <th className="text-left p-4 text-xs font-medium text-white/40 uppercase tracking-wider">Amount</th>
                    <th className="text-left p-4 text-xs font-medium text-white/40 uppercase tracking-wider">Billing</th>
                    <th className="text-left p-4 text-xs font-medium text-white/40 uppercase tracking-wider">Country</th>
                    <th className="text-left p-4 text-xs font-medium text-white/40 uppercase tracking-wider">Started</th>
                    <th className="text-left p-4 text-xs font-medium text-white/40 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {isLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <tr key={i}>
                        <td colSpan={7} className="p-4">
                          <div className="h-10 bg-white/5 rounded animate-pulse" />
                        </td>
                      </tr>
                    ))
                  ) : subscriptions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-12 text-center">
                        <div className="w-16 h-16 mx-auto rounded-full bg-white/5 flex items-center justify-center mb-4">
                          <FaCrown className="w-6 h-6 text-white/20" />
                        </div>
                        <p className="text-white/40">No subscription records yet</p>
                      </td>
                    </tr>
                  ) : (
                    subscriptions.map((sub) => (
                      <tr key={sub.id} className="hover:bg-white/[0.02]">
                        <td className="p-4">
                          <div>
                            <p className="font-medium text-sm">{sub.user?.full_name || 'Anonymous'}</p>
                            <p className="text-xs text-white/40">{sub.user?.email}</p>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#D4AF37]/10 text-[#D4AF37]">
                            <FaCrown className="w-3 h-3" />
                            {sub.subscription_type}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className="text-sm font-medium text-emerald-400">{formatCurrency(sub.amount_paid, sub.currency)}</span>
                        </td>
                        <td className="p-4">
                          <span className="text-sm capitalize">{sub.billing_cycle}</span>
                        </td>
                        <td className="p-4">
                          <span className="text-sm">{sub.user?.country || 'Unknown'}</span>
                        </td>
                        <td className="p-4">
                          <span className="text-sm text-white/60">{formatDate(sub.starts_at)}</span>
                        </td>
                        <td className="p-4">
                          {sub.is_active ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400">
                              <FaCheckCircle className="w-3 h-3" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-500/10 text-gray-400">
                              <FaClock className="w-3 h-3" />
                              Expired
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
