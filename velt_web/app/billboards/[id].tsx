import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, ActivityIndicator, Image, ScrollView, Pressable, Alert, TextInput, Platform, Modal, ImageBackground, StyleSheet, Animated, KeyboardAvoidingView, PanResponder, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { withSafeRouter } from '@/lib/navigation';
import { supabase } from '@/lib/supabase';
import { publicUrlFromBucket } from '@/lib/storage';
import { Dimensions } from 'react-native';
import { useProfileStore } from '@/lib/store/profile';
import SimpleHeader from '@/components/SimpleHeader';
import { useTheme, VELT_ACCENT } from 'app/themes';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const parts = value.split('-').map((p) => Number(p));
  if (parts.length !== 3 || parts.some((p) => Number.isNaN(p))) return null;
  const [year, month, day] = parts;
  const d = new Date(Date.UTC(year, (month || 1) - 1, day || 1));
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export default function BillboardDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const profile = useProfileStore((s) => s.profile);
  const router = withSafeRouter(useRouter());

  const [loading, setLoading] = useState(true);
  const [board, setBoard] = useState<any | null>(null);

  const [bookingVisible, setBookingVisible] = useState(false);
  const [form, setForm] = useState({ brand: '', startDate: '', endDate: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [dateConflict, setDateConflict] = useState<string | null>(null);
  const [iosPicker, setIosPicker] = useState<{ field: 'start' | 'end'; value: Date } | null>(null);

  // carousel state (declare hooks early so hook order is stable across renders)
  const [activeImgIndex, setActiveImgIndex] = useState<number>(0);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [imageLoading, setImageLoading] = useState(false);
  const modalVisibleRef = useRef(false);

  // modal animation and pan handling
  const windowH = Dimensions.get('window').height;
  const windowW = Dimensions.get('window').width;
  const modalHeight = Math.round(windowH * 0.4); // 40% height as requested
  const translateY = useRef(new Animated.Value(modalHeight)).current; // start hidden below
  const panY = useRef(new Animated.Value(0)).current;

  // pan responder: handle drag down to close
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 4,
      onPanResponderGrant: () => {
        panY.setValue(0);
      },
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) {
          translateY.setValue(gs.dy);
        }
      },
      onPanResponderRelease: (_, gs) => {
        const shouldClose = gs.dy > modalHeight * 0.25 || gs.vy > 0.8;
        if (shouldClose) {
          Animated.timing(translateY, { toValue: modalHeight, duration: 180, useNativeDriver: true }).start(() => {
            setBookingVisible(false);
            translateY.setValue(modalHeight);
          });
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    })
  ).current;
  const carouselRef = useRef<ScrollView | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.from('billboards').select('*, photos:billboard_photos(*), bookings:billboard_bookings(*)').eq('id', id).maybeSingle();
        if (error) throw error;
        setBoard(data || null);
      } catch (err) {
        console.warn('Failed to load billboard', err);
        Alert.alert('Error', 'Could not load billboard.');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const diffInDays = (s: Date, e: Date) => Math.max(0, Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)));

  const isRangeAvailable = useCallback((bookings: any[] | undefined, start: Date, end: Date) => {
    if (!bookings || bookings.length === 0) return true;
    return !bookings.some((b) => {
      if (!b || ['canceled', 'refunded'].includes(String(b.status ?? '').toLowerCase())) return false;
      const bs = parseDate(b.start_date);
      const be = parseDate(b.end_date);
      if (!bs || !be) return false;
      return !(be < start || bs > end);
    });
  }, []);

  const openDatePicker = useCallback((field: 'start' | 'end', current?: string) => {
    const parsed = current ? parseDate(current) : null;
    const fallback = parsed ?? new Date();
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({ value: fallback, mode: 'date', minimumDate: new Date(), onChange: (_e, selected) => { if (selected) setForm((p)=> ({...p, [field==='start' ? 'startDate' : 'endDate']: selected.toISOString().slice(0,10)})); } });
      return;
    }
    setIosPicker({ field, value: fallback });
  }, []);

  const submitBooking = useCallback(async () => {
    if (!board) return;
    if (!form.brand.trim() || !form.startDate || !form.endDate) return Alert.alert('Missing', 'Please fill brand and dates');
    const start = parseDate(form.startDate);
    const end = parseDate(form.endDate);
    if (!start || !end || end < start) return Alert.alert('Invalid', 'Dates invalid');
    if (!isRangeAvailable(board.bookings, start, end)) return Alert.alert('Unavailable', 'Selected dates overlap existing booking');

    setSubmitting(true);
    try {
      // prefer billboard_requests when available
      const payload = { billboard_id: board.id, profile_id: null, brand_name: form.brand.trim(), start_date: form.startDate, end_date: form.endDate, message: form.message.trim() };
      let { error } = await supabase.from('billboard_requests').insert(payload);
      if (error) {
        if (String(error?.code ?? '').toUpperCase().includes('PGRST205') || String(error?.message ?? '').toLowerCase().includes('could not find the table')) {
          // fallback
          const { error: e2 } = await supabase.from('billboard_bookings').insert({ ...payload, status: 'pending' });
          if (e2) throw e2;
        } else throw error;
      }
      Alert.alert('Requested', 'Booking request sent — we will confirm availability.');
      setBookingVisible(false);
    } catch (err) {
      console.warn('booking failed', err);
      Alert.alert('Error', 'Could not submit booking.');
    } finally { setSubmitting(false); }
  }, [board, form, isRangeAvailable]);

  // helper to resolve photo urls (handles absolute urls or storage paths)
  function derivePhotoUrl(photo?: any | null): string | null {
    if (!photo) return null;
    // prefer an absolute url
    if (typeof photo.url === 'string' && photo.url.startsWith('http')) return photo.url;
    if (typeof photo.path === 'string' && photo.path.startsWith('http')) return photo.path;
    // remoteUrl also used by partner uploads
    if (typeof (photo as any).remoteUrl === 'string' && (photo as any).remoteUrl.startsWith('http')) return (photo as any).remoteUrl;
    // otherwise try supabase storage public url for path/url
    const candidate = photo.url ?? photo.path ?? null;
    if (!candidate) return null;
    try {
      // use shared helper which handles both public buckets and path/url shapes
      const pu = publicUrlFromBucket('ads', candidate as string);
      if (pu) return pu;
    } catch {}
    return null;
  }

  // when board photos change, attempt to build public url first; if missing or unreachable,
  // fetch signed urls for private buckets. Some Supabase publicUrl results can exist but
  // be inaccessible (403) for private buckets — we verify accessibility and fallback to
  // signed urls where needed.
  useEffect(() => {
    (async () => {
      setImageLoading(true);
      const photos = board?.photos || [];
      if (!photos || photos.length === 0) {
        setImageUrls([]);
        return;
      }
      // derive synchronously first (some may be URLs or storage paths)
      const results: (string | null)[] = photos.map((p: any) => derivePhotoUrl(p));

      // determine which entries are missing OR where the URL is unreachable
      const missingIndexPairs: Array<{ idx: number; raw: any; candidate?: string | null }> = [];
      // small helper to check reachability using HEAD with timeout
      async function isReachable(u: string | null): Promise<boolean> {
        if (!u) return false;
        try {
          // only perform checks for http/https URLs — other types will be handled by signed-url fallback
          if (!/^https?:\/\//i.test(u)) return false;
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 4000);
          const resp = await fetch(u, { method: 'HEAD', signal: controller.signal } as any).catch(() => null);
          clearTimeout(timeout);
          if (!resp) return false;
          // treat 2xx and 3xx as reachable
          if (resp.status >= 200 && resp.status < 400) return true;
          return false;
        } catch (e) {
          return false;
        }
      }

      // Build missing list: either derive returned no url OR returned a bad/unreachable url
      await Promise.all(
        photos.map(async (p: any, idx: number) => {
          const candidate = results[idx] ?? null;
          if (!candidate) {
            missingIndexPairs.push({ idx, raw: p, candidate });
            return;
          }
          // If candidate is a url-like value, check that it actually resolves as expected (avoid 403/404)
          if (/^https?:\/\//i.test(candidate)) {
            const ok = await isReachable(candidate).catch(() => false);
            if (!ok) missingIndexPairs.push({ idx, raw: p, candidate });
          }
        })
      );

      // if none missing, set and exit
      if (missingIndexPairs.length === 0) {
        // results may contain nulls but earlier logic filters out falsy values — ensure order preserved
        setImageUrls(results.filter(Boolean) as string[]);
        return;
      }

      // lazy import signed helper
      const { signedUrlFromBucket, signedUrlCacheStats } = await import('@/lib/storage');
      await Promise.all(
        missingIndexPairs.map(async ({ idx, raw }) => {
          try {
            // look for path or url or remoteUrl fields
            const key = raw?.path ?? raw?.url ?? raw?.remoteUrl ?? null;
            if (!key) return;
            // assume these are stored in the 'ads' bucket; try to create a signed url
            // request a longer-lived signed url so our local cache can be effective
            const signed = await signedUrlFromBucket('ads', key, 3600);
            if (signed) results[idx] = signed;
            try { console.debug('[billboards] signed-url fallback', key, !!signed, signedUrlCacheStats?.()); } catch {}
          } catch (e) {
            // ignore
          }
        })
      );

      // filter and set
      setImageUrls(results.filter(Boolean) as string[]);
    })().finally(() => setImageLoading(false));
  }, [board]);

  const isOwner = Boolean(profile?.id && board?.owner_id && profile.id === board.owner_id);

  if (loading) return <SafeAreaView style={{flex:1, alignItems:'center', justifyContent:'center', backgroundColor: colors.bg}}><ActivityIndicator color={colors.accent} /></SafeAreaView>;
  if (!board) return <SafeAreaView style={{flex:1, alignItems:'center', justifyContent:'center', backgroundColor: colors.bg}}><Text style={{color: colors.text}}>Billboard not found</Text></SafeAreaView>;

  return (
    <SafeAreaView style={{flex:1, backgroundColor: colors.bg}}>
      <SimpleHeader
        title={board?.name ?? 'Billboard'}
        subtitle={board?.region ?? undefined}
        // remove avatar to show explicit back and use router.replace
        onBack={() => {
          try { router.replace('/billboards'); } catch { router.back(); }
        }}
        rightAction={isOwner ? { icon: 'settings-outline', onPress: () => router.push({ pathname: '/partners/manage/[id]', params: { id: board?.id } }) } : null}
      />
      <ScrollView contentContainerStyle={{paddingBottom: 40}}>
        {imageUrls.length > 0 ? (
          <View style={{ width: '100%', height: 300, backgroundColor: '#000' }}>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              ref={(el) => { carouselRef.current = el; }}
              onScroll={({ nativeEvent }) => {
                try {
                  const idx = Math.round(nativeEvent.contentOffset.x / nativeEvent.layoutMeasurement.width);
                  setActiveImgIndex(idx);
                } catch (e) {}
              }}
              scrollEventThrottle={16}
            >
              {imageUrls.map((uri: string, i: number) => (
                <ImageBackground key={String(i)} source={{ uri }} style={{ width: windowW, height: 300, justifyContent: 'flex-end' }} imageStyle={{ resizeMode: 'cover' }}>
                  {/* Gradient overlay */}
                  <LinearGradient
                    colors={['rgba(0,0,0,0.4)', 'transparent', 'rgba(0,0,0,0.6)']}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={{ height: 80, backgroundColor: 'rgba(0,0,0,0.22)', padding: 12, justifyContent: 'flex-end' }}>
                    <Text numberOfLines={1} style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>{board?.name}</Text>
                    <Text numberOfLines={1} style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 }}>{board?.location} • {board?.region}</Text>
                  </View>
                </ImageBackground>
              ))}
            </ScrollView>

            {/* left/right arrows - glassmorphism style */}
            <Pressable
              onPress={() => {
                const next = Math.max(0, activeImgIndex - 1);
                setActiveImgIndex(next);
                carouselRef.current?.scrollTo({ x: next * windowW, animated: true });
              }}
              style={({ pressed }) => [styles.carouselArrow, styles.leftArrow, { transform: [{ scale: pressed ? 0.9 : 1 }] }]}
            >
              <BlurView intensity={40} tint="dark" style={styles.arrowBlur}>
                <Ionicons name="chevron-back" size={22} color="#fff" />
              </BlurView>
            </Pressable>
            <Pressable
              onPress={() => {
                const next = Math.min(imageUrls.length - 1, activeImgIndex + 1);
                setActiveImgIndex(next);
                carouselRef.current?.scrollTo({ x: next * windowW, animated: true });
              }}
              style={({ pressed }) => [styles.carouselArrow, styles.rightArrow, { transform: [{ scale: pressed ? 0.9 : 1 }] }]}
            >
              <BlurView intensity={40} tint="dark" style={styles.arrowBlur}>
                <Ionicons name="chevron-forward" size={22} color="#fff" />
              </BlurView>
            </Pressable>

            {/* pagination dots */}
            {imageUrls.length > 1 ? (
              <View style={{ position: 'absolute', left: 0, right: 0, bottom: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}>
                {imageUrls.map((_: string, i: number) => (
                  <View key={i} style={{ width: 8, height: 8, borderRadius: 8, backgroundColor: i === activeImgIndex ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.36)', marginHorizontal: 4 }} />
                ))}
              </View>
            ) : null}

            {/* image count indicator top-right */}
            <View style={styles.counterPill} pointerEvents="none">
              <Text style={styles.counterText}>{activeImgIndex + 1} / {imageUrls.length}</Text>
            </View>
          </View>
        ) : imageLoading ? (
          <View style={{ width: '100%', height: 180, backgroundColor: colors.faint, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={colors.subtext} />
          </View>
        ) : (
          <View style={{ width: '100%', height: 180, backgroundColor: colors.faint }} />
        )}
        <View style={{padding: 16}}>
          <Text style={{fontSize: 20, fontWeight: '800', color: colors.text}}>{board.name}</Text>
          <Text style={{color: colors.subtext, marginTop: 8}}>{board.location} • {board.region}</Text>
          {(board.available_from || board.available_to) ? (
            <Text style={{ color: colors.subtext, marginTop: 6 }}>
              Availability: {board.available_from ?? '—'}{board.available_to ? ` → ${board.available_to}` : ''}
            </Text>
          ) : null}
          <Text style={{color: colors.subtext, marginTop: 10}}>{board.description}</Text>

          <View style={{marginTop: 20}}>
            <Text style={{color: colors.subtext}}>Price</Text>
            <Text style={{fontWeight:'800', color: colors.text, marginTop: 8}}>{board.price_per_day ? `GHS ${board.price_per_day}` : 'Contact for price'}</Text>
          </View>

          <Pressable 
            style={({ pressed }) => [{ marginTop: 20, paddingVertical: 14, borderRadius: 12, backgroundColor: VELT_ACCENT, alignItems: 'center', transform: [{ scale: pressed ? 0.96 : 1 }] }]} 
            onPress={() => setBookingVisible(true)}
          >
            <Text style={{color: '#fff', fontWeight: '800'}}>Book</Text>
          </Pressable>

          {/* booking form modal */}
          <Modal visible={bookingVisible} animationType="none" transparent onRequestClose={() => setBookingVisible(false)} onShow={() => {
            modalVisibleRef.current = true; translateY.setValue(modalHeight); Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
          }}>
            <View style={styles.modalOverlay}>
              <Pressable style={{ flex: 1 }} onPress={() => {
                // tap outside to close
                Animated.timing(translateY, { toValue: modalHeight, duration: 180, useNativeDriver: true }).start(() => { setBookingVisible(false); translateY.setValue(modalHeight); modalVisibleRef.current = false; });
              }} />
              <Animated.View
                style={[styles.modalSheet, { transform: [{ translateY }], height: modalHeight, backgroundColor: colors.card }]}
                {...panResponder.panHandlers}
              >
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={20}>
                <View style={styles.modalHeaderRow}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>Request a booking</Text>
                  <Pressable 
                    onPress={() => setBookingVisible(false)}
                    style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.9 : 1 }] }]}
                  >
                    <Ionicons name="close" size={22} color={colors.subtext} />
                  </Pressable>
                </View>
                <View style={{ height: 1, backgroundColor: colors.border, marginBottom: 12 }} />
                <TextInput placeholder="Brand / campaign" placeholderTextColor={colors.subtext} value={form.brand} onChangeText={(t)=>setForm((p)=>({...p, brand: t}))} style={[styles.formInput, { borderColor: colors.border, color: colors.text }]} />
                <View style={{flexDirection: 'row', gap: 8, marginTop: 8}}>
                  <Pressable 
                    onPress={()=>openDatePicker('start', form.startDate)} 
                    style={({ pressed }) => [styles.dateField, { borderColor: colors.border, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
                  > 
                    <Text style={{color: form.startDate ? colors.text : colors.subtext}}>{form.startDate || 'Start date'}</Text>
                  </Pressable>
                  <Pressable 
                    onPress={()=>openDatePicker('end', form.endDate)} 
                    style={({ pressed }) => [styles.dateField, { borderColor: colors.border, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
                  > 
                    <Text style={{color: form.endDate ? colors.text : colors.subtext}}>{form.endDate || 'End date'}</Text>
                  </Pressable>
                </View>
                <TextInput placeholder="Notes / creative direction" placeholderTextColor={colors.subtext} multiline value={form.message} onChangeText={(t)=>setForm((p)=>({...p, message: t}))} style={[styles.textArea, { borderColor: colors.border, color: colors.text }]} />
                {!!dateConflict && <Text style={{color:'#e74c3c', marginTop:8}}>{dateConflict}</Text>}
                <Pressable 
                  onPress={submitBooking} 
                  disabled={submitting} 
                  style={({ pressed }) => [styles.primaryButton, { backgroundColor: VELT_ACCENT, opacity: submitting ? 0.6 : 1, transform: [{ scale: pressed ? 0.96 : 1 }] }]}
                >
                  {submitting ? <ActivityIndicator color="#fff" /> : <Text style={{color:'#fff', fontWeight:'800'}}>Request booking</Text>}
                </Pressable>
                </KeyboardAvoidingView>
              </Animated.View>
            </View>
          </Modal>

          {/* thumbnails */}
              {imageUrls.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12, paddingLeft: 12 }}>
              {imageUrls.map((uri, idx) => (
                <Pressable 
                  key={idx} 
                  onPress={() => { setActiveImgIndex(idx); carouselRef.current?.scrollTo({ x: idx * windowW, animated: true }); }} 
                  style={({ pressed }) => [{ marginRight: 10, transform: [{ scale: pressed ? 0.95 : 1 }] }]}
                >
                  <Image source={{ uri }} style={[styles.thumb, idx === activeImgIndex ? { borderColor: VELT_ACCENT, borderWidth: 2 } : null]} />
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  carouselArrow: { position: 'absolute', top: '45%', overflow: 'hidden', borderRadius: 24 },
  leftArrow: { left: 8 },
  rightArrow: { right: 8 },
  arrowBlur: { padding: 10, borderRadius: 24, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  counterPill: { position: 'absolute', right: 10, top: 12, backgroundColor: 'rgba(0,0,0,0.46)', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 14 },
  counterText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  availabilityBadge: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  bookButton: { marginTop: 20, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  modalSheet: { borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16, borderTopWidth: 1 },
  modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 6 },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  formInput: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 8, marginTop: 4 },
  dateField: { flex: 1, borderWidth: 1, borderRadius: 10, padding: 10, justifyContent: 'center' },
  textArea: { borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 8, minHeight: 96 },
  primaryButton: { marginTop: 14, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  thumb: { width: 80, height: 56, borderRadius: 8, backgroundColor: '#111' },
});
