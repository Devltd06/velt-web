import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, Alert, TextInput, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useProfileStore } from '@/lib/store/profile';
import { supabase } from '@/lib/supabase';
import { useMarketTheme } from '@/utils/marketTheme';
import { router } from 'expo-router';

export default function AdminListings() {
  const { profile } = useProfileStore();
  const { colors } = useMarketTheme();

  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ title?: string; price?: string; stock?: string }>({});

  useEffect(() => {
    if (!profile || (profile as any).is_admin !== true) return;
    fetchProducts();
    // subscribe to product changes so admin screen stays fresh
    const ch = supabase
      .channel('admin:listings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, (payload) => {
        const n = payload?.new;
        const o = payload?.old;
        if (payload.eventType === 'INSERT' && n) setProducts((p) => [n, ...p]);
        if (payload.eventType === 'UPDATE' && n) setProducts((p) => p.map((it) => (it.id === n.id ? { ...it, ...n } : it)));
        if (payload.eventType === 'DELETE' && o) setProducts((p) => p.filter((it) => it.id !== o.id));
      })
      .subscribe();

    return () => {
      try { ch.unsubscribe(); } catch (e) {}
    };
  }, [profile?.id]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('products').select('id,sku,title,price,images,stock,created_at').order('created_at', { ascending: false });
      if (error) throw error;
      setProducts(data ?? []);
    } catch (e) {
      console.warn('admin listings fetch failed', e);
      Alert.alert('Error', 'Could not load listings. Check logs.');
    } finally {
      setLoading(false);
    }
  };

  const beginEdit = (p: any) => {
    setEditingId(p.id);
    setEditValues({ title: p.title ?? '', price: String(p.price ?? ''), stock: String(p.stock ?? '') });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValues({});
  };

  const saveEdit = async () => {
    if (!editingId) return;
    try {
      const updates: any = {};
      if (typeof editValues.title === 'string') updates.title = String(editValues.title).trim();
      if (typeof editValues.price === 'string') updates.price = Number(editValues.price) || 0;
      if (typeof editValues.stock === 'string') updates.stock = Number(editValues.stock) || 0;
      const { error } = await supabase.from('products').update(updates).eq('id', editingId);
      if (error) throw error;
      setEditingId(null);
      setEditValues({});
      // refresh is handled by realtime channel
    } catch (e: any) {
      console.warn('saveEdit error', e);
      Alert.alert('Update failed', e?.message ?? String(e));
    }
  };

  const deleteProduct = async (id: string) => {
    Alert.alert('Delete listing', 'Are you sure you want to delete this product?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await supabase.from('products').delete().eq('id', id);
            if (error) throw error;
            setProducts((p) => p.filter((it) => it.id !== id));
          } catch (e) {
            console.warn('delete failed', e);
            Alert.alert('Delete failed', 'Could not delete product. See logs.');
          }
        },
      },
    ]);
  };

  if (!profile || (profile as any).is_admin !== true) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 }}>
        <Text style={{ fontWeight: '800', fontSize: 18 }}>Admin access required</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "bottom"]}>
      <View style={{ flex: 1, padding: 16 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text style={{ fontWeight: '800', fontSize: 18, color: colors.text }}>All listings (manage)</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity onPress={() => router.push({ pathname: '/market/admin-upload' } as any)} style={{ paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.accent }}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>New product</Text>
          </TouchableOpacity>

          {/* Highlights quick access */}
          <TouchableOpacity onPress={() => router.push('/highlights')} style={{ paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.faint, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="images-outline" size={16} color={colors.text} />
            <Text style={{ color: colors.text, fontWeight: '700' }}>Highlights</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={fetchProducts} style={{ paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.faint }}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>Refresh</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? <ActivityIndicator /> : null}

      <FlatList
        data={products}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <View style={styles.row as any}>
            <Image source={{ uri: (item.images && item.images[0]) || '' }} style={styles.thumb} />
            <View style={{ flex: 1 }}>
              {editingId === item.id ? (
                <View>
                  <TextInput placeholder="Title" value={editValues.title} onChangeText={(t) => setEditValues((s) => ({ ...s, title: t }))} style={[styles.input, { marginBottom: 6 }]} />
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TextInput placeholder="Price" value={editValues.price} onChangeText={(t) => setEditValues((s) => ({ ...s, price: t }))} keyboardType="numeric" style={[styles.input, { flex: 1 }]} />
                    <TextInput placeholder="Stock" value={editValues.stock} onChangeText={(t) => setEditValues((s) => ({ ...s, stock: t }))} keyboardType="numeric" style={[styles.input, { width: 100 }]} />
                  </View>
                </View>
              ) : (
                <>
                  <Text style={{ fontWeight: '700', color: colors.text }}>{item.title}</Text>
                  <Text style={{ color: colors.subtext, marginTop: 4 }}>{item.sku ?? ''} • ₵{item.price ?? 0}</Text>
                  <Text style={{ color: colors.subtext, marginTop: 4 }}>Stock: {item.stock ?? 0}</Text>
                </>
              )}
            </View>

            <View style={{ marginLeft: 10, justifyContent: 'center' }}>
              {editingId === item.id ? (
                <View style={{ gap: 8 }}>
                  <TouchableOpacity onPress={saveEdit} style={[styles.actionBtn, { backgroundColor: colors.accent }]}>
                    <Text style={{ color: '#fff', fontWeight: '700' }}>Save</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={cancelEdit} style={[styles.actionBtn, { backgroundColor: colors.faint }]}>
                    <Text style={{ color: colors.text, fontWeight: '700' }}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={{ gap: 8 }}>
                  <TouchableOpacity onPress={() => router.push({ pathname: '/market/product-details', params: { id: item.id } } as any)} style={[styles.actionBtn, { backgroundColor: colors.faint }]}>
                    <Text style={{ color: colors.text, fontWeight: '700' }}>View</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => beginEdit(item)} style={[styles.actionBtn, { backgroundColor: colors.accent }]}>
                    <Text style={{ color: '#fff', fontWeight: '700' }}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => deleteProduct(item.id)} style={[styles.actionBtn, { backgroundColor: '#ff6666' }]}>
                    <Text style={{ color: '#fff', fontWeight: '700' }}>Delete</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        )}
      />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', paddingVertical: 12, gap: 8, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.04)', alignItems: 'center' },
  thumb: { width: 72, height: 72, borderRadius: 8, backgroundColor: '#111' },
  actionBtn: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  input: { height: 40, borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, borderColor: '#333', color: '#fff', backgroundColor: 'rgba(0,0,0,0.2)' },
});
