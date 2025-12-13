import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  FlatList,
  TextInput,
  ActivityIndicator,
  Modal,
  ScrollView,
  Platform,
  StatusBar,
  RefreshControl,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { withSafeRouter } from '@/lib/navigation';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useCustomAlert } from '@/components/CustomAlert';
import NetInfo from '@react-native-community/netinfo';

import TabSwipeContainer from 'components/TabSwipeContainer';
import NotificationBanner from 'components/NotificationsBanner';

import { useTheme, VELT_ACCENT } from 'app/themes';
import { supabase } from '@/lib/supabase';
import { useProfileStore } from '@/lib/store/profile';

type RegionFilter =
  | 'All Regions'
  | 'Greater Accra'
  | 'Ashanti'
  | 'Northern'
  | 'Western'
  | 'Eastern'
  | 'Volta'
  | 'Central'
  | 'Upper East'
  | 'Upper West';

type FilterState = {
  region: RegionFilter;
  minPrice: string;
  maxPrice: string;
  startDate: string;
  endDate: string;
};

type BillboardPhoto = {
  id?: string;
  billboard_id?: string;
  url?: string | null;
  path?: string | null;
  sort_order?: number | null;
};

type BillboardBooking = {
  id?: string;
  billboard_id?: string;
  start_date?: string | null;
  end_date?: string | null;
  status?: string | null;
  brand_name?: string | null;
  budget?: number | null;
};

type Billboard = {
  id: string;
  name: string;
  location?: string | null;
  region?: string | null;
  size?: string | null;
  price_per_day?: number | null;
  price?: number | null;
  description?: string | null;
  availability_notes?: string | null;
  owner_id?: string | null;
  owner_name?: string | null;
  impressions?: number | null;
  rating?: number | null;
  photos?: BillboardPhoto[];
  bookings?: BillboardBooking[];
};

type BillboardRequest = {
  id: string;
  brand_name?: string | null;
  status?: string | null;
  message?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  created_at?: string | null;
  budget?: number | null;
  billboard?: Billboard | null;
};

type BannerPayload = { title: string; body?: string } | null;

type TabKey = 'marketplace' | 'requests';

type DateFieldKey = 'filterStart' | 'filterEnd' | 'requestStart' | 'requestEnd';

const REGION_OPTIONS: RegionFilter[] = [
  'All Regions',
  'Greater Accra',
  'Ashanti',
  'Northern',
  'Western',
  'Eastern',
  'Volta',
  'Central',
  'Upper East',
  'Upper West',
];

const DEFAULT_FILTERS: FilterState = {
  region: 'All Regions',
  minPrice: '',
  maxPrice: '',
  startDate: '',
  endDate: '',
};

const TAB_OPTIONS: { key: TabKey; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'marketplace', label: 'Marketplace', icon: 'storefront-outline' },
  { key: 'requests', label: 'Bookings', icon: 'calendar-outline' },
];

function getPublicUrlForPath(path?: string | null): string | null {
  if (!path) return null;
  try {
    const res = supabase.storage.from('ads').getPublicUrl(path);
    if ((res as any).publicURL) return (res as any).publicURL;
    if ((res as any).data?.publicUrl) return (res as any).data.publicUrl;
    return null;
  } catch {
    return null;
  }
}

function derivePhotoUrl(photo?: BillboardPhoto | null): string | null {
  if (!photo) return null;
  if ((photo as BillboardPhoto).url?.startsWith('http')) return (photo as BillboardPhoto).url ?? null;
  if ((photo as BillboardPhoto).path?.startsWith('http')) return (photo as BillboardPhoto).path ?? null;
  if ((photo as BillboardPhoto).url) return getPublicUrlForPath((photo as BillboardPhoto).url);
  if ((photo as BillboardPhoto).path) return getPublicUrlForPath((photo as BillboardPhoto).path);
  return null;
}

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const parts = value.split('-').map((p) => Number(p));
  if (parts.length !== 3 || parts.some((p) => Number.isNaN(p))) return null;
  const [year, month, day] = parts;
  const date = new Date(Date.UTC(year, (month || 1) - 1, day || 1));
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function formatDisplayDate(value?: string | null): string {
  if (!value) return '—';
  const date = parseDate(value);
  if (!date) return value;
  return date.toISOString().slice(0, 10);
}

function diffInDays(start: Date, end: Date): number {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
}

function hasOverlap(startA: Date, endA: Date, startB: Date, endB: Date): boolean {
  return !(endA < startB || startA > endB);
}

function formatCurrency(value?: number | string | null): string {
  const numeric = Number(value ?? 0) || 0;
  return `GHS ${numeric.toLocaleString()}`;
}

function isRangeAvailable(bookings: BillboardBooking[] | undefined, start: Date, end: Date): boolean {
  if (!Array.isArray(bookings) || bookings.length === 0) return true;
  return !bookings.some((booking) => {
    if (!booking || ['canceled', 'refunded'].includes(String(booking.status ?? '').toLowerCase())) return false;
    const bStart = parseDate(booking.start_date);
    const bEnd = parseDate(booking.end_date);
    if (!bStart || !bEnd) return false;
    return hasOverlap(start, end, bStart, bEnd);
  });
}

function buildAvailabilityLabel(bookings: BillboardBooking[] | undefined): { label: string; tone: 'available' | 'busy' } {
  if (!bookings || bookings.length === 0) return { label: 'Available now', tone: 'available' };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcoming = bookings
    .filter((bk) => !['canceled', 'refunded'].includes(String(bk.status ?? '').toLowerCase()))
    .map((bk) => ({ start: parseDate(bk.start_date), end: parseDate(bk.end_date) }))
    .filter((bk) => bk.start && bk.end && bk.end >= today)
    .sort((a, b) => (a.start?.getTime() ?? 0) - (b.start?.getTime() ?? 0));
  if (upcoming.length === 0) return { label: 'Available now', tone: 'available' };
  const first = upcoming[0];
  if (first.start && first.start <= today && first.end && first.end >= today) return { label: 'Currently booked', tone: 'busy' };
  if (first.start) return { label: `Next booking ${formatDisplayDate(first.start.toISOString().slice(0, 10))}`, tone: 'available' };
  return { label: 'Limited availability', tone: 'busy' };
}

export default function BillboardsScreen(): React.ReactElement {
  const { colors } = useTheme();
  const router = withSafeRouter(useRouter());
  const { profile } = useProfileStore();
  const { showAlert } = useCustomAlert();

  const [activeTab, setActiveTab] = useState<TabKey>('marketplace');
  const [banner, setBanner] = useState<BannerPayload>(null);
  const [billboards, setBillboards] = useState<Billboard[]>([]);
  const [requests, setRequests] = useState<BillboardRequest[]>([]);
  const [loadingBillboards, setLoadingBillboards] = useState<boolean>(true);
  const [loadingRequests, setLoadingRequests] = useState<boolean>(false);
  const [partnershipEnabled, setPartnershipEnabled] = useState<boolean>(false);
  const [partnershipVerified, setPartnershipVerified] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [searchText, setSearchText] = useState<string>('');
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [selectedBoard, setSelectedBoard] = useState<Billboard | null>(null);
  const [bookingModalVisible, setBookingModalVisible] = useState<boolean>(false);
  const [requestForm, setRequestForm] = useState({ brand: '', startDate: '', endDate: '', message: '' });
  const [submittingRequest, setSubmittingRequest] = useState<boolean>(false);
  const [dateConflict, setDateConflict] = useState<string | null>(null);
  const conflictAlertedRef = useRef(false);
  const [iosPicker, setIosPicker] = useState<{ field: DateFieldKey; value: Date } | null>(null);

  // Offline state
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [showOfflineHeader, setShowOfflineHeader] = useState<boolean>(false);
  const offlineHeaderTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Skeleton shimmer animation
  const skeletonAnim = useRef(new Animated.Value(0)).current;
  // Content fade-in animation
  const contentFadeAnim = useRef(new Animated.Value(0)).current;
  const [contentReady, setContentReady] = useState(false);

  const TOP_INSET = Platform.OS === 'ios' ? 12 : (StatusBar.currentHeight ?? 0) + 12;
  const { width: SCREEN_WIDTH } = Dimensions.get('window');

  const highlightColor = colors.accent ?? VELT_ACCENT;
  const mutedText = colors.subtext ?? '#77838f';

  const isLoggedIn = Boolean(profile?.id);

  const showBanner = useCallback((payload: BannerPayload) => setBanner(payload), []);

  const goToPartnerDesk = useCallback(() => {
    router.push('/partners');
  }, [router]);

  // Network connectivity listener
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const connected = state.isConnected ?? true;
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
      unsubscribe();
      if (offlineHeaderTimeoutRef.current) {
        clearTimeout(offlineHeaderTimeoutRef.current);
      }
    };
  }, []);

  // fetch partnership status for the current profile so UI can show a create button
  useEffect(() => {
    (async () => {
      try {
        if (!profile?.id) {
          setPartnershipEnabled(false);
          setPartnershipVerified(false);
          return;
        }
        // prefer explicit partnership_enabled column, fallback to role check
        const { data } = await supabase.from('profiles').select('partnership_enabled, partnership_verified, role').eq('id', profile.id).maybeSingle();
        const enabled = Boolean(data?.partnership_enabled) || (typeof data?.role === 'string' && String(data.role).toLowerCase().includes('partnership'));
        setPartnershipEnabled(enabled);
        setPartnershipVerified(Boolean(data?.partnership_verified));
      } catch (err) {
        console.warn('failed to get partnership status', err);
        setPartnershipEnabled(false);
        setPartnershipVerified(false);
      }
    })();
  }, [profile?.id]);

  const applyDateSelection = useCallback(
    (field: DateFieldKey, date: Date) => {
      const iso = date.toISOString().slice(0, 10);
      if (field === 'filterStart') {
        setFilters((prev) => ({ ...prev, startDate: iso }));
        return;
      }
      if (field === 'filterEnd') {
        setFilters((prev) => ({ ...prev, endDate: iso }));
        return;
      }
      if (field === 'requestStart') {
        setRequestForm((prev) => ({ ...prev, startDate: iso }));
        return;
      }
      if (field === 'requestEnd') {
        setRequestForm((prev) => ({ ...prev, endDate: iso }));
      }
    },
    []
  );

  const openDatePicker = useCallback(
    (field: DateFieldKey, currentValue?: string) => {
      const parsed = currentValue ? parseDate(currentValue) : null;
      const fallback = parsed ?? new Date();
      if (Platform.OS === 'android') {
        DateTimePickerAndroid.open({
          value: fallback,
          mode: 'date',
          minimumDate: field === 'requestStart' || field === 'requestEnd' ? new Date() : undefined,
          onChange: (_event, selected) => {
            if (selected) applyDateSelection(field, selected);
          },
        });
        return;
      }
      setIosPicker({ field, value: fallback });
    },
    [applyDateSelection]
  );

  const clearDateValue = useCallback((field: DateFieldKey) => {
    if (field === 'filterStart') {
      setFilters((prev) => ({ ...prev, startDate: '' }));
      return;
    }
    if (field === 'filterEnd') {
      setFilters((prev) => ({ ...prev, endDate: '' }));
      return;
    }
    if (field === 'requestStart') {
      setRequestForm((prev) => ({ ...prev, startDate: '' }));
      return;
    }
    if (field === 'requestEnd') {
      setRequestForm((prev) => ({ ...prev, endDate: '' }));
    }
  }, []);

  const handleIosPickerChange = useCallback(
    (_event: any, selected?: Date) => {
      if (!iosPicker || !selected) return;
      setIosPicker((prev) => (prev ? { ...prev, value: selected } : prev));
      applyDateSelection(iosPicker.field, selected);
    },
    [iosPicker, applyDateSelection]
  );

  const dismissIosPicker = useCallback(() => setIosPicker(null), []);

  const fetchBillboards = useCallback(async () => {
    setLoadingBillboards(true);
    try {
      const { data, error } = await supabase
        .from('billboards')
        .select('*, photos:billboard_photos(*), bookings:billboard_bookings(*)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBillboards(data ?? []);
    } catch (err) {
      console.error('Failed to load billboards', err);
      showBanner({ title: 'Unable to load marketplace', body: 'Please check your connection and retry.' });
    } finally {
      setLoadingBillboards(false);
    }
  }, [showBanner]);

  const fetchRequests = useCallback(async () => {
    if (!profile?.id) {
      setRequests([]);
      return;
    }
    setLoadingRequests(true);
    try {
      // primary attempt: read from dedicated requests table (older/newer deployments may have this)
      const { data, error } = await supabase
        .from('billboard_requests')
        .select('*, billboard:billboards(*, photos:billboard_photos(*))')
        .eq('profile_id', profile.id)
        .order('created_at', { ascending: false });

      if (!error) {
        setRequests(data ?? []);
        return;
      }

      // if the table doesn't exist in some environments, fall back to billboard_bookings
      // Supabase errors for missing table typically include code PGRST205
      if (String(error?.code ?? '').toUpperCase().includes('PGRST205') || String(error?.message ?? '').toLowerCase().includes('could not find the table')) {
        console.warn('billboard_requests missing — falling back to billboard_bookings');
        const { data: altData, error: altErr } = await supabase
          .from('billboard_bookings')
          .select('*, billboard:billboards(*, photos:billboard_photos(*))')
          .eq('profile_id', profile.id)
          .order('created_at', { ascending: false });

        if (altErr) throw altErr;
        setRequests(altData ?? []);
        return;
      }

      throw error;
    } catch (err) {
      console.error('Failed to load requests', err);
      showBanner({ title: 'Bookings unavailable', body: 'Unable to fetch your booking activity.' });
    } finally {
      setLoadingRequests(false);
    }
  }, [profile?.id, showBanner]);

  useEffect(() => {
    fetchBillboards();
  }, [fetchBillboards]);

  useEffect(() => {
    if (!profile?.id) return;
    fetchRequests();
  }, [profile?.id, fetchRequests]);

  // Skeleton shimmer effect
  useEffect(() => {
    if (loadingBillboards) {
      const shimmer = Animated.loop(
        Animated.sequence([
          Animated.timing(skeletonAnim, { toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver: true }),
          Animated.timing(skeletonAnim, { toValue: 0, duration: 1000, easing: Easing.linear, useNativeDriver: true }),
        ])
      );
      shimmer.start();
      return () => shimmer.stop();
    }
  }, [loadingBillboards, skeletonAnim]);

  // Fade in content when data is ready
  useEffect(() => {
    if (!loadingBillboards && !contentReady) {
      setContentReady(true);
      Animated.timing(contentFadeAnim, { toValue: 1, duration: 400, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    }
  }, [loadingBillboards, contentReady, contentFadeAnim]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchBillboards(), profile?.id ? fetchRequests() : Promise.resolve()]);
    setRefreshing(false);
  }, [fetchBillboards, fetchRequests, profile?.id]);

  const filteredBillboards = useMemo(() => {
    const search = searchText.trim().toLowerCase();
    const start = parseDate(filters.startDate);
    const end = parseDate(filters.endDate);
    return billboards.filter((board) => {
      if (filters.region !== 'All Regions' && board.region !== filters.region) return false;
      const price = board.price_per_day ?? board.price ?? 0;
      if (filters.minPrice && price < Number(filters.minPrice)) return false;
      if (filters.maxPrice && price > Number(filters.maxPrice)) return false;
      if (start && end && !isRangeAvailable(board.bookings, start, end)) return false;
      if (!search) return true;
      const haystack = `${board.name} ${board.location ?? ''} ${board.region ?? ''}`.toLowerCase();
      return haystack.includes(search);
    });
  }, [billboards, filters, searchText]);

  const handleSelectBoard = useCallback((board: Billboard) => {
    // navigate to details page instead of opening booking modal here
    try { router.push({ pathname: '/billboards/[id]', params: { id: board.id } }); } catch { router.push(`/billboards/${board.id}`); }
  }, [router]);

  useEffect(() => {
    if (!selectedBoard) {
      setDateConflict(null);
      conflictAlertedRef.current = false;
      return;
    }
    const { startDate, endDate } = requestForm;
    if (!startDate || !endDate) {
      setDateConflict(null);
      conflictAlertedRef.current = false;
      return;
    }
    const start = parseDate(startDate);
    const end = parseDate(endDate);
    if (!start || !end) {
      setDateConflict(null);
      conflictAlertedRef.current = false;
      return;
    }
    if (end < start) {
      setDateConflict('End date must be after start date.');
      conflictAlertedRef.current = false;
      return;
    }
    if (!isRangeAvailable(selectedBoard.bookings, start, end)) {
      setDateConflict('Selected window is not available for this surface.');
      if (!conflictAlertedRef.current) {
        showAlert({ title: 'Dates unavailable', message: 'This billboard is already booked for that window. Please pick new dates.' });
        conflictAlertedRef.current = true;
      }
      return;
    }
    setDateConflict(null);
    conflictAlertedRef.current = false;
  }, [requestForm.startDate, requestForm.endDate, selectedBoard]);

  const handleSubmitBooking = useCallback(async () => {
    if (!selectedBoard) return;
    if (!isLoggedIn) {
      showAlert({ title: 'Sign in required', message: 'Create an account to place booking requests.' });
      router.push('/auth/login');
      return;
    }
    if (dateConflict) {
      showAlert({ title: 'Dates unavailable', message: dateConflict });
      return;
    }
    if (!requestForm.brand.trim() || !requestForm.startDate || !requestForm.endDate) {
      showAlert({ title: 'Missing info', message: 'Please provide brand name, start date, and end date.' });
      return;
    }
    const start = parseDate(requestForm.startDate);
    const end = parseDate(requestForm.endDate);
    if (!start || !end || end < start) {
      showAlert({ title: 'Invalid dates', message: 'Ensure the booking window is valid.' });
      return;
    }
    if (!isRangeAvailable(selectedBoard.bookings, start, end)) {
      showAlert({ title: 'Already booked', message: 'This timeframe overlaps with an existing booking.' });
      return;
    }
    setSubmittingRequest(true);
    try {
      const payload = {
        billboard_id: selectedBoard.id,
        profile_id: profile?.id,
        brand_name: requestForm.brand.trim(),
        start_date: requestForm.startDate,
        end_date: requestForm.endDate,
        message: requestForm.message.trim(),
      };
      // try inserting into the requests table first (if available), otherwise fallback to bookings
      let { error } = await supabase.from('billboard_requests').insert(payload);
      if (error) {
        // if the requests table is not available, try booking table with a pending status
        if (String(error?.code ?? '').toUpperCase().includes('PGRST205') || String(error?.message ?? '').toLowerCase().includes('could not find the table')) {
          console.warn('billboard_requests missing — inserting into billboard_bookings instead');
          const bookingPayload = { ...payload, status: 'pending' };
          const { error: bErr } = await supabase.from('billboard_bookings').insert(bookingPayload);
          if (bErr) throw bErr;
        } else {
          throw error;
        }
      }
      showBanner({ title: 'Request submitted', body: 'Our team will confirm availability shortly.' });
      setBookingModalVisible(false);
      fetchRequests();
    } catch (err) {
      console.error('booking request failed', err);
      showAlert({ title: 'Unable to submit', message: 'Please retry in a moment.' });
    } finally {
      setSubmittingRequest(false);
    }
  }, [fetchRequests, isLoggedIn, profile?.id, requestForm.brand, requestForm.endDate, requestForm.message, requestForm.startDate, selectedBoard, showBanner, router]);

  const availabilityChip = (board: Billboard) => {
    // prefer explicit availability range set on the billboard
    if ((board as any).available_from || (board as any).available_to) {
      const now = new Date();
      let label = 'Available now';
      try {
        const start = (board as any).available_from ? parseDate((board as any).available_from) : null;
        const end = (board as any).available_to ? parseDate((board as any).available_to) : null;
        if (start && end) {
          if (now >= start && now <= end) label = 'Available now';
          else if (now < start) label = `Available from ${start.toISOString().slice(0,10)}`;
          else label = `Availability ended ${end.toISOString().slice(0,10)}`;
        } else if (start && !end) {
          label = now >= start ? 'Available now' : `Available from ${start.toISOString().slice(0,10)}`;
        } else if (!start && end) {
          label = now <= end ? 'Available now' : `Availability ended ${end.toISOString().slice(0,10)}`;
        }
      } catch {}
      const tone = label.startsWith('Available') ? 'available' : 'busy';
      const toneColor = tone === 'available' ? 'rgba(46,204,113,0.16)' : 'rgba(231,76,60,0.16)';
      const toneText = tone === 'available' ? '#27ae60' : '#c0392b';
      return (
        <View style={[styles.availabilityChip, { backgroundColor: toneColor }]}> 
          <Text style={[styles.availabilityText, { color: toneText }]}>{label}</Text>
        </View>
      );
    }
    const { label, tone } = buildAvailabilityLabel(board.bookings);
    const toneColor = tone === 'available' ? 'rgba(46,204,113,0.16)' : 'rgba(231,76,60,0.16)';
    const toneText = tone === 'available' ? '#27ae60' : '#c0392b';
    return (
      <View style={[styles.availabilityChip, { backgroundColor: toneColor }]}> 
        <Text style={[styles.availabilityText, { color: toneText }]}>{label}</Text>
      </View>
    );
  };

  const renderBillboard = ({ item }: { item: Billboard }) => {
    const cover = derivePhotoUrl(item.photos?.[0]);
    const price = item.price_per_day ?? item.price ?? 0;
    return (
      <TouchableOpacity activeOpacity={0.92} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => handleSelectBoard(item)}>
        {cover ? (
          <Image source={{ uri: cover }} style={styles.cardImage} />
        ) : (
          <View style={[styles.cardImage, styles.emptyImage, { backgroundColor: colors.faint }]}>
            <Ionicons name="image-outline" size={24} color={mutedText} />
          </View>
        )}
        <View style={styles.cardBody}>
          <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
          <Text style={[styles.cardMeta, { color: mutedText }]} numberOfLines={1}>
            <Ionicons name="location-outline" size={14} color={mutedText} /> {item.location || 'Location TBD'}
          </Text>
          {availabilityChip(item)}
          <View style={styles.cardFooter}>
            <View>
              <Text style={[styles.priceLabel, { color: mutedText }]}>Daily rate</Text>
              <Text style={[styles.priceValue, { color: colors.text }]}>{formatCurrency(price)}</Text>
            </View>
            <TouchableOpacity style={[styles.outlineButton, { borderColor: highlightColor }]} onPress={() => handleSelectBoard(item)}>
              <Text style={[styles.outlineButtonText, { color: highlightColor }]}>Details</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Skeleton component for billboard cards
  const SkeletonCard = ({ index }: { index: number }) => (
    <Animated.View
      style={{
        backgroundColor: colors.card,
        borderRadius: 16,
        marginHorizontal: 16,
        marginBottom: 16,
        overflow: 'hidden',
        opacity: skeletonAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] }),
      }}
    >
      <View style={{ width: '100%', height: 160, backgroundColor: colors.faint }} />
      <View style={{ padding: 14 }}>
        <View style={{ width: '70%', height: 16, borderRadius: 8, backgroundColor: colors.faint, marginBottom: 10 }} />
        <View style={{ width: '50%', height: 14, borderRadius: 7, backgroundColor: colors.faint, marginBottom: 10 }} />
        <View style={{ width: '40%', height: 12, borderRadius: 6, backgroundColor: colors.faint }} />
      </View>
    </Animated.View>
  );

  // Header component for the main FlatList (shared between marketplace and requests)
  const ListHeaderContent = () => (
    <>
      {showOfflineHeader ? (
        <View style={[styles.header, { backgroundColor: '#F97316' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'center', gap: 8 }}>
            <Ionicons name="cloud-offline-outline" size={20} color="#fff" />
            <Text style={[styles.title, { color: '#fff' }]}>Offline</Text>
          </View>
        </View>
      ) : (
        <View style={styles.header}> 
          {/* left: avatar / profile */}
          <TouchableOpacity onPress={() => profile?.id ? router.push({ pathname: '/profile/view/[id]', params: { id: profile.id } }) : router.push('/auth/login')} style={{ padding: 8 }}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={{ width: 36, height: 36, borderRadius: 18 }} />
            ) : (
              <Ionicons name="person-circle-outline" size={36} color={mutedText} />
            )}
          </TouchableOpacity>

          {/* center: show selected board name when present, otherwise default app title */}
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{selectedBoard?.name ?? 'Billboard systems'}</Text>
          </View>

          {/* right: manage icon (go to partner manage page) */}
          <TouchableOpacity style={[styles.iconButton, { borderColor: colors.border }]} onPress={() => router.push('/partners/manage') }>
            <Ionicons name="settings-outline" size={18} color={highlightColor} />
          </TouchableOpacity>
        </View>
      )}
      <View style={[styles.tabRow, { borderColor: colors.border }]}> 
        {TAB_OPTIONS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tabButton, activeTab === tab.key && { backgroundColor: colors.faint }]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Ionicons name={tab.icon} size={16} color={activeTab === tab.key ? highlightColor : mutedText} />
            <Text style={[styles.tabLabel, { color: activeTab === tab.key ? colors.text : mutedText }]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </>
  );

  // Marketplace header (filters, search, etc) - moved outside FlatList to use as part of header
  const MarketplaceFiltersHeader = () => (
    <View style={styles.marketHeader}>
      <TouchableOpacity style={[styles.partnerShortcut, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={goToPartnerDesk} activeOpacity={0.9}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.partnerShortcutTitle, { color: colors.text }]}>Own a billboard network?</Text>
          <Text style={[styles.partnerShortcutBody, { color: mutedText }]}>Submit listings, track bookings, and invoices from the Partner Desk.</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {partnershipEnabled ? (
            <TouchableOpacity onPress={() => router.push('/partners')} style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.accent, backgroundColor: colors.faint }}>
              <Text style={{ color: colors.accent, fontWeight: '800' }}>Create listing</Text>
            </TouchableOpacity>
          ) : null}
          <Ionicons name="arrow-forward" size={18} color={highlightColor} />
        </View>
      </TouchableOpacity>
      <Text style={[styles.sectionLabel, { color: mutedText }]}>Search inventory</Text>
      <View style={[styles.searchRow, { backgroundColor: colors.faint }]}> 
        <Ionicons name="search" size={18} color={mutedText} />
        <TextInput
          placeholder="Search by city, region, or title"
          placeholderTextColor={mutedText}
          value={searchText}
          onChangeText={setSearchText}
          style={[styles.searchInput, { color: colors.text }]}
        />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
        {REGION_OPTIONS.map((option) => (
          <TouchableOpacity key={option} onPress={() => setFilters((prev) => ({ ...prev, region: option }))}
            style={[styles.filterChip, filters.region === option && { backgroundColor: highlightColor }]}
          >
            <Text style={[styles.filterChipText, { color: filters.region === option ? '#fff' : mutedText }]}>{option}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <View style={styles.inlineInputs}>
        <View style={[styles.inlineField, { borderColor: colors.border }]}> 
          <Text style={[styles.inlineLabel, { color: mutedText }]}>Min price</Text>
          <TextInput keyboardType="number-pad" value={filters.minPrice} onChangeText={(text) => setFilters((prev) => ({ ...prev, minPrice: text }))}
            placeholder="0" placeholderTextColor={mutedText} style={[styles.inlineValue, { color: colors.text }]} />
        </View>
        <View style={[styles.inlineField, { borderColor: colors.border }]}> 
          <Text style={[styles.inlineLabel, { color: mutedText }]}>Max price</Text>
          <TextInput keyboardType="number-pad" value={filters.maxPrice} onChangeText={(text) => setFilters((prev) => ({ ...prev, maxPrice: text }))}
            placeholder="10,000" placeholderTextColor={mutedText} style={[styles.inlineValue, { color: colors.text }]} />
        </View>
      </View>
      <View style={styles.inlineInputs}>
        <View style={[styles.inlineField, styles.dateFieldContainer, { borderColor: colors.border }]}> 
          <Text style={[styles.inlineLabel, { color: mutedText }]}>Start date</Text>
          <View style={styles.dateValueRow}>
            <TouchableOpacity style={styles.dateButton} onPress={() => openDatePicker('filterStart', filters.startDate)}>
              <Ionicons name="calendar-outline" size={16} color={highlightColor} />
              <Text style={[styles.dateValueText, { color: filters.startDate ? colors.text : mutedText }]}>
                {filters.startDate || 'Pick date'}
              </Text>
            </TouchableOpacity>
            {!!filters.startDate && (
              <TouchableOpacity onPress={() => clearDateValue('filterStart')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={18} color={highlightColor} />
              </TouchableOpacity>
            )}
          </View>
        </View>
        <View style={[styles.inlineField, styles.dateFieldContainer, { borderColor: colors.border }]}> 
          <Text style={[styles.inlineLabel, { color: mutedText }]}>End date</Text>
          <View style={styles.dateValueRow}>
            <TouchableOpacity style={styles.dateButton} onPress={() => openDatePicker('filterEnd', filters.endDate)}>
              <Ionicons name="calendar-outline" size={16} color={highlightColor} />
              <Text style={[styles.dateValueText, { color: filters.endDate ? colors.text : mutedText }]}>
                {filters.endDate || 'Pick date'}
              </Text>
            </TouchableOpacity>
            {!!filters.endDate && (
              <TouchableOpacity onPress={() => clearDateValue('filterEnd')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={18} color={highlightColor} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
      <TouchableOpacity style={styles.clearFiltersButton} onPress={() => { setFilters({ ...DEFAULT_FILTERS }); setSearchText(''); }}>
        <Ionicons name="sparkles-outline" size={16} color={highlightColor} />
        <Text style={[styles.clearFiltersText, { color: highlightColor }]}>Clear filters</Text>
      </TouchableOpacity>
    </View>
  );

  const requestsContent = (
    <ScrollView nestedScrollEnabled={true} contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={highlightColor} />}>
      {!isLoggedIn && (
        <TouchableOpacity style={[styles.callout, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => router.push('/auth/login')}>
          <View>
            <Text style={[styles.calloutTitle, { color: colors.text }]}>Track your bookings</Text>
            <Text style={[styles.calloutBody, { color: mutedText }]}>Sign in to monitor approvals, invoices, and creatives.</Text>
          </View>
          <Ionicons name="log-in-outline" size={22} color={highlightColor} />
        </TouchableOpacity>
      )}
      {loadingRequests ? (
        /* Skeleton loading for requests */
        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          {[0, 1, 2].map((i) => (
            <Animated.View
              key={i}
              style={{
                backgroundColor: colors.card,
                borderRadius: 12,
                padding: 16,
                marginBottom: 12,
                opacity: skeletonAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] }),
              }}
            >
              <View style={{ width: '50%', height: 16, borderRadius: 8, backgroundColor: colors.faint, marginBottom: 12 }} />
              <View style={{ width: '70%', height: 12, borderRadius: 6, backgroundColor: colors.faint, marginBottom: 8 }} />
              <View style={{ width: '60%', height: 12, borderRadius: 6, backgroundColor: colors.faint }} />
            </Animated.View>
          ))}
        </View>
      ) : requests.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="calendar-clear-outline" size={46} color={mutedText} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No booking activity</Text>
          <Text style={[styles.emptyBody, { color: mutedText }]}>Requests you submit from the marketplace will appear here.</Text>
        </View>
      ) : (
        <Animated.View style={{ opacity: contentFadeAnim }}>
          {requests.map((request) => (
            <TouchableOpacity key={request.id} activeOpacity={0.9} onPress={() => showAlert({ title: request.brand_name || 'Booking', message: `${request.billboard?.name || 'Billboard'}\n${formatDisplayDate(request.start_date)} → ${formatDisplayDate(request.end_date)}\n\n${request.message || ''}` })} style={[styles.requestCard, { backgroundColor: colors.card, borderColor: colors.border }]}> 
              <View style={styles.requestHeader}>
                <Text style={[styles.requestBrand, { color: colors.text }]}>{request.brand_name || 'Unnamed brand'}</Text>
                <View style={[styles.statusPill, { backgroundColor: request.status === 'approved' ? 'rgba(46,204,113,0.15)' : request.status === 'rejected' ? 'rgba(231,76,60,0.15)' : 'rgba(59,130,246,0.15)' }]}> 
                  <Text style={[styles.statusText, { color: request.status === 'approved' ? '#2ecc71' : request.status === 'rejected' ? '#e74c3c' : highlightColor }]}>
                    {(request.status || 'pending').toUpperCase()}
                  </Text>
                </View>
              </View>
              <View style={styles.requestRow}>
                <Ionicons name="navigate-outline" size={16} color={mutedText} />
                <Text style={[styles.requestMeta, { color: mutedText }]}>
                  {request.billboard?.name || 'Billboard'} • {request.billboard?.region || 'Region TBD'}
                </Text>
              </View>
              <View style={styles.requestRow}>
                <Ionicons name="calendar-outline" size={16} color={mutedText} />
                <Text style={[styles.requestMeta, { color: mutedText }]}>
                  {formatDisplayDate(request.start_date)} → {formatDisplayDate(request.end_date)}
                </Text>
              </View>
              {!!request.message && (
                <Text style={[styles.requestMessage, { color: colors.text }]} numberOfLines={3}>{request.message}</Text>
              )}
            </TouchableOpacity>
          ))}
        </Animated.View>
      )}
    </ScrollView>
  );

  return (
    <TabSwipeContainer style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]}> 
        <NotificationBanner
          visible={Boolean(banner)}
          title={banner?.title}
          body={banner?.body}
          onClose={() => setBanner(null)}
          topOffset={TOP_INSET}
        />
        {activeTab === 'marketplace' ? (
          /* Use FlatList directly for marketplace to avoid VirtualizedList nesting */
          <FlatList
            data={loadingBillboards ? [] : filteredBillboards}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Animated.View style={{ opacity: contentFadeAnim }}>
                {renderBillboard({ item })}
              </Animated.View>
            )}
            contentContainerStyle={[styles.listContent, { paddingBottom: 24 }]}
            ListHeaderComponent={
              <>
                <ListHeaderContent />
                <MarketplaceFiltersHeader />
                {loadingBillboards && (
                  <View>
                    {[0, 1, 2, 3].map((i) => <SkeletonCard key={i} index={i} />)}
                  </View>
                )}
              </>
            }
            ListEmptyComponent={!loadingBillboards ? (
              <View style={styles.emptyState}>
                <Ionicons name="search-outline" size={46} color={mutedText} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>No billboards found</Text>
                <Text style={[styles.emptyBody, { color: mutedText }]}>Try adjusting filters or widen your date range.</Text>
              </View>
            ) : null}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={highlightColor} />}
          />
        ) : (
          /* Requests tab uses ScrollView since it doesn't have nested FlatList */
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 24 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={highlightColor} />}
          >
            <ListHeaderContent />
            <View style={styles.content}>{requestsContent}</View>
          </ScrollView>
        )}
      </SafeAreaView>

      <Modal animationType="slide" visible={bookingModalVisible} onRequestClose={() => setBookingModalVisible(false)}>
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.bg }]}> 
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setBookingModalVisible(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Book {selectedBoard?.name}</Text>
            <View style={{ width: 24 }} />
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            {selectedBoard && (
              <>
                <Text style={[styles.modalSubtitle, { color: mutedText }]}>
                  {selectedBoard.location || 'Location TBD'} • {selectedBoard.region || 'Region TBD'}
                </Text>
                <Text style={[styles.modalDescription, { color: colors.text }]}>{selectedBoard.description || 'Share your campaign details below and we will confirm availability.'}</Text>
                <TextInput placeholder="Brand / campaign" placeholderTextColor={mutedText} value={requestForm.brand} onChangeText={(text) => setRequestForm((prev) => ({ ...prev, brand: text }))} style={[styles.formInput, { borderColor: colors.border, color: colors.text }]} />
                <View style={styles.inlineInputs}>
                  <View style={[styles.formInput, styles.dateFieldContainer, { borderColor: colors.border, flex: 1 }]}> 
                    <Text style={[styles.inlineLabel, { color: mutedText }]}>Start date</Text>
                    <View style={styles.dateValueRow}>
                      <TouchableOpacity style={styles.dateButton} onPress={() => openDatePicker('requestStart', requestForm.startDate)}>
                        <Ionicons name="calendar-outline" size={16} color={highlightColor} />
                        <Text style={[styles.dateValueText, { color: requestForm.startDate ? colors.text : mutedText }]}>
                          {requestForm.startDate || 'Pick date'}
                        </Text>
                      </TouchableOpacity>
                      {!!requestForm.startDate && (
                        <TouchableOpacity onPress={() => clearDateValue('requestStart')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Ionicons name="close-circle" size={18} color={highlightColor} />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                  <View style={{ width: 12 }} />
                  <View style={[styles.formInput, styles.dateFieldContainer, { borderColor: colors.border, flex: 1 }]}> 
                    <Text style={[styles.inlineLabel, { color: mutedText }]}>End date</Text>
                    <View style={styles.dateValueRow}>
                      <TouchableOpacity style={styles.dateButton} onPress={() => openDatePicker('requestEnd', requestForm.endDate)}>
                        <Ionicons name="calendar-outline" size={16} color={highlightColor} />
                        <Text style={[styles.dateValueText, { color: requestForm.endDate ? colors.text : mutedText }]}>
                          {requestForm.endDate || 'Pick date'}
                        </Text>
                      </TouchableOpacity>
                      {!!requestForm.endDate && (
                        <TouchableOpacity onPress={() => clearDateValue('requestEnd')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Ionicons name="close-circle" size={18} color={highlightColor} />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>
                {!!dateConflict && (
                  <Text style={[styles.conflictText, { color: '#e74c3c' }]}>{dateConflict}</Text>
                )}
                <TextInput placeholder="Notes / creative direction" placeholderTextColor={mutedText} value={requestForm.message} onChangeText={(text) => setRequestForm((prev) => ({ ...prev, message: text }))} multiline numberOfLines={5} style={[styles.textArea, { borderColor: colors.border, color: colors.text }]} />
                <TouchableOpacity style={[styles.primaryButton, { backgroundColor: highlightColor, opacity: submittingRequest || dateConflict ? 0.7 : 1 }]} onPress={handleSubmitBooking} disabled={submittingRequest || Boolean(dateConflict)}>
                  {submittingRequest ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Request booking</Text>}
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {Platform.OS === 'ios' && iosPicker && (
        <View style={[styles.iosPickerSheet, { backgroundColor: colors.card, borderColor: colors.border }]}> 
          <DateTimePicker
            mode="date"
            value={iosPicker.value}
            display="spinner"
            onChange={handleIosPickerChange}
            minimumDate={iosPicker.field === 'requestStart' || iosPicker.field === 'requestEnd' ? new Date() : undefined}
            themeVariant={colors.isDark ? 'dark' : 'light'}
          />
          <TouchableOpacity style={styles.iosPickerDone} onPress={dismissIosPicker}>
            <Text style={[styles.iosPickerDoneText, { color: highlightColor }]}>Done</Text>
          </TouchableOpacity>
        </View>
      )}
    </TabSwipeContainer>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  title: { fontSize: 24, fontWeight: '700' },
  subtitle: { fontSize: 14, marginTop: 4 },
  iconButton: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  tabRow: { flexDirection: 'row', marginHorizontal: 16, borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, overflow: 'hidden' },
  tabButton: { flex: 1, paddingVertical: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  tabLabel: { fontSize: 13, fontWeight: '600' },
  content: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingBottom: 32 },
  marketHeader: { paddingBottom: 20 },
  sectionLabel: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  searchRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, paddingHorizontal: 14, gap: 8, height: 46 },
  searchInput: { flex: 1, fontSize: 15 },
  filterRow: { marginTop: 14 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8, backgroundColor: 'rgba(255,255,255,0.03)' },
  filterChipText: { fontSize: 12, fontWeight: '600' },
  inlineInputs: { flexDirection: 'row', marginTop: 12, gap: 12 },
  inlineField: { flex: 1, borderWidth: 1, borderRadius: 12, padding: 12 },
  inlineLabel: { fontSize: 11, textTransform: 'uppercase', fontWeight: '600' },
  inlineValue: { marginTop: 6, fontSize: 15 },
  clearFiltersButton: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  clearFiltersText: { fontWeight: '600' },
  card: { borderWidth: 1, borderRadius: 20, marginTop: 16, overflow: 'hidden' },
  cardImage: { width: '100%', height: 180 },
  emptyImage: { justifyContent: 'center', alignItems: 'center' },
  cardBody: { padding: 16, gap: 6 },
  cardTitle: { fontSize: 18, fontWeight: '700' },
  cardMeta: { fontSize: 13, flexDirection: 'row', alignItems: 'center' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  priceLabel: { fontSize: 12, textTransform: 'uppercase' },
  priceValue: { fontSize: 18, fontWeight: '700' },
  outlineButton: { borderWidth: 1.5, borderRadius: 16, paddingHorizontal: 20, paddingVertical: 8 },
  outlineButtonText: { fontWeight: '700' },
  availabilityChip: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, marginTop: 4 },
  availabilityText: { fontSize: 12, fontWeight: '600' },
  emptyState: { alignItems: 'center', padding: 32, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyBody: { textAlign: 'center', fontSize: 14 },
  scrollContent: { padding: 20, paddingBottom: 40, gap: 16 },
  callout: { borderWidth: 1, borderRadius: 20, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  calloutTitle: { fontSize: 18, fontWeight: '700' },
  calloutBody: { fontSize: 14, marginTop: 4 },
  requestCard: { borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  requestHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  requestBrand: { fontSize: 16, fontWeight: '700' },
  requestRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  requestMeta: { fontSize: 13 },
  requestMessage: { marginTop: 10, fontSize: 14, lineHeight: 20 },
  statusPill: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: '700' },
  partnerShortcut: { borderWidth: 1, borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  partnerShortcutTitle: { fontSize: 16, fontWeight: '700' },
  partnerShortcutBody: { fontSize: 13, marginTop: 4 },
  formInput: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  textArea: { borderWidth: 1, borderRadius: 18, padding: 14, marginTop: 12, textAlignVertical: 'top' },
  dateFieldContainer: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, justifyContent: 'center' },
  dateValueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  dateButton: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dateValueText: { fontSize: 15 },
  primaryButton: { marginTop: 18, borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  primaryButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  modalContainer: { flex: 1 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  modalContent: { paddingHorizontal: 20, paddingBottom: 40, gap: 12 },
  modalSubtitle: { fontSize: 14 },
  modalDescription: { fontSize: 14, marginBottom: 12 },
  conflictText: { fontSize: 13, marginTop: 6 },
  iosPickerSheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, paddingBottom: 20 },
  iosPickerDone: { alignSelf: 'flex-end', paddingHorizontal: 20, paddingVertical: 6 },
  iosPickerDoneText: { fontSize: 16, fontWeight: '600' },
});












