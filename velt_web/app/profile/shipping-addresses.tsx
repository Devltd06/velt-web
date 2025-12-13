import React, { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, TextInput, TouchableOpacity, Alert, FlatList } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useProfileStore } from '@/lib/store/profile';
import { useTheme } from 'app/themes';
import { Ionicons } from '@expo/vector-icons';
import SwipeBackContainer from '@/components/SwipeBackContainer';

export default function ShippingAddresses() {
  const { profile } = useProfileStore();
  const { colors } = useTheme();

  const [loading, setLoading] = useState(true);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [label, setLabel] = useState('');
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [city, setCity] = useState('');
  const [stateProv, setStateProv] = useState('');
  const [postal, setPostal] = useState('');
  const [country, setCountry] = useState('');
  const [phone, setPhone] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  useEffect(() => { fetchList(); }, [profile?.id]);

  const fetchList = async () => {
    if (!profile?.id) return setLoading(false);
    setLoading(true);
    try {
      const { data } = await supabase.from('shipping_addresses').select('*').eq('user_id', profile.id).order('created_at', { ascending: false });
      setAddresses((data as any[]) || []);
    } catch (err) {
      console.warn('shipping fetch', err);
    } finally { setLoading(false); }
  };

  const addAddress = async () => {
    if (!profile?.id) return Alert.alert('Sign in', 'Sign in to add an address');
    if (!line1 || !city || !country) return Alert.alert('Missing info', 'Please provide line1, city and country');
    try {
      if (isDefault) {
        // unset other defaults
        await supabase.from('shipping_addresses').update({ is_default: false }).eq('user_id', profile.id);
      }
      const { error } = await supabase.from('shipping_addresses').insert({ user_id: profile.id, label: label || null, line1, line2: line2 || null, city, state_province: stateProv || null, postal_code: postal || null, country, phone: phone || null, is_default: isDefault });
      if (error) throw error;
      setLabel(''); setLine1(''); setLine2(''); setCity(''); setStateProv(''); setPostal(''); setCountry(''); setPhone(''); setIsDefault(false);
      fetchList();
      Alert.alert('Saved', 'Address added');
    } catch (err:any) {
      console.error('add address', err);
      Alert.alert('Error', err?.message ?? 'Could not add address');
    }
  };

  const remove = async (id: string) => {
    try { await supabase.from('shipping_addresses').delete().eq('id', id); fetchList(); } catch (e) { Alert.alert('Error', 'Could not delete'); }
  };

  return (
    <SwipeBackContainer>
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ padding: 16 }}>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: '900' }}>Shipping addresses</Text>

        <View style={{ marginTop: 12 }}>
          <Text style={{ color: colors.subtext, fontSize: 12 }}>Add a new address</Text>
          <TextInput value={label} onChangeText={setLabel} placeholder="Label (e.g. Home)" placeholderTextColor={colors.subtext} style={{ backgroundColor: colors.card, padding: 8, borderRadius: 8, marginTop: 8, color: colors.text }} />
          <TextInput value={line1} onChangeText={setLine1} placeholder="Address line 1" placeholderTextColor={colors.subtext} style={{ backgroundColor: colors.card, padding: 8, borderRadius: 8, marginTop: 8, color: colors.text }} />
          <TextInput value={line2} onChangeText={setLine2} placeholder="Address line 2" placeholderTextColor={colors.subtext} style={{ backgroundColor: colors.card, padding: 8, borderRadius: 8, marginTop: 8, color: colors.text }} />
          <TextInput value={city} onChangeText={setCity} placeholder="City" placeholderTextColor={colors.subtext} style={{ backgroundColor: colors.card, padding: 8, borderRadius: 8, marginTop: 8, color: colors.text }} />
          <TextInput value={stateProv} onChangeText={setStateProv} placeholder="State / Province" placeholderTextColor={colors.subtext} style={{ backgroundColor: colors.card, padding: 8, borderRadius: 8, marginTop: 8, color: colors.text }} />
          <TextInput value={postal} onChangeText={setPostal} placeholder="Postal code" placeholderTextColor={colors.subtext} style={{ backgroundColor: colors.card, padding: 8, borderRadius: 8, marginTop: 8, color: colors.text }} />
          <TextInput value={country} onChangeText={setCountry} placeholder="Country" placeholderTextColor={colors.subtext} style={{ backgroundColor: colors.card, padding: 8, borderRadius: 8, marginTop: 8, color: colors.text }} />
          <TextInput value={phone} onChangeText={setPhone} placeholder="Phone" placeholderTextColor={colors.subtext} style={{ backgroundColor: colors.card, padding: 8, borderRadius: 8, marginTop: 8, color: colors.text }} />

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
            <TouchableOpacity onPress={() => setIsDefault(s => !s)} style={{ padding: 8, borderRadius: 8, backgroundColor: isDefault ? colors.accent : colors.faint }}>
              <Text style={{ color: isDefault ? '#fff' : colors.text }}>Default address</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={addAddress} style={{ paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, backgroundColor: colors.accent }}>
              <Text style={{ color: '#fff', fontWeight: '800' }}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ marginTop: 20 }}>
          <Text style={{ color: colors.text, fontWeight: '800' }}>Saved addresses</Text>
          <FlatList data={addresses} keyExtractor={(i)=>String(i.id)} renderItem={({item}) => (
            <View style={{ marginTop: 12, padding: 12, borderRadius: 8, backgroundColor: colors.card }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: colors.text, fontWeight: '700' }}>{item.label || `${item.line1}, ${item.city}`}</Text>
                <TouchableOpacity onPress={() => remove(item.id)}><Ionicons name="trash-outline" size={18} color={colors.subtext} /></TouchableOpacity>
              </View>
              <Text style={{ color: colors.subtext, marginTop: 6 }}>{item.line1} {item.line2 ? `· ${item.line2}` : ''} · {item.city} {item.postal_code ? `· ${item.postal_code}` : ''}</Text>
            </View>
          )} />
        </View>

      </View>
    </SafeAreaView>
    </SwipeBackContainer>
  );
}
