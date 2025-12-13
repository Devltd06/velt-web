import React, { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, ActivityIndicator, FlatList, TouchableOpacity, Image, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { withSafeRouter } from '@/lib/navigation';
import { supabase } from '@/lib/supabase';
import { publicUrlFromShopr } from '@/lib/storage';
import { useMarketTheme } from '@/utils/marketTheme';
import SimpleHeader from '@/components/SimpleHeader';
import SwipeBackContainer from '@/components/SwipeBackContainer';

export default function OrderDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = withSafeRouter(useRouter());
  const { colors } = useMarketTheme();
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<any | null>(null);

  useEffect(() => { if (id) load(); }, [id]);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('orders').select('*, order_items(*), shipping_address(*)').eq('id', id).single();
      setOrder(data || null);
    } catch (err) {
      console.warn('order load err', err);
      Alert.alert('Error', 'Could not load order');
    } finally { setLoading(false); }
  };

  if (loading) return <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator/></SafeAreaView>;
  if (!order) return <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.subtext }}>Order not found.</Text></SafeAreaView>;

  return (
    <SwipeBackContainer>
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ padding: 16 }}>
        <SimpleHeader title={`Order ${String(order.id).slice(0,8)}`} />

        <View style={{ marginTop: 12, padding: 12, backgroundColor: colors.card, borderRadius: 12 }}>
          <Text style={{ color: colors.text, fontWeight: '800' }}>Total: ₵{Number(order.total ?? 0).toFixed(2)}</Text>
          <Text style={{ color: colors.subtext, marginTop: 6 }}>Status: {order.status ?? 'pending'}</Text>
          {order.shipping_address ? (
            <View style={{ marginTop: 8 }}>
              <Text style={{ color: colors.subtext, fontWeight: '700' }}>Shipping</Text>
              <Text style={{ color: colors.text }}>{order.shipping_address.line1}{order.shipping_address.line2 ? `, ${order.shipping_address.line2}` : ''}</Text>
              <Text style={{ color: colors.subtext }}>{order.shipping_address.city}{order.shipping_address.postal_code ? ` • ${order.shipping_address.postal_code}` : ''}</Text>
            </View>
          ) : null}
        </View>

        <View style={{ marginTop: 16 }}>
          <Text style={{ color: colors.subtext, fontWeight: '700', marginBottom: 8 }}>Items</Text>
          <FlatList data={order.order_items || []} keyExtractor={(i:any) => String(i.id)} renderItem={({item}:any) => (
            <View style={{ padding: 12, backgroundColor: colors.faint, borderRadius: 10, marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {item.product?.images?.[0] ? <Image source={{ uri: publicUrlFromShopr(String(item.product.images[0])) || String(item.product.images[0]) }} style={{ width: 64, height: 48, borderRadius: 6, marginRight: 12 }} /> : null}
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: '800' }}>{item.product?.title ?? 'Item'}</Text>
                  <Text style={{ color: colors.subtext }}>{item.quantity} × ₵{item.unit_price} = ₵{item.total}</Text>
                </View>
                <TouchableOpacity onPress={() => router.push({ pathname: '/market/product-details', params: { id: item.product_id } })} style={{ marginLeft: 8 }}>
                  <Text style={{ color: colors.accent, fontWeight: '700' }}>View</Text>
                </TouchableOpacity>
              </View>
            </View>
          )} />
        </View>
      </View>
    </SafeAreaView>
    </SwipeBackContainer>
  );
}
