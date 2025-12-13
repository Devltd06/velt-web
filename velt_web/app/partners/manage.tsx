import React, { useCallback, useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { withSafeRouter } from '@/lib/navigation';
import { supabase } from '@/lib/supabase';
import { useProfileStore } from '@/lib/store/profile';
import { useTheme } from 'app/themes';
import { Ionicons } from '@expo/vector-icons';
import SwipeBackContainer from '@/components/SwipeBackContainer';

export default function PartnerManageList() {
  const { colors } = useTheme();
  const router = withSafeRouter(useRouter());
  const profile = useProfileStore((s) => s.profile);

  const [boards, setBoards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBoards = useCallback(async () => {
    if (!profile?.id) return setBoards([]);
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('billboards')
        .select('id,name,location,region,price_per_day,available_from,available_to')
        .eq('owner_id', profile.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setBoards(data ?? []);
    } catch (err) {
      console.error('fetch manage boards', err);
      Alert.alert('Unable to load', 'Could not fetch your listings');
    } finally { setLoading(false); }
  }, [profile?.id]);

  useEffect(() => { fetchBoards(); }, [fetchBoards]);

  if (!profile?.id) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: colors.text }}>Sign in to manage listings</Text>
    </SafeAreaView>
  );

  return (
    <SwipeBackContainer>
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: colors.text, fontWeight: '800', fontSize: 20 }}>Manage listings</Text>
        <TouchableOpacity onPress={() => router.push('/partners')} style={{ padding: 8 }}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>
      {loading ? <ActivityIndicator style={{ marginTop: 24 }} color={colors.accent} /> : (
        <FlatList
          data={boards}
          keyExtractor={(b) => String(b.id)}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => router.push({ pathname: '/partners/manage/[id]', params: { id: item.id } })} style={{ padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: '800' }}>{item.name}</Text>
                  <Text style={{ color: colors.subtext, marginTop: 6 }}>{item.location} • {item.region}</Text>
                  <Text style={{ color: colors.subtext, marginTop: 6 }}>{item.available_from ? `Available ${item.available_from}` : 'No availability window' }{item.available_to ? ` → ${item.available_to}` : ''}</Text>
                </View>
                <View style={{ marginLeft: 12 }}>
                  <Text style={{ color: colors.accent, fontWeight: '800' }}>{item.price_per_day ? `GHS ${item.price_per_day}` : 'Contact'}</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
    </SwipeBackContainer>
  );
}
