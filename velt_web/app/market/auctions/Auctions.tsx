import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { withSafeRouter } from '@/lib/navigation';
import { supabase } from '@/lib/supabase';
import { useProfileStore } from '@/lib/store/profile';
import { Ionicons } from '@expo/vector-icons';
import { openImagePickerAsync } from '@/utils/imagepicker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useMarketTheme } from '@/utils/marketTheme';


export default function CreateAuctionScreen() {
  const router = withSafeRouter(useRouter());
  const { profile } = useProfileStore();
  const [title, setTitle] = useState('');
  const [startingPrice, setStartingPrice] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [imageLoading, setImageLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const { colors } = useMarketTheme();

  const handleCreateAuction = async () => {
    if (!profile?.id) {
      Alert.alert('Sign in required', 'Please sign in to create an auction.');
      return;
    }
    if (!title || !startingPrice || !endDate || images.length === 0) {
      Alert.alert('Missing fields', 'Title, starting price, end date, and at least one image are required.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.from('auction_items').insert({
        seller_id: profile.id,
        title,
        starting_price: parseFloat(startingPrice),
        image_url: images.join('||'),
        ends_at: endDate.toISOString(),
      });
      if (error) {
        Alert.alert('Error', 'Could not create auction.');
        return;
      }
      Alert.alert('Success', 'Auction created!');
      router.back();
    } catch (err) {
      Alert.alert('Error', 'Unexpected error creating auction.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}> 
      <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false}>
        <View style={[styles.headerRow, { borderColor: colors.border }]}> 
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Create Auction</Text>
          <View style={[styles.headerBtn, { backgroundColor: colors.faint }]}> 
            <Ionicons name="pricetag-outline" size={20} color={colors.accent} />
          </View>
        </View>

        <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}> 
          <View style={{ flex: 1 }}>
            <Text style={[styles.heroKicker, { color: colors.subtext }]}>Launch a drop</Text>
            <Text style={[styles.heroTitle, { color: colors.text }]}>Set the vibe, share the clock.</Text>
            <Text style={[styles.heroSubtitle, { color: colors.subtext }]}>Add up to four media assets, pick a closing time, and publish.</Text>
            <View style={styles.heroStats}>
              <View>
                <Text style={[styles.heroStatLabel, { color: colors.subtext }]}>Media</Text>
                <Text style={[styles.heroStatValue, { color: colors.text }]}>{images.length}/4</Text>
              </View>
              <View>
                <Text style={[styles.heroStatLabel, { color: colors.subtext }]}>Ends</Text>
                <Text style={[styles.heroStatValue, { color: colors.text }]}>{endDate ? endDate.toLocaleDateString() : '—'}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={[styles.fieldCard, { backgroundColor: colors.card, borderColor: colors.border }]}> 
          <Text style={[styles.label, { color: colors.text }]}>Title</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.faint }]}
            placeholder="Auction title"
            placeholderTextColor={colors.subtext}
          />
        </View>

        <View style={[styles.fieldCard, { backgroundColor: colors.card, borderColor: colors.border }]}> 
          <Text style={[styles.label, { color: colors.text }]}>Starting Price (GHS)</Text>
          <TextInput
            value={startingPrice}
            onChangeText={setStartingPrice}
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.faint }]}
            placeholder="0.00"
            keyboardType="numeric"
            placeholderTextColor={colors.subtext}
          />
        </View>

        <View style={[styles.fieldCard, { backgroundColor: colors.card, borderColor: colors.border }]}> 
          <Text style={[styles.label, { color: colors.text }]}>Media (up to 4)</Text>
          <View style={styles.imageGrid}>
            {images.map((img, idx) => (
              <View key={img + idx} style={{ position: 'relative' }}>
                <Image source={{ uri: img }} style={styles.imagePreviewSmall} />
                <TouchableOpacity
                  style={styles.removeImgBtn}
                  onPress={() => setImages(images.filter((_, i) => i !== idx))}
                >
                  <Ionicons name="close-circle" size={22} color={colors.accent} />
                </TouchableOpacity>
              </View>
            ))}
            {images.length < 4 && (
              <TouchableOpacity
                style={[styles.imagePickerBtn, { borderColor: colors.border, backgroundColor: colors.faint }]}
                onPress={async () => {
                  setImageLoading(true);
                  const uri = await openImagePickerAsync();
                  if (uri) setImages([...images, uri]);
                  setImageLoading(false);
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="image-outline" size={22} color={colors.accent} style={{ marginRight: 8 }} />
                <Text style={{ color: colors.text, fontWeight: '700' }}>Add image</Text>
              </TouchableOpacity>
            )}
          </View>
          {imageLoading ? <ActivityIndicator color={colors.accent} style={{ marginTop: 10 }} /> : null}
        </View>

        <View style={[styles.fieldCard, { backgroundColor: colors.card, borderColor: colors.border }]}> 
          <Text style={[styles.label, { color: colors.text }]}>End Date & Time</Text>
          <TouchableOpacity
            style={[styles.dateInput, { borderColor: colors.border, backgroundColor: colors.faint }]}
            onPress={() => setShowDatePicker(true)}
          >
            <Ionicons name="calendar-outline" size={20} color={colors.accent} style={{ marginRight: 8 }} />
            <Text style={{ color: colors.text }}>
              {endDate ? endDate.toLocaleString() : 'Pick end date & time'}
            </Text>
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={endDate || new Date()}
              mode="datetime"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              onChange={(_, date) => {
                setShowDatePicker(false);
                if (date) setEndDate(date);
              }}
            />
          )}
        </View>
        <TouchableOpacity style={[styles.createBtn, { backgroundColor: colors.accent }]} onPress={handleCreateAuction} disabled={loading} activeOpacity={0.9}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '900', fontSize: 18 }}>Create Auction</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  form: { padding: 18, paddingBottom: 40 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 24, fontWeight: '900' },
  heroCard: {
    borderRadius: 24,
    padding: 20,
    flexDirection: 'row',
    marginBottom: 18,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  heroKicker: {
    color: 'rgba(255,255,255,0.8)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontSize: 12,
    fontWeight: '700',
  },
  heroTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 6,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.85)',
    marginTop: 4,
  },
  heroStats: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 16,
  },
  heroStatLabel: {
    color: 'rgba(255,255,255,0.7)',
    textTransform: 'uppercase',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  heroStatValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 2,
  },
  fieldCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  label: {
    fontWeight: '800',
    fontSize: 15,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    fontSize: 16,
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  imagePreviewSmall: {
    width: 82,
    height: 82,
    borderRadius: 12,
  },
  removeImgBtn: {
    position: 'absolute',
    top: -10,
    right: -10,
  },
  imagePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 4,
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
  },
  createBtn: {
    marginTop: 12,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
