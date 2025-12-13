import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, ActivityIndicator, ScrollView, TextInput, Alert, StyleSheet, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SwipeBackContainer from '@/components/SwipeBackContainer';
import { supabase } from '@/lib/supabase';
import { pickMediaAsync } from '@/utils/pickmedia';
import * as FileSystem from 'expo-file-system';
import mime from 'mime';
import { uploadFileWithMeta } from '@/lib/upload';
import { Ionicons } from '@expo/vector-icons';
import SimpleHeader from '@/components/SimpleHeader';
import { useProfileStore } from '@/lib/store/profile';
import { publicUrlFromBucket, signedUrlFromBucket } from '@/lib/storage';
import { useMarketTheme } from '@/utils/marketTheme';

export default function HighlightsPage() {
  const { colors } = useMarketTheme();
  const profile = useProfileStore((s) => s.profile);

  const [highlights, setHighlights] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState('');
  const [deletingIds, setDeletingIds] = useState<Record<string, boolean>>({});

  const loadHighlights = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('shopr_highlights')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) {
        console.warn('loadHighlights error', error);
        return;
      }
      if (!Array.isArray(data)) return;

      const mapped = data.map((d: any) => ({
        ...d,
        url: publicUrlFromBucket(d.bucket ?? 'updates', d.storage_path) ?? null,
      }));

      // fill in signed url fallback if any are missing
      const missing = mapped.filter((m: any) => !m.url);
      if (missing.length > 0) {
        await Promise.all(
          missing.map(async (m: any) => {
            try {
              const signed = await signedUrlFromBucket(m.bucket ?? 'updates', m.storage_path, 3600);
              if (signed) m.url = signed;
            } catch (e) {}
          })
        );
      }

      setHighlights(mapped.filter((x: any) => x.url));
    } catch (e) {
      console.warn('loadHighlights exception', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHighlights();
  }, []);

  const handleUpload = async () => {
    if (!profile?.id) return Alert.alert('Sign in', 'You must be signed in to upload highlights.');
    try {
      const picked = await pickMediaAsync();
      console.debug('[highlights] pick result', picked);
      if (!picked) return;
      setUploading(true);

      // prefer to use shared upload helper that returns the final path + url
      const meta = await uploadFileWithMeta(picked.uri, 'updates');
      if (!meta || !meta.path) {
        console.error('[highlights] uploadFileWithMeta failed', meta);
        const msg = meta?.error?.message ? String(meta.error.message) : meta?.error ? String(meta.error) : 'Could not upload file to storage. Check logs for details.';
        Alert.alert('Upload failed', msg);
        setUploading(false);
        return;
      }

      const payload = {
        file_name: picked.uri.split('/').pop() ?? meta.path?.split('/').pop() ?? null,
        storage_path: meta.path,
        bucket: 'updates',
        title: title || null,
        uploaded_by: profile.id,
        is_public: true,
      } as any;

      const { data: insertData, error: insertErr } = await supabase.from('shopr_highlights').insert([payload]).select('*').maybeSingle();
      if (insertErr) {
        console.warn('insert highlight error', insertErr);
        Alert.alert('Upload error', `Uploaded to storage but failed to record in DB: ${String(insertErr?.message ?? insertErr)}`);
      } else {
        console.debug('[highlights] inserted record', insertData, 'meta', meta);
        setTitle('');
        // reload highlights (prepend new item)
        const url = meta.publicUrl ?? (await signedUrlFromBucket('updates', meta.path!, 3600));
        setHighlights((p) => [{ ...insertData, url }, ...p]);
      }
    } catch (e) {
      console.warn('upload exception', e);
      Alert.alert('Error', 'Upload failed — see logs for details.');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteHighlight = async (h: any) => {
    if (!profile?.id) return Alert.alert('Sign in', 'You must be signed in to delete highlights.');
    if (!(profile?.id === h.uploaded_by || (profile as any)?.is_admin)) return Alert.alert('Not allowed', 'You can only delete highlights that you uploaded.');

    try {
      setDeletingIds((p) => ({ ...p, [h.id]: true }));

      // try deleting storage object first (best-effort)
      try {
        if (h.storage_path) {
          const bucket = h.bucket ?? 'updates';
          const { error: rmErr } = await supabase.storage.from(bucket).remove([h.storage_path]);
          if (rmErr) console.warn('[highlights] storage remove error', rmErr);
        }
      } catch (sErr) {
        console.warn('[highlights] storage remove exception', sErr);
      }

      // delete DB record
      const { error: dbErr } = await supabase.from('shopr_highlights').delete().eq('id', h.id);
      if (dbErr) {
        console.warn('[highlights] failed to delete db row', dbErr);
        Alert.alert('Delete failed', `Could not remove highlight from database: ${String(dbErr.message ?? dbErr)}`);
      } else {
        setHighlights((prev) => prev.filter((x) => x.id !== h.id));
      }
    } catch (e) {
      console.warn('[highlights] delete exception', e);
      Alert.alert('Error', 'Failed to delete highlight — see logs for details.');
    } finally {
      setDeletingIds((p) => {
        const copy = { ...p } as any;
        delete copy[h.id];
        return copy;
      });
    }
  };

  const confirmDeleteHighlight = (h: any) => {
    if (!profile?.id) return Alert.alert('Sign in', 'You must be signed in to delete highlights.');
    if (!(profile?.id === h.uploaded_by || (profile as any)?.is_admin)) return Alert.alert('Not allowed', 'You can only delete highlights that you uploaded.');
    Alert.alert('Delete highlight', 'Are you sure you want to delete this highlight? This will remove it from storage and the highlights list.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => handleDeleteHighlight(h) },
    ]);
  };

  return (
    <SwipeBackContainer>
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SimpleHeader title="Highlights" subtitle="Manage Shopr highlights" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        <View style={{ marginBottom: 12 }}>
          <Text style={{ color: colors.subtext }}>Title (optional)</Text>
          <TextInput value={title} onChangeText={setTitle} placeholder="Short caption for highlight" placeholderTextColor={colors.subtext} style={[styles.input, { borderColor: colors.border, color: colors.text }]} />
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <TouchableOpacity onPress={handleUpload} style={[styles.uploadBtn, { backgroundColor: colors.accent }]}> 
              {uploading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800' }}>Pick & upload</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={loadHighlights} style={[styles.uploadBtn, { backgroundColor: colors.faint }]}> 
              <Text style={{ color: colors.text, fontWeight: '700' }}>{loading ? 'Refreshing...' : 'Refresh'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ marginTop: 8 }}>
          <Text style={{ color: colors.text, fontWeight: '800', marginBottom: 8 }}>Recent highlights</Text>
          {loading ? (
            <ActivityIndicator />
          ) : (
            <View style={{ flexDirection: 'column' }}>
              {highlights.length === 0 ? (
                <Text style={{ color: colors.subtext }}>No highlights yet — upload one to get started.</Text>
              ) : (
                highlights.map((h) => (
                  <View key={h.id} style={{ width: '100%', height: Math.round((Dimensions.get('window').width - 32) * 0.55), marginBottom: 12, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.card }}>
                    {h.url ? (
                      <Image source={{ uri: h.url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    ) : (
                      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.subtext }}>No preview</Text></View>
                    )}

                    {(profile?.id === h.uploaded_by || (profile as any)?.is_admin) && (
                      <TouchableOpacity
                        onPress={() => confirmDeleteHighlight(h)}
                        style={{ position: 'absolute', right: 8, top: 8, zIndex: 30, backgroundColor: 'rgba(0,0,0,0.45)', padding: 6, borderRadius: 20 }}
                        activeOpacity={0.85}
                      >
                        {deletingIds[h.id] ? <ActivityIndicator color="#fff" /> : <Ionicons name="trash-outline" size={16} color="#fff" />}
                      </TouchableOpacity>
                    )}
                  </View>
                ))
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
    </SwipeBackContainer>
  );
}

const styles = StyleSheet.create({
  input: { height: 44, borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, marginTop: 6 },
  uploadBtn: { paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
