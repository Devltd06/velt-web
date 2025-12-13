// app/market/auction/[id].tsx
import React, { JSX, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { withSafeRouter } from '@/lib/navigation';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useProfileStore } from '@/lib/store/profile';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

type ProfileLite = { id?: string | null; full_name?: string | null; avatar_url?: string | null } | null;

type AuctionItem = {
  id: string;
  seller_id: string;
  title: string;
  image_url?: string | null;
  starting_price: number;
  ends_at: string;
  created_at?: string | null;
  seller?: ProfileLite;
  description?: string | null;
};

type Bid = {
  id: string;
  user_id: string;
  item_id: string;
  amount: number;
  created_at?: string | null;
  user?: ProfileLite;
};

const fmtMoney = (n?: number | null, c = 'GHS') =>
  typeof n === 'number' ? `${c} ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '—';

const getTimeLeftStr = (iso?: string) => {
  if (!iso) return '—';
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'Ended';
  const d = Math.floor(ms / (24 * 3600e3));
  const h = Math.floor((ms % (24 * 3600e3)) / 3600e3);
  const m = Math.floor((ms % 3600e3) / 60e3);
  const s = Math.floor((ms % 60000) / 1000);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
};

export default function AuctionDetailScreen(): JSX.Element {
  const router = withSafeRouter(useRouter());
  const params = useLocalSearchParams();
  const id = (params?.id as string) ?? (params?.['id'] as string) ?? null; // handle both patterns
  const { profile } = useProfileStore();

  const [loading, setLoading] = useState(true);
  const [auction, setAuction] = useState<AuctionItem | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [topBid, setTopBid] = useState<number | null>(null);
  const [bidInput, setBidInput] = useState('');
  const [placing, setPlacing] = useState(false);
  const [tick, setTick] = useState(0);
  const [savingEnd, setSavingEnd] = useState(false);
  const subRef = useRef<any>(null);

  // load auction + bids
  const loadAuctionAndBids = useCallback(async () => {
    if (!id) {
      console.warn('[auction] no id param');
      return;
    }
    setLoading(true);
    try {
      const { data: itemData, error: itemErr } = await supabase
        .from('auction_items')
        .select('*, seller:profiles(id, full_name, avatar_url)')
        .eq('id', id)
        .maybeSingle();

      if (itemErr) {
        console.log('[auction] fetch item error', itemErr);
        setAuction(null);
        setBids([]);
        setTopBid(null);
        return;
      }
      const it = (itemData as any) as AuctionItem | null;
      if (!it) {
        setAuction(null);
        setBids([]);
        setTopBid(null);
        return;
      }

      // normalize seller key if needed
      (it as any).seller = (it as any).seller || null;

      setAuction(it);

      // fetch bids for item
      const { data: bidsData } = await supabase
        .from('bids')
        .select('id, user_id, item_id, amount, created_at')
        .eq('item_id', id)
        .order('amount', { ascending: false });

      const list = (bidsData || []) as Bid[];

      // fetch bidder profiles for these bids
      const bidderIds = Array.from(new Set(list.map((b) => b.user_id).filter(Boolean)));
      let biddersMap: Record<string, ProfileLite> = {};
      if (bidderIds.length) {
        const { data: users } = await supabase.from('profiles').select('id, full_name, avatar_url').in('id', bidderIds);
        (users || []).forEach((u: any) => (biddersMap[u.id] = { id: u.id, full_name: u.full_name, avatar_url: u.avatar_url }));
      }

      const withUsers = list.map((b) => ({ ...b, user: biddersMap[b.user_id] || null }));
      setBids(withUsers);
      setTopBid(withUsers.length ? withUsers[0].amount : it.starting_price ?? 0);
    } catch (e) {
      console.log('[auction] load error', e);
      setAuction(null);
      setBids([]);
      setTopBid(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  // countdown tick
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // initial load
  useEffect(() => {
    loadAuctionAndBids();
  }, [loadAuctionAndBids]);

  // realtime subscription to new bids for this item
  useEffect(() => {
    if (!id) return;
    try {
      if (subRef.current) supabase.removeChannel(subRef.current);
    } catch {}
    const channel = supabase
      .channel(`auction-bids-${id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'bids', filter: `item_id=eq.${id}` },
        (payload: any) => {
          const b: Bid = payload.new;
          (async () => {
            try {
              const { data: u } = await supabase.from('profiles').select('id, full_name, avatar_url').eq('id', b.user_id).maybeSingle();
              const enriched = { ...b, user: u || null };
              setBids((prev) => {
                const nxt = [enriched, ...prev].sort((a, z) => z.amount - a.amount || new Date(z.created_at || '').getTime() - new Date(a.created_at || '').getTime());
                return nxt;
              });
              setTopBid((prev) => (b.amount > (prev ?? 0) ? b.amount : prev));
            } catch (err) {
              console.log('[auction] realtime profile fetch err', err);
            }
          })();
        }
      )
      .subscribe();

    subRef.current = channel;
    return () => {
      try {
        if (subRef.current) supabase.removeChannel(subRef.current);
      } catch {}
    };
  }, [id]);

  const placeBid = useCallback(
    async (rawAmount?: string) => {
      if (!auction) return;
      if (!profile?.id) {
        Alert.alert('Sign in required', 'Please sign in to place a bid.');
        return;
      }
      const amount = rawAmount ? parseFloat(rawAmount) : parseFloat(bidInput);
      if (!isFinite(amount) || amount <= 0) {
        Alert.alert('Invalid bid', 'Please enter a valid number.');
        return;
      }
      const currentTop = topBid ?? auction.starting_price ?? 0;
      if (!(amount > currentTop)) {
        Alert.alert('Bid too low', `Your bid must be greater than the current top (${fmtMoney(currentTop)}).`);
        return;
      }
      if (profile.id === auction.seller_id) {
        Alert.alert("Can't bid", 'You cannot bid on your own auction.');
        return;
      }
      if (new Date(auction.ends_at).getTime() <= Date.now()) {
        Alert.alert('Auction ended', 'This auction has already ended.');
        await loadAuctionAndBids();
        return;
      }

      setPlacing(true);
      try {
        try {
          Haptics.selectionAsync();
        } catch {}
        const { error } = await supabase.from('bids').insert({
          user_id: profile.id,
          item_id: auction.id,
          amount,
        } as any);
        if (error) {
          console.log('[auction] place bid error', error);
          Alert.alert('Error', 'Could not place bid. Try again.');
          return;
        }
        setBidInput('');
        await loadAuctionAndBids();
      } catch (err) {
        console.log('[auction] placeBid exception', err);
        Alert.alert('Error', 'Unexpected error placing bid.');
      } finally {
        setPlacing(false);
      }
    },
    [auction, profile?.id, bidInput, topBid, loadAuctionAndBids]
  );

  const endAuctionNow = useCallback(async () => {
    if (!auction || !profile?.id) return;
    if (profile.id !== auction.seller_id) {
      Alert.alert("Not allowed", "Only the seller may end this auction early.");
      return;
    }
    Alert.alert('End auction', 'Do you want to end this auction now?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End now',
        style: 'destructive',
        onPress: async () => {
          setSavingEnd(true);
          try {
            const nowIso = new Date().toISOString();
            const { error } = await supabase.from('auction_items').update({ ends_at: nowIso }).eq('id', auction.id);
            if (error) {
              console.log('[auction] end update err', error);
              Alert.alert('Error', 'Could not end auction.');
              return;
            }
            await loadAuctionAndBids();
            Alert.alert('Ended', 'Auction has been ended.');
          } catch (err) {
            console.log('[auction] end exception', err);
            Alert.alert('Error', 'Unexpected error.');
          } finally {
            setSavingEnd(false);
          }
        },
      },
    ]);
  }, [auction, profile?.id, loadAuctionAndBids]);

  const isSeller = useMemo(() => auction && profile?.id === auction.seller_id, [auction, profile?.id]);

  const goToProfile = (userId?: string | null) => {
    if (!userId) {
      console.warn('[auction] no user id to navigate to profile');
      return;
    }
    // navigate to profile screen - adjust route if your app uses a different pattern
    try {
      router.push(`/profile/view/${userId}`);
    } catch (e) {
      console.log('[auction] navigation to profile error', e);
    }
  };

  if (!id) {
    return (
      <SafeAreaView style={s.containerCenter}>
        <Text style={s.msg}>No auction id provided.</Text>
      </SafeAreaView>
    );
  }

  if (loading || !auction) {
    return (
      <SafeAreaView style={s.containerCenter}>
        {loading ? <ActivityIndicator size="large" /> : <Text style={s.msg}>Auction not found.</Text>}
        <Pressable style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
          <Text style={{ color: '#fff', marginLeft: 8 }}>Back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const images = (auction.image_url || '').split('||').map((u) => u.trim()).filter(Boolean);
  const highest = topBid ?? auction.starting_price ?? 0;
  const ended = new Date(auction.ends_at).getTime() <= Date.now();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: undefined })} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
          {/* Back + seller row */}
          <View style={s.headerRow}>
            <Pressable onPress={() => router.back()} style={s.backIcon}>
              <Ionicons name="arrow-back" size={22} color="#111" />
            </Pressable>

            <Pressable
              onPress={() => goToProfile(auction.seller?.id ?? auction.seller_id)}
              style={s.sellerRow}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Image source={{ uri: auction.seller?.avatar_url || 'https://via.placeholder.com/48' }} style={s.sellerAvatar} />
              <View>
                <Text style={s.sellerName}>{auction.seller?.full_name || 'Seller'}</Text>
                <Text style={s.small}>{`Posted ${new Date(auction.created_at || '').toLocaleString()}`}</Text>
              </View>
            </Pressable>

            <View style={{ flex: 1 }} />
            {isSeller ? (
              <Pressable style={s.sellerAction} onPress={endAuctionNow} disabled={savingEnd}>
                <Ionicons name="stop-circle" size={18} color="#fff" />
                <Text style={s.sellerActionText}>{savingEnd ? 'Ending...' : 'End Auction'}</Text>
              </Pressable>
            ) : null}
          </View>

          {/* Carousel */}
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={s.carousel}>
            {(images.length ? images : ['https://via.placeholder.com/800']).map((uri, i) => (
              <Image key={uri + i} source={{ uri }} style={s.carouselImage} />
            ))}
          </ScrollView>

          {/* Title + meta */}
          <View style={s.card}>
            <Text style={s.title}>{auction.title}</Text>
            <View style={s.rowBetween}>
              <View>
                <Text style={s.sub}>Starting</Text>
                <Text style={s.big}>{fmtMoney(auction.starting_price)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={s.sub}>Top Bid</Text>
                <Text style={s.big}>{fmtMoney(highest)}</Text>
              </View>
            </View>

            <View style={[s.rowBetween, { marginTop: 8 }]}>
              <Text style={s.small}>Time left: {getTimeLeftStr(auction.ends_at)}</Text>
              <Text style={s.small}>{ended ? 'Ended' : `Ends: ${new Date(auction.ends_at).toLocaleString()}`}</Text>
            </View>

            {/* Place bid UI */}
            <View style={{ marginTop: 12 }}>
              <Text style={[s.sub, { marginBottom: 8 }]}>Place a bid</Text>
              <View style={s.bidRow}>
                <TextInput
                  placeholder={`Enter amount > ${highest}`}
                  placeholderTextColor="#666"
                  keyboardType="numeric"
                  value={bidInput}
                  onChangeText={setBidInput}
                  style={s.bidInput}
                  editable={!ended && !isSeller && !!profile?.id && !placing}
                />
                <Pressable
                  style={[s.bidBtn, (ended || isSeller || !profile?.id || placing) && { opacity: 0.6 }]}
                  disabled={ended || isSeller || !profile?.id || placing}
                  onPress={() => placeBid(bidInput)}
                >
                  {placing ? <ActivityIndicator color="#fff" /> : <Text style={s.bidBtnText}>{isSeller ? 'Seller' : profile?.id ? 'Place bid' : 'Sign in'}</Text>}
                </Pressable>
              </View>
              {isSeller ? <Text style={[s.small, { marginTop: 6 }]}>As the seller you can view bidder names and end the auction early.</Text> : null}
            </View>

            {/* Top bids (brief) */}
            <View style={{ marginTop: 14 }}>
              <Text style={[s.sub, { marginBottom: 6 }]}>Top bids</Text>
              {bids.length ? (
                bids.slice(0, 5).map((b, i) => (
                  <Pressable
                    key={b.id}
                    style={s.bidItem}
                    onPress={() => goToProfile(b.user?.id)}
                    android_ripple={{ color: '#eee' }}
                  >
                    <View style={s.bidLeft}>
                      <Image source={{ uri: b.user?.avatar_url || 'https://via.placeholder.com/40' }} style={s.bidAvatar} />
                      <View style={{ marginLeft: 10 }}>
                        <Text style={{ fontWeight: '800' }}>{b.user?.full_name ?? `User ${b.user_id?.slice?.(0, 6) ?? ''}`}</Text>
                        <Text style={s.small}>{new Date(b.created_at || '').toLocaleString()}</Text>
                      </View>
                    </View>
                    <Text style={{ fontWeight: '900' }}>{fmtMoney(b.amount)}</Text>
                  </Pressable>
                ))
              ) : (
                <Text style={s.small}>No bids yet</Text>
              )}
            </View>

            {/* Seller full bidders list (only visible to seller) */}
            {isSeller ? (
              <View style={{ marginTop: 16 }}>
                <Text style={[s.sub, { marginBottom: 8 }]}>All bidders</Text>
                {bids.length ? (
                  bids.map((b) => (
                    <Pressable
                      key={`bidder-${b.id}`}
                      style={s.bidderRow}
                      onPress={() => goToProfile(b.user?.id)}
                      android_ripple={{ color: '#f2f2f2' }}
                    >
                      <Image source={{ uri: b.user?.avatar_url || 'https://via.placeholder.com/40' }} style={s.bidderAvatar} />
                      <View style={{ marginLeft: 10, flex: 1 }}>
                        <Text style={{ fontWeight: '800' }}>{b.user?.full_name ?? 'User'}</Text>
                        <Text style={s.small}>GHS {b.amount} · {new Date(b.created_at || '').toLocaleString()}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color="#999" />
                    </Pressable>
                  ))
                ) : (
                  <Text style={s.small}>No bidders yet</Text>
                )}
              </View>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  page: { paddingBottom: 40, backgroundColor: '#fff' },
  containerCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  msg: { fontSize: 16, color: '#666', marginBottom: 12 },
  backBtn: { marginTop: 16, padding: 10, backgroundColor: '#333', borderRadius: 8, flexDirection: 'row', alignItems: 'center' },

  headerRow: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#eee', backgroundColor: '#fff' },
  backIcon: { padding: 6, marginRight: 6 },
  sellerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sellerAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#ddd' },
  sellerName: { fontWeight: '900', fontSize: 16 },
  sellerAction: { backgroundColor: '#d9534f', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, flexDirection: 'row', alignItems: 'center' },
  sellerActionText: { color: '#fff', fontWeight: '900', marginLeft: 8 },

  carousel: { backgroundColor: '#000' },
  carouselImage: { width, height: Math.round(width * 1.2), resizeMode: 'cover' },

  card: { padding: 14, backgroundColor: '#fff', borderRadius: 8, margin: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  title: { fontSize: 20, fontWeight: '900', marginBottom: 8 },
  sub: { color: '#666', fontWeight: '800' },
  big: { fontSize: 18, fontWeight: '900' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  bidRow: { flexDirection: 'row', alignItems: 'center' },
  bidInput: { flex: 1, borderWidth: 1, borderColor: '#eee', borderRadius: 10, paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 12 : 8, color: '#111' },
  bidBtn: { marginLeft: 10, backgroundColor: '#1976d2', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  bidBtnText: { color: '#fff', fontWeight: '900' },

  bidItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#f1f1f1' },
  bidLeft: { flexDirection: 'row', alignItems: 'center' },
  bidAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#ddd' },

  bidderRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#f2f2f2' },
  bidderAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#ddd' },

  small: { color: '#777', fontSize: 12 },
});
