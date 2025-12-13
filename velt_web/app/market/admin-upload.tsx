import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, ScrollView, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { pickMultipleMediaAsync } from '@/utils/pickmedia';
import * as FileSystem from 'expo-file-system';
import { supabase } from '@/lib/supabase';
import Constants from 'expo-constants';
import { uploadFile } from '@/lib/upload';
import { uploadProductAsset } from '@/utils/cloudinary';
import { useRouter } from 'expo-router';
import { withSafeRouter } from '@/lib/navigation';
import { useProfileStore } from '@/lib/store/profile';
import SimpleHeader from '@/components/SimpleHeader';
import { useMarketTheme } from '@/utils/marketTheme';

export default function AdminUpload() {
  const { profile } = useProfileStore();
  const router = withSafeRouter(useRouter());
  const { colors } = useMarketTheme();

  const [title, setTitle] = useState('');
  const [sku, setSku] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [size, setSize] = useState('');
  const [colorVal, setColorVal] = useState('');
  const [material, setMaterial] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('');
  const [stock, setStock] = useState('0');
  const [images, setImages] = useState<string[]>([]); // store uploaded public URLs
  const [uploading, setUploading] = useState(false);
  const [debugMsg, setDebugMsg] = useState<string | null>(null);

  // Only allow users who have the explicit boolean flag `is_admin === true` to access.
  if (!profile || (profile as any)?.is_admin !== true) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Text style={{ fontWeight: '800', fontSize: 18 }}>Admin access required</Text>
        <Text style={{ marginTop: 8, color: '#666', textAlign: 'center' }}>You must be an admin (is_admin = true) to access this page.</Text>
      </View>
    );
  }

  const pickImage = async () => {
    try {
      console.debug('admin-upload: pickImage called');
      // Use shared app helper for image picking so behavior is consistent across the app
      // allow selecting multiple images quickly
      const picked = await pickMultipleMediaAsync();
      if (!picked || !picked.length) {
        console.warn('admin-upload: pickMultipleMediaAsync returned no assets (cancelled or permission denied)');
        Alert.alert('No selection', 'No image was selected or permission was denied. Open settings to allow access if needed.');
        return; // user cancelled or permission denied
      }
      setUploading(true);
      console.debug('admin-upload: picked assets count =', picked.length, picked);
      setDebugMsg(`Picked ${picked.length} asset(s)`);
      // We have an array of assets — process them serially to keep memory stable
      for (const asset of picked) {
        try {
          const uri = asset.uri;
          const res = await uploadProductAsset(uri, asset.type === 'video' ? 'video' : 'image');
          const secure = res?.secure_url ?? (res as any)?.url ?? null;
          if (secure) {
            setImages((p) => [...p, secure]);
          } else {
            // fallback to shopr upload
            const url = await uploadFile(uri, 'shopr');
            if (url) setImages((p) => [...p, url]);
            else {
              console.warn('admin-upload: failed to obtain URL for asset', asset.uri);
              setDebugMsg(`Upload failed for ${asset.uri?.split('/').pop() ?? asset.uri}`);
            }
          }
        } catch (e) {
          console.warn('admin-upload: upload for asset failed', asset?.uri, e);
          setDebugMsg(`Upload error: ${String(e)}`);
          Alert.alert('Upload failed', `Upload failed for ${asset?.uri?.split('/').pop() ?? asset?.uri}. See logs for details.`);
        }
      }
      
    } catch (err: any) {
      console.warn('pickImage err', err);
      setDebugMsg(`Pick error: ${String(err)}`);
      Alert.alert('Pick/Upload Error', err?.message ?? 'Could not pick/upload image. See logs for details.');
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (idx: number) => setImages((p) => p.filter((_, i) => i !== idx));

  // Insert directly into the products table (no server functions). We expect the client session to have
  // privileges to insert (or RLS/roles configured accordingly).

  const handleCreateProduct = async () => {
    if (!title || !price || !sku) return Alert.alert('Missing fields', 'Please provide title, SKU and price.');
    setUploading(true);
    try {
      const numericPrice = Number(price);
      const payload = {
        sku: String(sku).trim(),
        title: String(title).trim(),
        description: description ? String(description).trim() : null,
        price: numericPrice,
        images: Array.isArray(images) ? images : [],
        size: size ? String(size) : null,
        color: colorVal ? String(colorVal) : null,
        material: material ? String(material) : null,
        brand: brand ? String(brand) : null,
        category: category ? String(category) : null,
        stock: Number(stock || 0),
        seller_id: 'VELT',
      } as any;

      const { data: insertData, error: insertErr } = await supabase.from('products').insert([payload]).select('id').maybeSingle();
      if (insertErr) {
        console.warn('admin-upload: products insert error', insertErr);
        throw insertErr;
      }

      Alert.alert('Created', `Product created (id: ${insertData?.id ?? 'unknown'})`);
      // Reset
      setTitle(''); setSku(''); setPrice(''); setDescription(''); setSize(''); setColorVal(''); setMaterial(''); setBrand(''); setCategory(''); setStock('0'); setImages([]);
      router.push({ pathname: '/market/listings' });
    } catch (err: any) {
      console.warn('create product err', err);
      Alert.alert('Error', err?.message ?? 'Failed to create product');
    } finally {
      setUploading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 140 }} style={{ flex: 1 }}>
      <SimpleHeader title="Admin: Upload Product" />

      {/* Add explicit 'View listings' control so admins can quickly navigate to the listings page */}
      <TouchableOpacity onPress={() => router.push({ pathname: '/market/listings' })} style={{ marginTop: 8, marginBottom: 6, alignSelf: 'flex-end', backgroundColor: colors.faint, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 }}>
        <Text style={{ color: colors.text, fontWeight: '700' }}>All listings</Text>
      </TouchableOpacity>

      <View style={{ marginTop: 12, gap: 8 }}>
        <Text style={{ color: colors.subtext }}>Title</Text>
        <TextInput placeholder="Product title" value={title} onChangeText={setTitle} style={styles.input} />

        <Text style={{ color: colors.subtext }}>SKU</Text>
        <TextInput placeholder="Unique SKU" value={sku} onChangeText={setSku} style={styles.input} />

        <Text style={{ color: colors.subtext }}>Price</Text>
        <TextInput placeholder="Price" value={price} onChangeText={setPrice} keyboardType="numeric" style={styles.input} />

        <Text style={{ color: colors.subtext }}>Description</Text>
        <TextInput placeholder="Description" value={description} onChangeText={setDescription} multiline numberOfLines={4} style={[styles.input, { height: 120, textAlignVertical: 'top' }]} />

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.subtext }}>Size</Text>
            <TextInput placeholder="e.g., L, M, One Size" value={size} onChangeText={setSize} style={styles.input} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.subtext }}>Color</Text>
            <TextInput placeholder="e.g., Red" value={colorVal} onChangeText={setColorVal} style={styles.input} />
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.subtext }}>Material</Text>
            <TextInput placeholder="Material" value={material} onChangeText={setMaterial} style={styles.input} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.subtext }}>Brand</Text>
            <TextInput placeholder="Brand" value={brand} onChangeText={setBrand} style={styles.input} />
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.subtext }}>Category</Text>
            <TextInput placeholder="Category" value={category} onChangeText={setCategory} style={styles.input} />
          </View>
          <View style={{ width: 120 }}>
            <Text style={{ color: colors.subtext }}>Stock</Text>
            <TextInput placeholder="Stock" value={stock} onChangeText={setStock} keyboardType="numeric" style={styles.input} />
          </View>
        </View>

        <View style={{ marginTop: 8 }}>
          <Text style={{ color: colors.subtext }}>Images</Text>
            {debugMsg ? (
              <Text style={{ color: '#ff6666', marginTop: 6 }}>{debugMsg}</Text>
            ) : null}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <TouchableOpacity onPress={pickImage} style={[styles.pickBtn, { backgroundColor: colors.accent }]}>
              {uploading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Pick & Upload</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setImages([])} style={[styles.pickBtn, { backgroundColor: colors.faint }]}>
              <Text style={{ color: colors.text, fontWeight: '600' }}>Clear</Text>
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 }}>
            {images.map((u, i) => (
              <View key={u + String(i)} style={{ width: 92, height: 78, marginRight: 8, marginBottom: 8, position: 'relative' }}>
                <Image source={{ uri: u }} style={{ width: 92, height: 78, borderRadius: 8 }} />
                <TouchableOpacity onPress={() => removeImage(i)} style={{ position: 'absolute', right: 6, top: 6, backgroundColor: 'rgba(0,0,0,0.45)', padding: 4, borderRadius: 8 }}>
                  <Text style={{ color: '#fff', fontWeight: '700' }}>×</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>

        <TouchableOpacity onPress={handleCreateProduct} style={[styles.submitBtn, { backgroundColor: colors.accent }]}>
          {uploading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800' }}>Create product</Text>}
        </TouchableOpacity>
      </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  input: { height: 40, borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, marginBottom: 8, borderColor: '#2b2b2b', backgroundColor: '#0a0a0a', color: '#fff' },
  pickBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  submitBtn: { marginTop: 12, height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
