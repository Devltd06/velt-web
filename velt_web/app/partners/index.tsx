import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { pickMultipleMediaAsync } from '@/utils/pickmedia';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { withSafeRouter } from '@/lib/navigation';

import NotificationBanner from 'components/NotificationsBanner';
import { useTheme } from 'app/themes';
import { supabase } from '@/lib/supabase';
import { uploadBillboardAsset } from '@/utils/cloudinary';
import { useProfileStore } from '@/lib/store/profile';

interface BillboardPhoto {
  id?: string;
  url?: string | null;
  path?: string | null;
  sort_order?: number | null;
}

interface BillboardBooking {
  id?: string;
  start_date?: string | null;
  end_date?: string | null;
  status?: string | null;
}

interface Billboard {
  id: string;
  name: string;
  location?: string | null;
  region?: string | null;
  price_per_day?: number | null;
  price?: number | null;
  bookings?: BillboardBooking[];
  photos?: BillboardPhoto[];
  available_from?: string | null;
  available_to?: string | null;
}

interface ListingMedia {
  uri: string;
  remoteUrl?: string;
  type: 'image' | 'video';
  mimeType?: string | null;
}

interface ListingForm {
  name: string;
  location: string;
  region: string;
  size: string;
  pricePerDay: string;
  description: string;
  availabilityNotes: string;
  photos: ListingMedia[];
  availableFrom?: string;
  availableTo?: string;
}

type BannerPayload = { title: string; body?: string } | null;

const createBlankForm = (): ListingForm => ({
  name: '',
  location: '',
  region: '',
  size: '',
  pricePerDay: '',
  description: '',
  availabilityNotes: '',
  photos: [],
  availableFrom: '',
  availableTo: '',
});

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const parts = value.split('-').map((piece) => Number(piece));
  if (parts.length !== 3 || parts.some((num) => Number.isNaN(num))) return null;
  const [year, month, day] = parts;
  const date = new Date(Date.UTC(year, (month || 1) - 1, day || 1));
  return Number.isNaN(date.getTime()) ? null : date;
}

function hasOverlap(startA: Date, endA: Date, startB: Date, endB: Date): boolean {
  return !(endA < startB || startA > endB);
}

function buildAvailabilityLabel(bookings?: BillboardBooking[]): { label: string; tone: 'available' | 'busy' } {
  if (!bookings || bookings.length === 0) return { label: 'Available now', tone: 'available' };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const future = bookings
    .filter((bk) => !['canceled', 'refunded'].includes(String(bk.status ?? '').toLowerCase()))
    .map((bk) => ({ start: parseDate(bk.start_date), end: parseDate(bk.end_date) }))
    .filter((range) => range.start && range.end && range.end >= today)
    .sort((a, b) => (a.start?.getTime() ?? 0) - (b.start?.getTime() ?? 0));
  if (future.length === 0) return { label: 'Available now', tone: 'available' };
  const first = future[0];
  if (first.start && first.start <= today && first.end && first.end >= today) return { label: 'Currently booked', tone: 'busy' };
  if (first.start) return { label: `Next booking ${first.start.toISOString().slice(0, 10)}`, tone: 'available' };
  return { label: 'Limited availability', tone: 'busy' };
}

function derivePhotoUrl(photo?: BillboardPhoto | ListingMedia | null): string | null {
  if (!photo) return null;
  if ('uri' in photo && photo.uri) return photo.uri;
  if ((photo as BillboardPhoto).url?.startsWith('http')) return (photo as BillboardPhoto).url ?? null;
  if ((photo as BillboardPhoto).path?.startsWith('http')) return (photo as BillboardPhoto).path ?? null;
  if ((photo as ListingMedia).remoteUrl?.startsWith('http')) return (photo as ListingMedia).remoteUrl ?? null;
  if ((photo as BillboardPhoto).url) {
    const { data } = supabase.storage.from('ads').getPublicUrl((photo as BillboardPhoto).url!);
    return data?.publicUrl ?? null;
  }
  if ((photo as BillboardPhoto).path) {
    const { data } = supabase.storage.from('ads').getPublicUrl((photo as BillboardPhoto).path!);
    return data?.publicUrl ?? null;
  }
  return null;
}

function formatCurrency(value?: number | string | null): string {
  const numeric = Number(value ?? 0) || 0;
  return `GHS ${numeric.toLocaleString()}`;
}

export default function PartnerDeskScreen(): React.ReactElement {
  const { colors } = useTheme();
  const { profile } = useProfileStore();
  const router = withSafeRouter(useRouter());

  const [partnerBoards, setPartnerBoards] = useState<Billboard[]>([]);
  const [loadingBoards, setLoadingBoards] = useState<boolean>(true);
  const [listingForm, setListingForm] = useState<ListingForm>(() => createBlankForm());
  const [submittingListing, setSubmittingListing] = useState<boolean>(false);
  const [banner, setBanner] = useState<BannerPayload>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [partnershipEnabled, setPartnershipEnabled] = useState(false);
  const [partnershipVerified, setPartnershipVerified] = useState(false);

  const isLoggedIn = Boolean(profile?.id);

  const availabilityChip = useCallback(
    (board: Billboard) => {
      // if explicit available_from / available_to set, prefer showing it
      if (board.available_from || board.available_to) {
        const now = new Date();
        let label = 'Available now';
        try {
          const start = board.available_from ? parseDate(board.available_from) : null;
          const end = board.available_to ? parseDate(board.available_to) : null;
          if (start && end) {
            if (now >= start && now <= end) label = 'Available now';
            else if (now < start) label = `Available from ${start.toISOString().slice(0,10)}`;
            else label = `Availability ended ${end.toISOString().slice(0,10)}`;
          } else if (start && !end) {
            label = now >= start ? 'Available now' : `Available from ${start.toISOString().slice(0,10)}`;
          } else if (!start && end) {
            label = now <= end ? 'Available now' : `Availability ended ${end.toISOString().slice(0,10)}`;
          }
        } catch { /* ignore parse */ }
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
    },
    []
  );

  const fetchPartnerBoards = useCallback(async () => {
    if (!profile?.id) {
      setPartnerBoards([]);
      setLoadingBoards(false);
      return;
    }
    setLoadingBoards(true);
    try {
      const { data, error } = await supabase
        .from('billboards')
        .select('*, photos:billboard_photos(*), bookings:billboard_bookings(*)')
        .eq('owner_id', profile.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setPartnerBoards(data ?? []);
    } catch (err) {
      console.error('Failed to load partner boards', err);
      setBanner({ title: 'Unable to load listings', body: 'Check your connection and try again.' });
    } finally {
      setLoadingBoards(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    fetchPartnerBoards();
  }, [fetchPartnerBoards]);

  // read partnership flags so we can auto-approve for verified partners if desired
  useEffect(() => {
    (async () => {
      try {
        if (!profile?.id) {
          setPartnershipEnabled(false);
          setPartnershipVerified(false);
          return;
        }
        const { data } = await supabase.from('profiles').select('partnership_enabled, partnership_verified, role').eq('id', profile.id).maybeSingle();
        const enabled = Boolean(data?.partnership_enabled) || (typeof data?.role === 'string' && String(data.role).toLowerCase().includes('partnership'));
        setPartnershipEnabled(enabled);
        setPartnershipVerified(Boolean(data?.partnership_verified));
      } catch (err) {
        console.warn('failed to read partnership flags', err);
      }
    })();
  }, [profile?.id]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPartnerBoards();
    setRefreshing(false);
  }, [fetchPartnerBoards]);

  const totalActiveBookings = useMemo(
    () => partnerBoards.reduce((acc, board) => acc + (board.bookings?.length ?? 0), 0),
    [partnerBoards]
  );

  const handlePickMedia = useCallback(async () => {
    const assets = await pickMultipleMediaAsync();
    if (!assets?.length) return;
    const nextPhotos: ListingMedia[] = assets.map((asset) => ({ uri: asset.uri, type: asset.type, mimeType: asset.mimeType }));
    setListingForm((prev) => ({ ...prev, photos: [...prev.photos, ...nextPhotos].slice(0, 6) }));
  }, []);

  const [iosPicker, setIosPicker] = useState<{ scope: 'form' | 'edit'; field: 'availableFrom' | 'availableTo'; value: Date } | null>(null);

  const openDatePicker = useCallback((field: 'availableFrom' | 'availableTo', value?: string) => {
    const parsed = value ? parseDate(value) : null;
    const fallback = parsed ?? new Date();
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({ value: fallback, mode: 'date', minimumDate: new Date(), onChange: (_e, selected) => { if (selected) setListingForm((p)=> ({...p, [field]: selected.toISOString().slice(0,10)})); } });
      return;
    }
    setIosPicker({ scope: 'form', field, value: fallback });
  }, []);

  const openEditDatePicker = useCallback((field: 'availableFrom' | 'availableTo', value?: string) => {
    const parsed = value ? parseDate(value) : null;
    const fallback = parsed ?? new Date();
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({ value: fallback, mode: 'date', minimumDate: new Date(), onChange: (_e, selected) => { if (selected) setEditingAvailability((p)=> ({...p, [field]: selected.toISOString().slice(0,10)})); } });
      return;
    }
    setIosPicker({ scope: 'edit', field, value: fallback });
  }, []);

  const dismissIosPicker = useCallback(() => setIosPicker(null), []);

  const handleSubmitListing = useCallback(async () => {
    if (!isLoggedIn) {
      router.push('/auth/login');
      return;
    }
    if (!listingForm.name.trim() || !listingForm.location.trim() || !listingForm.region.trim()) {
      Alert.alert('Incomplete form', 'Name, location, and region are required.');
      return;
    }
    setSubmittingListing(true);
    try {
      const uploads: ListingMedia[] = [];
      for (const photo of listingForm.photos) {
        if (photo.remoteUrl) {
          uploads.push(photo);
          continue;
        }
        const res = await uploadBillboardAsset(photo.uri, photo.type, photo.mimeType || undefined);
        uploads.push({ ...photo, remoteUrl: res.secure_url });
      }

      const { data, error } = await supabase
        .from('billboards')
        .insert({
          name: listingForm.name.trim(),
          location: listingForm.location.trim(),
          region: listingForm.region.trim(),
          size: listingForm.size.trim() || null,
          price_per_day: listingForm.pricePerDay ? Number(listingForm.pricePerDay) : null,
          description: listingForm.description.trim() || null,
          availability_notes: listingForm.availabilityNotes.trim() || null,
          available_from: listingForm.availableFrom || null,
          available_to: listingForm.availableTo || null,
          owner_id: profile?.id,
          // auto-approve for verified partners so their listings appear immediately
          is_approved: partnershipVerified ? true : false,
        })
        .select()
        .single();

      if (error || !data) throw error || new Error('Missing insert response');

      if (uploads.length) {
        await supabase.from('billboard_photos').insert(
          uploads.map((photo, index) => ({ billboard_id: data.id, url: photo.remoteUrl, sort_order: index }))
        );
      }

      setBanner({ title: 'Listing received', body: 'Our marketplace team will review it shortly.' });
      setListingForm(createBlankForm());
      fetchPartnerBoards();
    } catch (err) {
      console.error('submit listing failed', err);
      Alert.alert('Unable to submit', 'Please verify your network and try again.');
    } finally {
      setSubmittingListing(false);
    }
  }, [fetchPartnerBoards, isLoggedIn, listingForm, profile?.id, router]);

  // availability edit state for existing listings
  const [editingAvailabilityId, setEditingAvailabilityId] = useState<string | null>(null);
  const [editingAvailability, setEditingAvailability] = useState<{ availableFrom?: string; availableTo?: string }>({});

  const handleSaveAvailability = useCallback(async (boardId: string) => {
    const { availableFrom, availableTo } = editingAvailability;
    try {
      const { error } = await supabase.from('billboards').update({ available_from: availableFrom || null, available_to: availableTo || null }).eq('id', boardId);
      if (error) throw error;
      setEditingAvailabilityId(null);
      setEditingAvailability({});
      setBanner({ title: 'Availability updated', body: 'Listing availability saved.' });
      fetchPartnerBoards();
    } catch (err) {
      console.error('update availability failed', err);
      Alert.alert('Unable to update availability', 'Please try again.');
    }
  }, [editingAvailability, fetchPartnerBoards]);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]}> 
      <NotificationBanner
        visible={Boolean(banner)}
        title={banner?.title}
        body={banner?.body}
        onClose={() => setBanner(null)}
        topOffset={20}
      />
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Partner Desk</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent || '#3B82F6'} />}> 
        {!isLoggedIn && (
          <TouchableOpacity style={[styles.callout, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => router.push('/auth/login')}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.calloutTitle, { color: colors.text }]}>Log in to manage inventory</Text>
              <Text style={[styles.calloutBody, { color: colors.subtext }]}>Access bookings, upload creatives, and send invoices.</Text>
            </View>
            <Ionicons name="log-in-outline" size={20} color={colors.accent || '#3B82F6'} />
          </TouchableOpacity>
        )}

        <View style={[styles.partnerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.partnerTitle, { color: colors.text }]}>Network overview</Text>
          <Text style={[styles.partnerBody, { color: colors.subtext }]}>Realtime status of your outdoor inventory.</Text>
          <View style={styles.partnerStatsRow}>
            <View style={styles.partnerStat}>
              <Text style={[styles.partnerStatValue, { color: colors.text }]}>{partnerBoards.length}</Text>
              <Text style={[styles.partnerStatLabel, { color: colors.subtext }]}>Listings</Text>
            </View>
            <View style={styles.partnerStat}>
              <Text style={[styles.partnerStatValue, { color: colors.text }]}>{totalActiveBookings}</Text>
              <Text style={[styles.partnerStatLabel, { color: colors.subtext }]}>Active bookings</Text>
            </View>
          </View>
        </View>

        {loadingBoards ? (
          <ActivityIndicator style={{ marginTop: 24 }} color={colors.accent || '#3B82F6'} />
        ) : partnerBoards.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="briefcase-outline" size={46} color={colors.subtext} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No surfaces yet</Text>
            <Text style={[styles.emptyBody, { color: colors.subtext }]}>Submit the form below to add your first listing.</Text>
          </View>
        ) : (
          partnerBoards.map((board) => (
            <View key={board.id} style={[styles.partnerListing, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.partnerListingHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.partnerListingTitle, { color: colors.text }]} numberOfLines={1}>{board.name}</Text>
                  <Text style={[styles.partnerListingMeta, { color: colors.subtext }]}> {board.location || 'Address pending'} • {board.region || 'Region TBD'}</Text>
                </View>
                <Text style={[styles.partnerListingPrice, { color: colors.accent || '#3B82F6' }]}>{formatCurrency(board.price_per_day ?? board.price)}</Text>
              </View>
              {availabilityChip(board)}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <TouchableOpacity onPress={() => { setEditingAvailabilityId(board.id); setEditingAvailability({ availableFrom: board.available_from ?? '', availableTo: board.available_to ?? '' }); }} style={{ paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: colors.border }}>
                  <Text style={{ color: colors.text, fontWeight: '700' }}>Edit availability</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={async () => {
                  try {
                    const { error } = await supabase.from('billboards').update({ available_from: null, available_to: null }).eq('id', board.id);
                    if (error) throw error;
                    setBanner({ title: 'Availability cleared', body: 'Listing availability removed.' });
                    fetchPartnerBoards();
                  } catch (err) { console.warn('clear availability failed', err); Alert.alert('Error', 'Could not clear availability'); }
                }} style={{ paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: colors.border }}>
                  <Text style={{ color: colors.subtext }}>Clear</Text>
                </TouchableOpacity>
              </View>

              {editingAvailabilityId === board.id ? (
                <View style={{ marginTop: 10 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity style={[styles.formInput, { flex: 1, borderColor: colors.border }]} onPress={() => openEditDatePicker('availableFrom', editingAvailability.availableFrom)}>
                      <Text style={{ color: editingAvailability.availableFrom ? colors.text : colors.subtext }}>{editingAvailability.availableFrom || 'Start date'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.formInput, { flex: 1, borderColor: colors.border }]} onPress={() => openEditDatePicker('availableTo', editingAvailability.availableTo)}>
                      <Text style={{ color: editingAvailability.availableTo ? colors.text : colors.subtext }}>{editingAvailability.availableTo || 'End date'}</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                    <TouchableOpacity onPress={() => handleSaveAvailability(board.id)} style={[styles.primaryButton, { flex: 1, backgroundColor: colors.accent || '#3B82F6' }]}>
                      <Text style={styles.primaryButtonText}>Save availability</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => { setEditingAvailabilityId(null); setEditingAvailability({}); }} style={[styles.addPhoto, { flex: 1, justifyContent: 'center', alignItems: 'center' }]}>
                      <Text style={{ color: colors.subtext }}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}
            </View>
          ))
        )}

        <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.formTitle, { color: colors.text }]}>List a new billboard</Text>
          <Text style={[styles.formSubtitle, { color: colors.subtext }]}>Share the essentials and our team will review within one business day.</Text>
          <View style={styles.formGrid}>
            <TextInput placeholder="Billboard name" placeholderTextColor={colors.subtext} value={listingForm.name} onChangeText={(text) => setListingForm((prev) => ({ ...prev, name: text }))} style={[styles.formInput, { borderColor: colors.border, color: colors.text }]} />
            <TextInput placeholder="Location / city" placeholderTextColor={colors.subtext} value={listingForm.location} onChangeText={(text) => setListingForm((prev) => ({ ...prev, location: text }))} style={[styles.formInput, { borderColor: colors.border, color: colors.text }]} />
            <TextInput placeholder="Region" placeholderTextColor={colors.subtext} value={listingForm.region} onChangeText={(text) => setListingForm((prev) => ({ ...prev, region: text }))} style={[styles.formInput, { borderColor: colors.border, color: colors.text }]} />
            <TextInput placeholder="Size (e.g. 18x7 ft)" placeholderTextColor={colors.subtext} value={listingForm.size} onChangeText={(text) => setListingForm((prev) => ({ ...prev, size: text }))} style={[styles.formInput, { borderColor: colors.border, color: colors.text }]} />
            <TextInput placeholder="Price per day" placeholderTextColor={colors.subtext} keyboardType="number-pad" value={listingForm.pricePerDay} onChangeText={(text) => setListingForm((prev) => ({ ...prev, pricePerDay: text }))} style={[styles.formInput, { borderColor: colors.border, color: colors.text }]} />
            <TextInput placeholder="Availability notes" placeholderTextColor={colors.subtext} value={listingForm.availabilityNotes} onChangeText={(text) => setListingForm((prev) => ({ ...prev, availabilityNotes: text }))} style={[styles.formInput, { borderColor: colors.border, color: colors.text }]} />
            <TouchableOpacity onPress={() => openDatePicker('availableFrom', listingForm.availableFrom)} style={[styles.formInput, { justifyContent: 'center' }]}>
              <Text style={{ color: listingForm.availableFrom ? colors.text : colors.subtext }}>{listingForm.availableFrom || 'Available from (optional)'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => openDatePicker('availableTo', listingForm.availableTo)} style={[styles.formInput, { justifyContent: 'center' }]}>
              <Text style={{ color: listingForm.availableTo ? colors.text : colors.subtext }}>{listingForm.availableTo || 'Available to (optional)'}</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            placeholder="Highlights / description"
            placeholderTextColor={colors.subtext}
            multiline
            numberOfLines={4}
            value={listingForm.description}
            onChangeText={(text) => setListingForm((prev) => ({ ...prev, description: text }))}
            style={[styles.textArea, { borderColor: colors.border, color: colors.text }]}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoRow}>
            {listingForm.photos.map((photo, index) => (
              photo.type === 'image' ? (
                <Image key={`${photo.uri}-${index}`} source={{ uri: derivePhotoUrl(photo) ?? photo.uri }} style={styles.photoPreview} />
              ) : (
                <View key={`${photo.uri}-${index}`} style={[styles.photoPreview, styles.videoPreview]}>
                  <Ionicons name="videocam" size={22} color="#fff" />
                  <Text style={styles.videoPreviewText}>Video</Text>
                </View>
              )
            ))}
            <TouchableOpacity style={[styles.addPhoto, { borderColor: colors.border }]} onPress={handlePickMedia}>
              <Ionicons name="add" size={20} color={colors.accent || '#3B82F6'} />
              <Text style={[styles.addPhotoText, { color: colors.accent || '#3B82F6' }]}>Add media</Text>
            </TouchableOpacity>
          </ScrollView>
          <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.accent || '#3B82F6', opacity: submittingListing ? 0.7 : 1 }]} onPress={handleSubmitListing} disabled={submittingListing}>
            {submittingListing ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Submit listing</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
        {Platform.OS === 'ios' && iosPicker && (
          <View style={[{ position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, paddingBottom: 20 }, { backgroundColor: colors.card, borderColor: colors.border }]}> 
            <DateTimePicker
              mode="date"
              value={iosPicker.value}
              display="spinner"
              onChange={(_e, selected?: Date) => {
                if (!selected) return;
                const val = selected.toISOString().slice(0,10);
                if (iosPicker.scope === 'form') setListingForm((p) => ({ ...p, [iosPicker.field]: val } as ListingForm));
                else setEditingAvailability((p) => ({ ...p, [iosPicker.field]: val }));
              }}
              minimumDate={new Date()}
              themeVariant={colors.isDark ? 'dark' : 'light'}
            />
            <TouchableOpacity style={{ alignSelf: 'flex-end', paddingHorizontal: 20, paddingVertical: 6 }} onPress={() => setIosPicker(null)}>
              <Text style={{ color: colors.accent || '#3B82F6' }}>Done</Text>
            </TouchableOpacity>
          </View>
        )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 4 },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  scrollContent: { padding: 20, paddingBottom: 60, gap: 20 },
  callout: { borderWidth: 1, borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  calloutTitle: { fontSize: 16, fontWeight: '700' },
  calloutBody: { fontSize: 13, marginTop: 2 },
  partnerCard: { borderWidth: 1, borderRadius: 22, padding: 18 },
  partnerTitle: { fontSize: 18, fontWeight: '700' },
  partnerBody: { fontSize: 14, marginTop: 6 },
  partnerStatsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  partnerStat: { alignItems: 'flex-start' },
  partnerStatValue: { fontSize: 28, fontWeight: '700' },
  partnerStatLabel: { fontSize: 12, textTransform: 'uppercase', marginTop: 4 },
  emptyState: { alignItems: 'center', padding: 24, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyBody: { fontSize: 14, textAlign: 'center' },
  partnerListing: { borderWidth: 1, borderRadius: 18, padding: 16 },
  partnerListingHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  partnerListingTitle: { fontSize: 16, fontWeight: '700' },
  partnerListingMeta: { fontSize: 13, marginTop: 4 },
  partnerListingPrice: { fontSize: 16, fontWeight: '700' },
  availabilityChip: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, marginTop: 8 },
  availabilityText: { fontSize: 12, fontWeight: '600' },
  formCard: { borderWidth: 1, borderRadius: 22, padding: 18 },
  formTitle: { fontSize: 18, fontWeight: '700' },
  formSubtitle: { marginTop: 4, fontSize: 14 },
  formGrid: { marginTop: 16, gap: 12 },
  formInput: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  textArea: { borderWidth: 1, borderRadius: 18, padding: 14, marginTop: 12, textAlignVertical: 'top' },
  photoRow: { flexDirection: 'row', marginTop: 16 },
  photoPreview: { width: 90, height: 90, borderRadius: 14, marginRight: 12 },
  videoPreview: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#111827' },
  videoPreviewText: { color: '#fff', fontSize: 12, fontWeight: '700', marginTop: 4 },
  addPhoto: { width: 90, height: 90, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', gap: 6 },
  addPhotoText: { fontSize: 12, fontWeight: '600' },
  primaryButton: { marginTop: 18, borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  primaryButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
