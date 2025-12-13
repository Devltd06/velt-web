// app/(tabs)/market.tsx
import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Dimensions,
  StatusBar,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Video } from 'expo-av';
import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';
import NotificationBanner from 'components/NotificationsBanner';
import MapView, { Marker } from 'react-native-maps';
import BottomSheet from '@gorhom/bottom-sheet';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useProfileStore } from '@/lib/store/profile';
import Constants from 'expo-constants';
import { useFocusEffect } from '@react-navigation/native';
import NetInfo from '@react-native-community/netinfo';
import { useMarketTheme } from '@/utils/marketTheme';
import { publicUrlFromShopr, publicUrlFromBucket } from '@/lib/storage';
import { useCustomAlert } from '@/components/CustomAlert';
import { VELT_ACCENT, BUTTON_COLORS, GRADIENTS } from 'app/themes';

const { width } = Dimensions.get('window');
// Make hero slides full width (edge-to-edge)
const HERO_REDUCTION = 0; // no reduction — slides will be full device width
const HERO_SLIDE_GAP = 0; // no gap between slides
const HERO_SLIDE_WIDTH = width; // actual visible slide width (full device width)
const HERO_PAGE_SIZE = HERO_SLIDE_WIDTH + HERO_SLIDE_GAP; // page advance step for snapping/offset (now equal to device width)

const RATE_CACHE_KEY = 'user:currency_rate_cache';
const BASE_CURRENCY = 'GHS';


/* ----------------- Country -> Currency map for Africa ----------------- */
const COUNTRY_TO_CURRENCY: Record<string, string> = {
  GH: 'GHS',
  NG: 'NGN',
  CI: 'XOF',
  SN: 'XOF',
  BF: 'XOF',
  ML: 'XOF',
  TG: 'XOF',
  BJ: 'XOF',
  LR: 'LRD',
  SL: 'SLL',
  KE: 'KES',
  UG: 'UGX',
  TZ: 'TZS',
  RW: 'RWF',
  ET: 'ETB',
  SO: 'SOS',
  ZA: 'ZAR',
  ZM: 'ZMW',
  MW: 'MWK',
  MZ: 'MZN',
  SZ: 'SZL',
  LS: 'LSL',
  EG: 'EGP',
  MA: 'MAD',
  TN: 'TND',
  DZ: 'DZD',
  LY: 'LYD',
  CM: 'XAF',
  CD: 'CDF',
};

const CURRENCY_SYMBOL: Record<string, string> = {
  GHS: 'GHS',
  NGN: '₦',
  KES: 'KSh',
  ZAR: 'R',
  USD: '$',
  EUR: '€',
  XOF: 'XOF',
  XAF: 'XAF',
  EGP: 'EGP',
  MAD: 'MAD',
  TND: 'TND',
  DZD: 'DZD',
  ETB: 'ETB',
  UGX: 'UGX',
  RWF: 'RWF',
  CDF: 'CDF',
  MZN: 'MZN',
};

/* ----------------- Helpers: currency detection & rate fetching ----------------- */
async function detectCountryByLocation(): Promise<string | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const pos = await Location.getCurrentPositionAsync({});
    const rev = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
    if (Array.isArray(rev) && rev.length > 0) {
      const first = rev[0] as any;
      const iso = first?.isoCountryCode as string | undefined;
      if (iso) return iso.toUpperCase();
    }
  } catch (e) {
    // ignore
  }
  return null;
}

function detectCountryByLocale(): string | null {
  try {
    const loc = Intl.DateTimeFormat().resolvedOptions().locale || '';
    const parts = loc.replace('-', '_').split('_');
    const region = parts.length > 1 ? parts[1] : null;
    if (region) return region.toUpperCase();
  } catch {}
  return null;
}

async function fetchRateForCurrency(targetCurrency: string): Promise<{ rate: number; ts: number } | null> {
  try {
    if (!targetCurrency || targetCurrency === BASE_CURRENCY) return { rate: 1, ts: Date.now() };
    const url = `https://api.exchangerate.host/latest?base=${BASE_CURRENCY}&symbols=${targetCurrency}`;
    const resp = await fetch(url, { method: 'GET' });
    if (!resp.ok) return null;
    const j = await resp.json();
    const rate = j?.rates?.[targetCurrency];
    if (typeof rate === 'number') return { rate, ts: Date.now() };
  } catch (e) {
    console.warn('[fetchRateForCurrency] error', e);
  }
  return null;
}

async function getCachedRate(targetCurrency: string) {
  try {
    const raw = await AsyncStorage.getItem(RATE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.currency === targetCurrency && typeof parsed?.rate === 'number') return parsed;
  } catch {}
  return null;
}

async function setCachedRate(targetCurrency: string, rate: number) {
  try {
    await AsyncStorage.setItem(RATE_CACHE_KEY, JSON.stringify({ currency: targetCurrency, rate, ts: Date.now() }));
  } catch {}
}

/* ----------------- Market Screen ----------------- */

export default function MarketScreen() {
  const { colors, refresh } = useMarketTheme();
  const { showAlert } = useCustomAlert();

  useFocusEffect(
    useCallback(() => {
      (async () => {
        await refresh();
      })();
    }, [refresh])
  );

  const { profile } = useProfileStore();

  const [banner, setBanner] = useState<{ visible: boolean; title?: string; body?: string; onPress?: () => void }>({ visible: false });
  const TOP_INSET = Platform.OS === 'ios' ? 44 : (StatusBar.currentHeight ?? 12);

  useEffect(() => {
    if (!profile?.id) return;
    let mounted = true;
    const ch = supabase
      .channel(`shopr-notifs:${profile.id}`)
      .on('postgres_changes', { schema: 'public', table: 'notifications', event: 'INSERT', filter: `recipient=eq.${profile.id}` }, (payload: any) => {
        if (!mounted) return;
        const n = payload?.new;
        if (!n) return;
        setBanner({
          visible: true,
          title: n.title ?? (n.type === 'message_received' ? 'New message' : 'Notification'),
          body: n.body ?? '',
          onPress: () => {
            setBanner((s) => ({ ...s, visible: false }));
            const p = n.data ?? {};
            if (p?.conversation_id) router.push(`/message/chat/${p.conversation_id}`);
            else if (p?.screen && p?.params) router.push({ pathname: p.screen, params: p.params });
          },
        });
      })
      .subscribe();

    return () => {
      mounted = false;
      try { ch.unsubscribe(); } catch {}
    };
  }, [profile?.id]);

  const [products, setProducts] = useState<any[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const [auctions, setAuctions] = useState<any[]>([]);
  const [heroMedia, setHeroMedia] = useState<any[]>([]);
  const [heroLoading, setHeroLoading] = useState(false);
  const [activeHeroIndex, setActiveHeroIndex] = useState(0);
  const heroListRef = useRef<FlatList<any> | null>(null);
  const isHeroInteractingRef = useRef(false);
  const searchInputRef = useRef<TextInput | null>(null);
  const [auctionBids, setAuctionBids] = useState<Record<string, any[]>>({});
  const [topBidMap, setTopBidMap] = useState<Record<string, number>>({});
  const [loadingAuctions, setLoadingAuctions] = useState(false);

  // Skeleton shimmer animation
  const skeletonAnim = useRef(new Animated.Value(0)).current;
  // Content fade-in animation
  const contentFadeAnim = useRef(new Animated.Value(0)).current;
  const [contentReady, setContentReady] = useState(false);
  // Track main loading state
  const [initialLoading, setInitialLoading] = useState(true);

  const [sheetIndex, setSheetIndex] = useState(-1);
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['90%'], []);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  const [isConnected, setIsConnected] = useState(true);
  const [showOfflineHeader, setShowOfflineHeader] = useState(false);
  const offlineHeaderTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [detectedCountry, setDetectedCountry] = useState<string | null>(null);
  const [currencyCode, setCurrencyCode] = useState<string>(BASE_CURRENCY);
  const [currencyRate, setCurrencyRate] = useState<number>(1);
  const [rateLoading, setRateLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>('popular');
  const quickFilters = useMemo(
    () => [
      { key: 'popular', label: 'Trending', icon: 'flame-outline' as const },
      { key: 'new', label: 'New', icon: 'sparkles-outline' as const },
      { key: 'value', label: 'Under ₵200', icon: 'cash-outline' as const },
    ],
    []
  );

  const distanceKm = useCallback((lat1?: number, lon1?: number, lat2?: number, lon2?: number) => {
    const isValid = (val?: number): val is number => typeof val === 'number' && Number.isFinite(val);
    if (!isValid(lat1) || !isValid(lon1) || !isValid(lat2) || !isValid(lon2)) {
      return Number.POSITIVE_INFINITY;
    }

    const latStart = lat1 as number;
    const lonStart = lon1 as number;
    const latEnd = lat2 as number;
    const lonEnd = lon2 as number;

    const toRad = (v: number) => (v * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(latEnd - latStart);
    const dLon = toRad(lonEnd - lonStart);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(latStart)) * Math.cos(toRad(latEnd)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }, []);

  const applyFilters = useCallback(
    (text: string, allProducts: any[], filterKey: string = activeFilter) => {
      const keyword = (text || '').toLowerCase();
      const basePrice = (product: any) => Number(product.price ?? product.starting_price ?? 0) || 0;
      let filtered = allProducts.filter((product) => (product.title || '').toLowerCase().includes(keyword));

      switch (filterKey) {
        case 'new':
          filtered = [...filtered].sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
          break;
        case 'value':
          filtered = filtered.filter((product) => basePrice(product) <= 200);
          break;
        case 'nearby':
          if (userLocation) {
            filtered = [...filtered].sort((a, b) => {
              const distA = distanceKm(
                userLocation.latitude,
                userLocation.longitude,
                Number(a.latitude),
                Number(a.longitude)
              );
              const distB = distanceKm(
                userLocation.latitude,
                userLocation.longitude,
                Number(b.latitude),
                Number(b.longitude)
              );
              return distA - distB;
            });
          }
          break;
        case 'popular':
        default:
          filtered = [...filtered].sort((a, b) => basePrice(b) - basePrice(a));
          break;
      }

      setFilteredProducts(filtered);
    },
    [activeFilter, distanceKm, userLocation]
  );

  useEffect(() => {
    const sub = NetInfo.addEventListener((s) => {
      const connected = Boolean(s.isConnected);
      setIsConnected(connected);
      if (!connected) {
        setShowOfflineHeader(true);
        if (offlineHeaderTimeoutRef.current) {
          clearTimeout(offlineHeaderTimeoutRef.current);
        }
        offlineHeaderTimeoutRef.current = setTimeout(() => {
          setShowOfflineHeader(false);
        }, 5000);
      } else {
        if (offlineHeaderTimeoutRef.current) {
          clearTimeout(offlineHeaderTimeoutRef.current);
          offlineHeaderTimeoutRef.current = null;
        }
        setShowOfflineHeader(false);
      }
    });
    return () => {
      sub();
      if (offlineHeaderTimeoutRef.current) {
        clearTimeout(offlineHeaderTimeoutRef.current);
      }
    };
  }, []);

  // load hero media from the 'shopr' storage bucket 'updates' path
  const fetchHeroMedia = async () => {
    // If user is actively swiping through hero, avoid replacing the list mid-interaction
    if (isHeroInteractingRef.current) {
      console.debug('[Shopr] fetchHeroMedia skipped while user is interacting with hero');
      return;
    }
    try {
      setHeroLoading(true);
      // read highlights metadata from the shopr_highlights table and resolve urls
      const { data, error } = await supabase
        .from('shopr_highlights')
        .select('id, file_name, storage_path, bucket, title, is_public, created_at')
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) {
        console.warn('hero media db read error', error);
        return;
      }
      if (!Array.isArray(data)) return;

      const mapped = data.map((it: any) => ({ name: it.file_name, path: it.storage_path, bucket: it.bucket ?? 'updates', updated_at: it.created_at, title: it.title }));

      console.debug('[Shopr] hero fetch - raw records', mapped);

      // resolve public URLs
      const withUrls = mapped.map((m: any) => ({ ...m, url: publicUrlFromBucket(m.bucket ?? 'updates', m.path) }));
      console.debug('[Shopr] hero fetch - after publicUrlFromBucket', withUrls);
      // if any items don't have a public url, attempt a signed URL for private buckets
      const missing = withUrls.filter((w: any) => !w.url);
      if (missing.length > 0) {
        // lazy import signed helper to avoid circular issues
        const { signedUrlFromBucket, signedUrlCacheStats } = await import('@/lib/storage');
        await Promise.all(
          missing.map(async (it: any) => {
            try {
              // request a longer-lived signed url so our local cache can be effective
              const signed = await signedUrlFromBucket('updates', it.path, 3600);
              if (signed) {
                it.url = signed;
                console.debug('[Shopr] signed url obtained for', it.path, signedUrlCacheStats?.());
              } else {
                console.debug('[Shopr] no signed url for', it.path);
              }
              try { console.debug('[Shopr] signed-url fallback', it.path, Boolean(signed), signedUrlCacheStats?.()); } catch {}
            } catch (e) {}
          })
        );
      }
      setHeroMedia(withUrls.filter((i: any) => i.url));
    } catch (e) {
      console.warn('fetchHeroMedia error', e);
    }
    finally {
      setHeroLoading(false);
    }
  };

  // initial load
  useEffect(() => {
    (async () => {
      await Promise.all([fetchProducts(), loadAuctions(), initDetectCurrency(), fetchHeroMedia()]);
      setInitialLoading(false);
    })();
    // listen for highlights being inserted so banner refreshes automatically
    const chHighlights = supabase
      .channel('realtime:shopr_highlights')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'shopr_highlights' }, (payload: any) => {
        try {
          console.debug('[Shopr] shopr_highlights INSERT event — refreshing hero media', payload?.new);
          fetchHeroMedia();
        } catch (e) { console.warn('[Shopr] fetchHeroMedia on event failed', e); }
      })
      .subscribe();
    getUserLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { try { chHighlights.unsubscribe(); } catch {} };
  }, []);

  // Skeleton shimmer effect
  useEffect(() => {
    if (initialLoading) {
      const shimmer = Animated.loop(
        Animated.sequence([
          Animated.timing(skeletonAnim, { toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver: true }),
          Animated.timing(skeletonAnim, { toValue: 0, duration: 1000, easing: Easing.linear, useNativeDriver: true }),
        ])
      );
      shimmer.start();
      return () => shimmer.stop();
    }
  }, [initialLoading, skeletonAnim]);

  // Fade in content when data is ready
  useEffect(() => {
    if (!initialLoading && !contentReady) {
      setContentReady(true);
      Animated.timing(contentFadeAnim, { toValue: 1, duration: 400, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    }
  }, [initialLoading, contentReady, contentFadeAnim]);

  // subscribe to products updates so stock changes show up live in the listings
  useEffect(() => {
    let mounted = true;
    const ch = supabase
      .channel('realtime:products')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'products' },
        (payload: any) => {
          if (!mounted) return;
          const n = payload?.new;
          if (!n) return;
          setProducts((prev) => {
            const found = prev.find((p) => p.id === n.id);
            if (found) return prev.map((p) => (p.id === n.id ? { ...p, ...n } : p));
            return [n, ...prev];
          });
          setFilteredProducts((prev) => prev.map((p) => (p.id === n.id ? { ...p, ...n } : p)));
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'products' },
        (payload: any) => {
          if (!mounted) return;
          const n = payload?.new;
          if (!n) return;
          setProducts((prev) => [n, ...prev]);
          setFilteredProducts((prev) => [n, ...prev]);
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'products' },
        (payload: any) => {
          if (!mounted) return;
          const old = payload?.old;
          if (!old) return;
          setProducts((prev) => prev.filter((p) => p.id !== old.id));
          setFilteredProducts((prev) => prev.filter((p) => p.id !== old.id));
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      try { ch.unsubscribe(); } catch (e) {}
    };
  }, []);

  // keep carousel position stable when heroMedia changes (don't snap back unexpectedly)
  useEffect(() => {
    try {
      if (!heroListRef.current || !heroMedia || heroMedia.length === 0) return;
      const idx = Math.max(0, Math.min(activeHeroIndex, heroMedia.length - 1));
      const offset = idx * HERO_PAGE_SIZE;
      heroListRef.current.scrollToOffset({ offset, animated: false });
      // ensure active index remains valid
      setActiveHeroIndex(idx);
    } catch (e) {
      // ignore
    }
  }, [heroMedia]);

  // autoplay hero slides (don't autoplay when user is touching/swiping)
  useEffect(() => {
    if (!heroMedia || heroMedia.length <= 1) return;
    const DELAY = 4500;
    const timer = setInterval(() => {
      try {
        if (isHeroInteractingRef.current) return; // pause while interacting
        if (!heroListRef.current) return;
        setActiveHeroIndex((prev) => {
          const next = (prev + 1) % heroMedia.length;
          try {
            const offset = next * HERO_PAGE_SIZE;
            heroListRef.current?.scrollToOffset({ offset, animated: true });
          } catch {}
          return next;
        });
      } catch (e) {
        // ignore
      }
    }, DELAY);

    return () => clearInterval(timer);
  }, [heroMedia]);

  useEffect(() => {
    applyFilters(query, products, activeFilter);
  }, [query, products, activeFilter, applyFilters]);

  const fetchProducts = async () => {
    try {
      // Remove all references to stores from product fetch and UI
      let data: any = null;
      let error: any = null;
      // select a safe set of product columns — don't attempt to join to profile/store relations
      // NOTE: do NOT request latitude/longitude if the products table doesn't have those columns
      const selectWithoutStores = "id, sku, title, description, price, images, size, color, material, brand, category, stock, created_at";

      try {
        const res = await supabase.from('products').select(selectWithoutStores).order('created_at', { ascending: false });
        data = res.data;
        error = res.error;
      } catch (e) {
        error = e;
      }

      if (!error && data) {
        setProducts(data);
        setFilteredProducts(data);
      } else {
        console.error('Error fetching products:', error?.message ?? error);
      }
    } catch (err) {
      console.error('fetchProducts exception', err);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchProducts(), loadAuctions(), initDetectCurrency()]);
    } finally {
      setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFilterChange = useCallback(
    (key: string) => {
      setActiveFilter(key);
      applyFilters(query, products, key);
    },
    [applyFilters, products, query]
  );

  const handleAvatarPress = useCallback(async () => {
    // route to the user's storefront if they have one, otherwise profile
    try {
      if (!profile?.id) return router.push('/home/profile');
      const { data: store, error } = await supabase.from('stores').select('id').eq('owner_id', profile.id).limit(1).maybeSingle();
      if (!error && store && (store as any).id) {
        // go to their store
        router.push({ pathname: '/market/store/[id]', params: { id: (store as any).id } });
      } else {
        router.push('/home/profile');
      }
    } catch (e) {
      // fallback to profile
      if (profile?.id) router.push({ pathname: '/profile/view/[id]', params: { id: profile.id } });
      else router.push('/home/profile');
    }
  }, [profile?.id, router]);

  const handleOpenProduct = (item: any) => {
    router.push({
      pathname: '/market/product-details',
      params: { id: item.id },
    } as any);
  };

  const getUserLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const location = await Location.getCurrentPositionAsync({});
      setUserLocation({ latitude: location.coords.latitude, longitude: location.coords.longitude });
    } catch (e) {
      console.log('getUserLocation error', e);
    }
  };

  /* ------------------ Auctions loader ------------------ */
  const loadAuctions = useCallback(
    async () => {
      setLoadingAuctions(true);
      try {
        const nowIso = new Date().toISOString();
        const { data, error } = await supabase
          .from('auction_items')
          .select('id, seller_id, title, image_url, starting_price, ends_at, created_at')
          .gt('ends_at', nowIso)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) {
          setAuctions([]);
          setAuctionBids({});
          setTopBidMap({});
          return;
        }
        const items = (data || []) as any[];

        const sellerIds = Array.from(new Set(items.map((it) => it.seller_id).filter(Boolean)));
        let sellersMap: Record<string, any> = {};
        if (sellerIds.length) {
          const { data: sellers } = await supabase.from('profiles').select('id, full_name, avatar_url').in('id', sellerIds);
          (sellers || []).forEach((s: any) => (sellersMap[s.id] = s));
        }
        items.forEach((it) => (it.seller = sellersMap[it.seller_id] || null));

        const itemIds = items.map((it) => it.id);
        let bidsMap: Record<string, any[]> = {};
        let topMap: Record<string, number> = {};
        if (itemIds.length) {
          const { data: bids } = await supabase
            .from('bids')
            .select('id, user_id, item_id, amount, created_at')
            .in('item_id', itemIds)
            .order('amount', { ascending: false });

          const bidderIds = Array.from(new Set((bids || []).map((b: any) => b.user_id).filter(Boolean)));
          let biddersMap: Record<string, any> = {};
          if (bidderIds.length) {
            const { data: users } = await supabase.from('profiles').select('id, full_name, avatar_url').in('id', bidderIds);
            (users || []).forEach((u: any) => (biddersMap[u.id] = u));
          }

          (bids || []).forEach((b: any) => {
            const it = b.item_id;
            if (!bidsMap[it]) bidsMap[it] = [];
            bidsMap[it].push({ ...b, user: biddersMap[b.user_id] || null });
            const val = Number(b.amount ?? 0);
            if (!topMap[it] || val > topMap[it]) topMap[it] = val;
          });
        }

        items.forEach((it) => {
          if (!topMap[it.id]) topMap[it.id] = it.starting_price ?? 0;
        });

        const myId = profile?.id ?? null;
        const myAuctions = items.filter((it) => myId && it.seller_id === myId);
        const otherAuctions = items.filter((it) => !(myId && it.seller_id === myId));
        const ordered = [...myAuctions, ...otherAuctions];

        setAuctions(ordered);
        setAuctionBids(bidsMap);
        setTopBidMap(topMap);
      } catch (e) {
        console.log('[loadAuctions] exception', e);
        setAuctions([]);
        setAuctionBids({});
        setTopBidMap({});
      } finally {
        setLoadingAuctions(false);
      }
    },
    [profile?.id]
  );

  /* ---------------- currency init ---------------- */
  async function initDetectCurrency() {
    setRateLoading(true);
    try {
      let countryCode = await detectCountryByLocation();
      if (!countryCode) {
        countryCode = detectCountryByLocale() || null;
      }
      setDetectedCountry(countryCode);

      const target = (countryCode && COUNTRY_TO_CURRENCY[countryCode]) ? COUNTRY_TO_CURRENCY[countryCode] : BASE_CURRENCY;
      setCurrencyCode(target);

      const cache = await getCachedRate(target);
      const now = Date.now();
      const TTL = 12 * 60 * 60 * 1000;
      if (cache && cache.ts && (now - cache.ts) < TTL) {
        setCurrencyRate(cache.rate);
        setRateLoading(false);
        return;
      }

      if (!isConnected) {
        setCurrencyRate(cache?.rate ?? 1);
        setRateLoading(false);
        return;
      }

      const fetched = await fetchRateForCurrency(target);
      if (fetched) {
        setCurrencyRate(fetched.rate);
        await setCachedRate(target, fetched.rate);
      } else {
        setCurrencyRate(cache?.rate ?? 1);
      }
    } catch (e) {
      console.warn('[initDetectCurrency] err', e);
      setCurrencyCode(BASE_CURRENCY);
      setCurrencyRate(1);
    } finally {
      setRateLoading(false);
    }
  }

  function formatPriceBaseToLocal(baseAmount?: number | string) {
    try {
      const n = typeof baseAmount === 'number' ? baseAmount : Number(baseAmount ?? 0);
      if (Number.isNaN(n)) return '—';
      const converted = n * (currencyRate ?? 1);
      const sym = CURRENCY_SYMBOL[currencyCode] ?? currencyCode;
      return `${sym} ${converted.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    } catch {
      return '—';
    }
  }

  /* ---------------- layout helpers ---------------- */
  const CARD_MARGIN = 12;
  const CARD_WIDTH = Math.floor((width - CARD_MARGIN * 3) / 2);

  const ProductCard: React.FC<{ item: any }> = ({ item }) => {
    const images = (item.images && Array.isArray(item.images) && item.images.length)
      ? item.images
      : String(item.image_url || item.images || '').split('||').map((s: string) => s.trim()).filter(Boolean);
    const raw = images[0] || 'https://via.placeholder.com/400';
    const image = publicUrlFromShopr(raw) || raw;
    // All products are from VELT
    const sellerName = 'VELT';
    const sellerAvatar = 'https://via.placeholder.com/40';
    const [adding, setAdding] = React.useState(false);
    const handleAddToCart = async () => {
      if (!profile?.id) {
        showAlert({ title: 'Sign in required', message: 'Please sign in to add to cart.' });
        return;
      }
      setAdding(true);
      try {
        const { data: cartRes, error } = await supabase.from('carts').insert({
          user_id: profile.id,
          product_id: item.id,
        }).select('*').maybeSingle();
        if (error) {
          console.warn('addToCart error', error);
          showAlert({ title: 'Error', message: error.message || 'Could not add to cart.' });
        } else {
          showAlert({ title: 'Added', message: 'Product added to cart!' });
        }
      } catch (err) {
        showAlert({ title: 'Error', message: 'Unexpected error adding to cart.' });
      } finally {
        setAdding(false);
      }
    };

    // Remove store logic, use VELT branding only
    return (
      <TouchableOpacity
        style={[
          styles.productCard,
          {
            width: CARD_WIDTH,
            backgroundColor: colors.card,
            borderColor: colors.border,
            shadowColor: '#000',
          },
        ]}
        onPress={() => handleOpenProduct(item)}
        activeOpacity={0.95}
      >
        <View style={styles.imageWrap}>
          <Image source={{ uri: image }} style={[styles.productImage]} />
          <TouchableOpacity style={[styles.favBtn, { backgroundColor: colors.faint }]}> 
            <Ionicons name="heart-outline" size={18} color={colors.text} />
          </TouchableOpacity>
        </View>
        <View style={{ paddingHorizontal: 8, paddingVertical: 10, width: '100%' }}>
          <Text numberOfLines={2} style={[styles.productTitle, { color: colors.text }]}>{item.title}</Text>
          {/* Professional attributes */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 }}>
            {item.sku && <Text style={{ color: colors.subtext, fontWeight: '700', marginRight: 10 }}>SKU: {item.sku}</Text>}
            {item.size && <Text style={{ color: colors.subtext, marginRight: 10 }}>Size: {item.size}</Text>}
            {item.color && <Text style={{ color: colors.subtext, marginRight: 10 }}>Color: {item.color}</Text>}
            {item.material && <Text style={{ color: colors.subtext, marginRight: 10 }}>Material: {item.material}</Text>}
            {item.brand && <Text style={{ color: colors.subtext, marginRight: 10 }}>Brand: {item.brand}</Text>}
            {typeof item.stock === 'number' && <Text style={{ color: colors.subtext, marginRight: 10 }}>Stock: {item.stock}</Text>}
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            <Text style={[styles.productPrice, { color: colors.accent }]}>{formatPriceBaseToLocal(item.price ?? item.starting_price)}</Text>

            <TouchableOpacity
              onPress={handleAddToCart}
              style={[styles.addCartBtn, { backgroundColor: colors.accent }]}
              disabled={adding}
            >
              <Ionicons name="cart-outline" size={16} color="#fff" />
              <Text style={{ color: '#fff', marginLeft: 6, fontWeight: '700' }}>{adding ? 'Adding...' : 'Add'}</Text>
            </TouchableOpacity>
          </View>

          {/* seller avatar/name intentionally removed to keep product cards concise */}
        </View>
      </TouchableOpacity>
    );
  };

  const AuctionCardCompact: React.FC<{ item: any }> = ({ item }) => {
    const bidders = auctionBids[item.id] || [];
    const top = topBidMap[item.id] ?? item.starting_price ?? 0;
    const images = (item.image_url || '').split('||').map((s: string) => s.trim()).filter(Boolean);

    return (
      <TouchableOpacity
        activeOpacity={0.95}
        onPress={() => router.push(`/market/auctions/${item.id}`)}
        style={[styles.auctionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <Image
          source={{ uri: publicUrlFromShopr(images[0]) || images[0] || 'https://via.placeholder.com/320' }}
          style={[styles.auctionImage, { height: 100, width: 100 }]}
        />
        <View style={{ flex: 1, paddingHorizontal: 10, paddingVertical: 6 }}>
          <Text numberOfLines={2} style={[styles.auctionTitle, { color: colors.text }]}>{item.title}</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
            <Text style={{ color: colors.subtext, fontWeight: '700' }}>{formatPriceBaseToLocal(item.starting_price)}</Text>
            <Text style={{ color: colors.text, fontWeight: '900' }}>{formatPriceBaseToLocal(top)}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, alignItems: 'center' }}>
            <Text style={{ color: colors.subtext, fontSize: 12 }}>{timeLeft(item.ends_at)}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {bidders.slice(0, 4).map((b: any, idx: number) => (
                <Image
                  key={`${item.id}-bid-${b.id}-${idx}`}
                  source={{ uri: b.user?.avatar_url || 'https://via.placeholder.com/32' }}
                  style={[styles.bidAvatar, { marginLeft: idx === 0 ? 0 : -8 }]}
                />
              ))}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  function timeLeft(iso: string) {
    try {
      const ms = new Date(iso).getTime() - Date.now();
      if (ms <= 0) return 'Ended';
      const d = Math.floor(ms / (24 * 3600e3));
      const h = Math.floor((ms % (24 * 3600e3)) / 3600e3);
      const m = Math.floor((ms % 3600e3) / 60e3);
      if (d > 0) return `${d}d ${h}h`;
      if (h > 0) return `${h}h ${m}m`;
      return `${m}m`;
    } catch {
      return '';
    }
  }

  /* ---------------- Header (memoized JSX element) ---------------- */
  const headerElement = useMemo(() => {
    const totalListings = filteredProducts.length;
    const liveAuctions = auctions.length;

    // cleaner, professional header layout — left avatar, center title, right compact icon group
    return (
      <View>
        {showOfflineHeader ? (
          <View style={{ paddingHorizontal: 12, paddingTop: 10, paddingBottom: 6, backgroundColor: '#F97316' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 8 }}>
              <Ionicons name="cloud-offline-outline" size={20} color="#fff" />
              <Text style={{ fontWeight: '800', fontSize: 18, color: '#fff' }}>Offline</Text>
            </View>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 12, paddingTop: 10, paddingBottom: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flex: 1 }}>
              {/* Left: user avatar */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <TouchableOpacity onPress={handleAvatarPress} style={[styles.topBtn, { borderRadius: 999 }] }>
                  <Image
                    source={{ uri: profile?.avatar_url || 'https://via.placeholder.com/40' }}
                    style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: colors.border }}
                  />
                </TouchableOpacity>
                <View>
                  <Text style={{ fontWeight: '800', fontSize: 18, color: colors.text }}>Shopr</Text>
                  <Text style={{ color: colors.subtext, fontSize: 12 }}>Market & Brands</Text>
                </View>
              </View>

              {/* Right: compact action icons (flattened, no extra wrapper beyond this row) */}
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TouchableOpacity
                  onPress={() => router.push('/market/auctions/Auctions')}
                  style={[styles.iconBtn, { borderColor: colors.border, backgroundColor: colors.bg, borderRadius: 999 }]}
                  accessibilityLabel="Open auctions"
                >
                  <Ionicons name="pricetag-outline" size={20} color={colors.text} />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => router.push('/market/Carts')}
                  style={[styles.iconBtn, { borderColor: colors.border, backgroundColor: colors.bg, borderRadius: 999 }]}
                  accessibilityLabel="View cart"
                >
                  <Ionicons name="cart-outline" size={20} color={colors.text} />
                </TouchableOpacity>

                {/* Highlights button moved to All listings page */}

                <TouchableOpacity
                  onPress={() => router.push('/market/orders')}
                  style={[styles.iconBtn, { borderColor: colors.border, backgroundColor: colors.bg }]}
                  accessibilityLabel="My orders"
                >
                  <Ionicons name="list-outline" size={18} color={colors.text} />
                </TouchableOpacity>

                {(profile as any)?.is_admin === true ? (
                  <TouchableOpacity
                    onPress={() => router.push('/market/admin-upload')}
                    style={[styles.iconBtn, { borderColor: colors.border, backgroundColor: colors.bg }]}>
                    <Ionicons name="cloud-upload-outline" size={18} color={colors.text} />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          </View>
        )}

        {/* small divider (kept transparent as requested) */}
        <View style={{ height: 1, backgroundColor: 'transparent' }} />

        {/* search row */}
        <View style={styles.searchRowWrap}>
          <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="search" size={18} color={colors.subtext} style={{ marginLeft: 10 }} />
            <TextInput
              ref={(r) => { searchInputRef.current = r; }}
              value={query}
              onChangeText={setQuery}
              placeholder="Search products..."
              placeholderTextColor={colors.subtext}
              style={[styles.searchInput, { color: colors.text }]}
            />
            <View style={{ paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' }}>
              {rateLoading ? (
                <ActivityIndicator size="small" color={colors.subtext} />
              ) : (
                <Text style={{ color: colors.subtext, fontWeight: '700' }}>{currencyCode}</Text>
              )}
            </View>
          </View>
          {/* live search results (non-blocking; does not blur input) */}
          {query?.trim().length ? (
            <View style={[styles.searchResults, { borderColor: colors.border, backgroundColor: colors.card }]}> 
              {filteredProducts && filteredProducts.length ? (
                filteredProducts.slice(0, 5).map((p) => (
                  <TouchableOpacity
                    key={`suggest-${p.id}`}
                    onPress={() => handleOpenProduct(p)}
                    activeOpacity={0.85}
                    style={[styles.searchResultItem, { borderBottomColor: colors.border }]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text numberOfLines={1} style={{ color: colors.text, fontWeight: '700', flex: 1 }}>{p.title}</Text>
                      <Text numberOfLines={1} style={{ color: colors.subtext, marginLeft: 8 }}>{formatPriceBaseToLocal(p.price ?? p.starting_price)}</Text>
                    </View>
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.searchResultItem}><Text style={{ color: colors.subtext }}>No results</Text></View>
              )}
            </View>
          ) : null}
        </View>

        {/* new e-commerce highlight hero: slider of media from supabase bucket (shopr/updates) — now edge-to-edge */}
        <View style={{ marginHorizontal: 0, marginTop: 16, borderRadius: 16, overflow: 'hidden' }}>
          {heroMedia && heroMedia.length ? (
            <View>
              <FlatList
                ref={(el) => { heroListRef.current = el; }}
                onScrollBeginDrag={() => { isHeroInteractingRef.current = true; }}
                data={heroMedia}
                horizontal
                pagingEnabled
                // ensure snapping uses the slide size + gap so swipe hits are precise
                snapToInterval={HERO_PAGE_SIZE}
                snapToAlignment="start"
                decelerationRate="fast"
                disableIntervalMomentum={true}
                showsHorizontalScrollIndicator={false}
                keyExtractor={(i) => i.path}
                onMomentumScrollEnd={(e) => {
                  try {
                    const x = e.nativeEvent.contentOffset.x;
                    const idx = Math.round(x / HERO_PAGE_SIZE);
                    setActiveHeroIndex(idx);
                    // done interacting
                    isHeroInteractingRef.current = false;
                  } catch {}
                }}
                renderItem={({ item }) => {
                  const url = item.url || '';
                  const ext = String(item.name || '').split('.').pop()?.toLowerCase();
                  const isVideo = ['mp4', 'mov', 'webm', 'm4v'].includes(ext ?? '');
                  return (
                    <View style={{ width: HERO_SLIDE_WIDTH, height: HERO_SLIDE_WIDTH * 0.55, backgroundColor: '#000', borderRadius: 16, marginRight: HERO_SLIDE_GAP }}>
                      {isVideo ? (
                        <Video
                          source={{ uri: url }}
                          style={{ width: '100%', height: '100%' }}
                          resizeMode="cover"
                          isLooping
                          shouldPlay
                          isMuted
                          useNativeControls={false}
                        />
                      ) : (
                        <Image
                          source={{ uri: url }}
                          style={{ width: '100%', height: '100%' }}
                          resizeMode="cover"
                        />
                      )}
                    </View>
                  );
                }}
              />

              {/* pager dots */}
              <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 8 }}>
                {heroMedia.map((_, i) => (
                  <View key={String(i)} style={{ width: activeHeroIndex === i ? 14 : 8, height: 8, borderRadius: 8, backgroundColor: activeHeroIndex === i ? colors.accent : 'rgba(255,255,255,0.25)', marginHorizontal: 4 }} />
                ))}
              </View>
            </View>
          ) : heroLoading ? (
            /* Skeleton loading for hero */
            <Animated.View style={[{ backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, height: HERO_SLIDE_WIDTH * 0.55, opacity: skeletonAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] }) }]}>
              <View style={{ flex: 1, backgroundColor: colors.faint, borderRadius: 12 }} />
            </Animated.View>
          ) : (
            <View style={[{ backgroundColor: colors.card, borderRadius: 12, padding: 18, borderWidth: 1, borderColor: colors.border }]}>
              <Text style={{ color: colors.subtext }}>No highlights available yet — add media to shopr/updates in storage.</Text>
            </View>
          )}
        </View>

        {/* quick filters */}
        <View style={styles.filterRowWrap}>
          <FlatList
            data={quickFilters}
            horizontal
            keyExtractor={(item) => item.key}
            showsHorizontalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={{ width: 10 }} />}
            renderItem={({ item }) => {
              const isActive = activeFilter === item.key;
              return (
                <TouchableOpacity
                  onPress={() => handleFilterChange(item.key)}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: isActive ? colors.accent : colors.card,
                      borderColor: isActive ? colors.accent : colors.border,
                    },
                  ]}
                >
                  <Ionicons name={item.icon} size={16} color={isActive ? '#fff' : colors.subtext} />
                  <Text
                    style={[
                      styles.filterChipText,
                      {
                        color: isActive ? '#fff' : colors.subtext,
                      },
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            }}
            contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8 }}
          />
        </View>

        {/* All category pill */}
        <View style={{ paddingHorizontal: 12, paddingTop: 8 }}>
          <View style={[styles.allCategoryPill, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={{ color: colors.subtext, fontWeight: '700' }}>Category</Text>
            <Text style={{ color: colors.text, marginLeft: 8, fontWeight: '900' }}>All</Text>
          </View>
        </View>

        {/* Auctions rail */}
        {loadingAuctions ? (
          /* Skeleton loading for auctions */
          <View style={{ paddingVertical: 12, paddingHorizontal: 12 }}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {[0, 1, 2].map((i) => (
                <Animated.View
                  key={i}
                  style={{
                    width: 140,
                    height: 100,
                    borderRadius: 12,
                    backgroundColor: colors.card,
                    opacity: skeletonAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] }),
                  }}
                />
              ))}
            </View>
          </View>
        ) : auctions.length ? (
          <View style={{ paddingBottom: 8 }}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Auctions</Text>
            <FlatList
              data={auctions}
              horizontal
              keyExtractor={(it) => `auc-${it.id}`}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8 }}
              renderItem={({ item }) => <AuctionCardCompact item={item} />}
            />
          </View>
        ) : null}
      </View>
    );
  }, [filteredProducts.length, auctions.length, profile?.id, isConnected, showOfflineHeader, query, rateLoading, currencyCode, JSON.stringify(heroMedia.map((h:any)=>h.path)), heroLoading, activeHeroIndex, loadingAuctions, JSON.stringify(quickFilters), activeFilter, colors]);

  /* ---------------- final render - entire page is scrollable as FlatList ---------------- */
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}> 
      <NotificationBanner
        visible={banner.visible}
        title={banner.title}
        body={banner.body}
        onClose={() => setBanner((s) => ({ ...s, visible: false }))}
        onPress={() => { banner.onPress?.(); setBanner((s) => ({ ...s, visible: false })); }}
        topOffset={TOP_INSET + 8}
      />
      {/* Offline vertical bar */}
      {!isConnected && (
        <View style={[styles.offlineSidebar, { backgroundColor: colors.accent }]} />
      )}

      <FlatList
        keyboardShouldPersistTaps="handled"
        data={initialLoading ? [] : filteredProducts}
        keyExtractor={(item) => item.id?.toString() ?? Math.random().toString()}
        renderItem={({ item }) => (
          <Animated.View style={{ opacity: contentFadeAnim, flex: 1 }}>
            <ProductCard item={item} />
          </Animated.View>
        )}
        numColumns={2}
        columnWrapperStyle={{ justifyContent: 'space-between', paddingHorizontal: CARD_MARGIN }}
        contentContainerStyle={{ paddingBottom: 180, paddingTop: 8 }}
        refreshing={refreshing}
        onRefresh={onRefresh}
        ListHeaderComponent={
          <>
            {headerElement}
            {initialLoading && (
              /* Skeleton loading for products */
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: CARD_MARGIN, gap: 12 }}>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <Animated.View
                    key={i}
                    style={{
                      width: (width - CARD_MARGIN * 3) / 2,
                      backgroundColor: colors.card,
                      borderRadius: 12,
                      marginBottom: 12,
                      overflow: 'hidden',
                      opacity: skeletonAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] }),
                    }}
                  >
                    <View style={{ width: '100%', height: 140, backgroundColor: colors.faint }} />
                    <View style={{ padding: 10 }}>
                      <View style={{ width: '70%', height: 14, borderRadius: 7, backgroundColor: colors.faint, marginBottom: 8 }} />
                      <View style={{ width: '50%', height: 12, borderRadius: 6, backgroundColor: colors.faint }} />
                    </View>
                  </Animated.View>
                ))}
              </View>
            )}
          </>
        }
        ListEmptyComponent={!initialLoading ? (
          <View style={{ padding: 30, alignItems: 'center' }}>
            <Text style={{ color: colors.subtext }}>No products found.</Text>
          </View>
        ) : null}
      />

      {/* bottom sheet map (separate, doesn't affect scrolling) */}
      <BottomSheet ref={bottomSheetRef} index={sheetIndex} onChange={setSheetIndex} snapPoints={snapPoints} enablePanDownToClose>
        <View style={{ flex: 1, height: '100%' }}>
          <MapView
            style={{ flex: 1 }}
            mapType={Platform.OS === 'ios' ? 'standard' : 'standard'}
            showsUserLocation
            followsUserLocation
            initialRegion={{
              latitude: userLocation?.latitude || 5.6037,
              longitude: userLocation?.longitude || -0.187,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            }}
          >
            {products.filter((p) => p.latitude && p.longitude).map((p) => (
              <Marker key={p.id} coordinate={{ latitude: p.latitude, longitude: p.longitude }} title={p.title} description={`GHS ${p.price}`} />
            ))}
          </MapView>
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}

/* ---------------- styles ---------------- */

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  offlineSidebar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 6,
    zIndex: 60,
  },
  topBar: {
    minHeight: 60,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 18,
    marginHorizontal: 12,
    marginTop: 4,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  topBtn: {
    padding: 8,
    borderRadius: 10,
  },
  topTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 999,
    borderWidth: 1,
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCard: {
    marginHorizontal: 12,
    marginTop: 16,
    borderRadius: 24,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroKicker: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '700',
    marginBottom: 4,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    marginTop: 6,
  },
  heroStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  heroStat: {
    alignItems: 'flex-start',
  },
  heroStatValue: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '900',
  },
  heroStatLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 2,
  },
  heroDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: 18,
  },
  heroCTA: {
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroCTAText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },

  searchRowWrap: {
    paddingHorizontal: 12,
    marginTop: 12,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    height: 46,
    borderWidth: 1,
    paddingRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: 12,
    fontSize: 15,
    height: 44,
  },

  searchResults: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    // keep results visually separate from hero — cap height so it doesn't push too hard
    maxHeight: 220,
  },
  searchResultItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },

  allCategoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },

  filterRowWrap: {
    marginTop: 2,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
  },
  filterChipText: {
    marginLeft: 6,
    fontWeight: '700',
    fontSize: 13,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    paddingHorizontal: 12,
    marginTop: 6,
    marginBottom: 6,
  },

  productCard: {
    marginBottom: 18,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    elevation: 3,
  },
  imageWrap: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#111',
    position: 'relative',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  favBtn: {
    position: 'absolute',
    right: 8,
    top: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  productPrice: {
    marginTop: 2,
    fontSize: 15,
    fontWeight: '900',
  },
  sellerRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sellerAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
  },
  addCartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  metaRow: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 8,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  metaChipText: {
    fontSize: 11,
    marginLeft: 4,
    fontWeight: '600',
  },

  auctionCard: {
    width: 300,
    marginRight: 12,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    flexDirection: 'row',
    padding: 8,
    alignItems: 'center',
  },
  auctionImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
    backgroundColor: '#ddd',
  },
  auctionTitle: {
    fontWeight: '800',
    fontSize: 15,
  },
  bidAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#fff',
  },

  offlineBanner: {
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
});

