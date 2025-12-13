import React, { useCallback, useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, TextInput, TouchableOpacity, Image, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { withSafeRouter } from '@/lib/navigation';
import { useTheme } from 'app/themes';
import { supabase } from '@/lib/supabase';
import { useProfileStore } from '@/lib/store/profile';
import { Ionicons } from '@expo/vector-icons';
import { pickMultipleMediaAsync } from '@/utils/pickmedia';
import { uploadBillboardAsset } from '@/utils/cloudinary';
import SwipeBackContainer from '@/components/SwipeBackContainer';

export default function EditManageBillboard() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = withSafeRouter(useRouter());
  const { colors } = useTheme();
  const profile = useProfileStore((s) => s.profile);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [board, setBoard] = useState<any | null>(null);

  const [form, setForm] = useState<any>({ name: '', location: '', region: '', size: '', pricePerDay: '', description: '', availabilityNotes: '', availableFrom: '', availableTo: '', photos: [] });

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.from('billboards').select('*, photos:billboard_photos(*)').eq('id', id).maybeSingle();
        if (error) throw error;
        setBoard(data || null);
        if (data) {
          setForm({
            name: data.name ?? '',
            location: data.location ?? '',
            region: data.region ?? '',
            size: data.size ?? '',
            pricePerDay: data.price_per_day ? String(data.price_per_day) : '',
            description: data.description ?? '',
            availabilityNotes: data.availability_notes ?? '',
            availableFrom: data.available_from ?? '',
            availableTo: data.available_to ?? '',
            photos: (data.photos || []).map((p:any) => ({ id: p.id, url: p.url, path: p.path, remote: true }))
          });
        }
      } catch (err) {
        console.warn('load manage billboard', err);
        Alert.alert('Could not load listing');
      } finally { setLoading(false); }
    })();
  }, [id]);

  const pickMedia = useCallback(async () => {
    const assets = await pickMultipleMediaAsync();
    if (!assets?.length) return;
    setForm((p:any) => ({ ...p, photos: [...(p.photos||[]), ...assets].slice(0, 8) }));
  }, []);

  const removePhoto = useCallback(async (photo: any) => {
    // if it has id (persisted) delete from table
    if (photo?.id) {
      try {
        const { error } = await supabase.from('billboard_photos').delete().eq('id', photo.id);
        if (error) throw error;
        setForm((p:any) => ({ ...p, photos: (p.photos || []).filter((x:any) => x.id !== photo.id) }));
      } catch (err) { console.warn('remove photo failed', err); Alert.alert('Unable to remove photo'); }
      return;
    }
    // otherwise just remove from local state
    setForm((p:any) => ({ ...p, photos: (p.photos || []).filter((x:any) => x.uri !== photo.uri) }));
  }, []);

  const handleSave = useCallback(async () => {
    if (!id) return;
    if (!profile?.id) return Alert.alert('Sign in required');
    setSubmitting(true);
    try {
      // basic update
      const payload: any = {
        name: form.name.trim() || null,
        location: form.location.trim() || null,
        region: form.region.trim() || null,
        size: form.size.trim() || null,
        price_per_day: form.pricePerDay ? Number(form.pricePerDay) : null,
        description: form.description.trim() || null,
        availability_notes: form.availabilityNotes.trim() || null,
        available_from: form.availableFrom || null,
        available_to: form.availableTo || null,
      };
      const { error } = await supabase.from('billboards').update(payload).eq('id', id);
      if (error) throw error;

      // upload any local photos and insert into table
      const localPhotos = (form.photos || []).filter((p:any) => !p.remote && p.uri);
      if (localPhotos.length) {
        const uploads:any[] = [];
        for (const p of localPhotos) {
          const res = await uploadBillboardAsset(p.uri, p.type || 'image', p.mimeType || undefined);
          uploads.push(res.secure_url);
        }
        if (uploads.length) {
          await supabase.from('billboard_photos').insert(uploads.map((u, i) => ({ billboard_id: id, url: u, sort_order: Date.now() + i }))); // cheap sort_order
        }
      }

      Alert.alert('Saved', 'Listing updated');
      router.back();
    } catch (err) {
      console.warn('update failed', err);
      Alert.alert('Unable to save', 'Try again in a moment');
    } finally { setSubmitting(false); }
  }, [id, form, profile?.id, router]);

  if (!profile?.id) return <SafeAreaView style={{flex:1, alignItems:'center', justifyContent:'center'}}><Text>Sign in to manage listings</Text></SafeAreaView>;
  if (loading) return <SafeAreaView style={{flex:1, alignItems:'center', justifyContent:'center', backgroundColor: colors.bg}}><ActivityIndicator color={colors.accent} /></SafeAreaView>;
  if (!board) return <SafeAreaView style={{flex:1, alignItems:'center', justifyContent:'center'}}><Text style={{color: colors.text}}>Listing not found</Text></SafeAreaView>;

  return (
    <SwipeBackContainer>
    <SafeAreaView style={{flex:1, backgroundColor: colors.bg}}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>Edit listing</Text>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
            <Ionicons name="close" size={20} color={colors.subtext} />
          </TouchableOpacity>
        </View>

        <TextInput placeholder="Name" value={form.name} onChangeText={(t)=>setForm((p:any)=>({...p, name: t}))} placeholderTextColor={colors.subtext} style={{ borderWidth:1, borderColor: colors.border, borderRadius: 12, padding: 10, marginTop: 12, color: colors.text }} />
        <TextInput placeholder="Location" value={form.location} onChangeText={(t)=>setForm((p:any)=>({...p, location: t}))} placeholderTextColor={colors.subtext} style={{ borderWidth:1, borderColor: colors.border, borderRadius: 12, padding: 10, marginTop: 10, color: colors.text }} />
        <TextInput placeholder="Region" value={form.region} onChangeText={(t)=>setForm((p:any)=>({...p, region: t}))} placeholderTextColor={colors.subtext} style={{ borderWidth:1, borderColor: colors.border, borderRadius: 12, padding: 10, marginTop: 10, color: colors.text }} />
        <TextInput placeholder="Size" value={form.size} onChangeText={(t)=>setForm((p:any)=>({...p, size: t}))} placeholderTextColor={colors.subtext} style={{ borderWidth:1, borderColor: colors.border, borderRadius: 12, padding: 10, marginTop: 10, color: colors.text }} />
        <TextInput placeholder="Price per day" keyboardType='number-pad' value={form.pricePerDay} onChangeText={(t)=>setForm((p:any)=>({...p, pricePerDay: t}))} placeholderTextColor={colors.subtext} style={{ borderWidth:1, borderColor: colors.border, borderRadius: 12, padding: 10, marginTop: 10, color: colors.text }} />
        <TextInput placeholder="Availability notes" value={form.availabilityNotes} onChangeText={(t)=>setForm((p:any)=>({...p, availabilityNotes: t}))} placeholderTextColor={colors.subtext} style={{ borderWidth:1, borderColor: colors.border, borderRadius: 12, padding: 10, marginTop: 10, color: colors.text }} />
        <View style={{ flexDirection:'row', gap: 8, marginTop: 10 }}>
          <TouchableOpacity style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 10 }} onPress={() => {/* open date picker - keep simple for now */}}
            >
            <Text style={{ color: form.availableFrom ? colors.text : colors.subtext }}>{form.availableFrom || 'Available from'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 10 }} onPress={() => {/* open date picker - keep simple for now */}}>
            <Text style={{ color: form.availableTo ? colors.text : colors.subtext }}>{form.availableTo || 'Available to'}</Text>
          </TouchableOpacity>
        </View>

        <TextInput placeholder="Description" value={form.description} onChangeText={(t)=>setForm((p:any)=>({...p, description: t}))} placeholderTextColor={colors.subtext} multiline style={{ borderWidth:1, borderColor: colors.border, borderRadius: 12, padding: 10, marginTop: 10, minHeight: 100, color: colors.text }} />

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
          {(form.photos || []).map((p: any, idx: number) => (
            <View key={`${p.id||p.uri}-${idx}`} style={{ width: 90, height: 90, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
              <Image source={{ uri: p.url || p.path || p.uri }} style={{ width: '100%', height: '100%' }} />
              <TouchableOpacity onPress={() => removePhoto(p)} style={{ position: 'absolute', right: 6, top: 6 }}>
                <Ionicons name="close-circle" size={18} color={colors.accent} />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity onPress={pickMedia} style={{ width: 90, height: 90, borderRadius: 10, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' }}>
            <Ionicons name="add" size={18} color={colors.accent} />
            <Text style={{ color: colors.accent, fontSize: 12 }}>Add</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={handleSave} disabled={submitting} style={{ marginTop: 16, paddingVertical: 12, borderRadius: 10, backgroundColor: colors.accent, alignItems: 'center' }}>
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Save changes</Text>}
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
    </SwipeBackContainer>
  );
}
