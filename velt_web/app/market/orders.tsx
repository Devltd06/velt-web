import React, { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import SimpleHeader from '@/components/SimpleHeader';
import SwipeBackContainer from '@/components/SwipeBackContainer';
import { supabase } from '@/lib/supabase';
import { useProfileStore } from '@/lib/store/profile';
import { useMarketTheme } from '@/utils/marketTheme';
import { useRouter } from 'expo-router';
import { withSafeRouter } from '@/lib/navigation';

export default function OrdersPage() {
  const router = withSafeRouter(useRouter());
  const { profile } = useProfileStore();
  const { colors } = useMarketTheme();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);

  useEffect(() => { if (profile?.id) fetchOrders(); }, [profile?.id]);

  const fetchOrders = async () => {
    if (!profile?.id) return setLoading(false);
    setLoading(true);
    try {
      // fetch orders where you're a buyer or a seller
      const filter = `buyer_id.eq.${profile.id},seller_id.eq.${profile.id}`;
      const { data } = await supabase.from('orders').select('*, order_items(*)').or(filter).order('created_at', { ascending: false });
      setOrders((data as any[]) || []);
    } catch (err) {
      console.warn('orders fetch err', err);
    } finally { setLoading(false); }
  };

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity onPress={() => router.push({ pathname: '/market/orders/[id]', params: { id: item.id } })} style={{ marginVertical: 8, padding: 12, backgroundColor: colors.card, borderRadius: 10 }}>
      <Text style={{ color: colors.text, fontWeight: '800' }}>Order {String(item.id).slice(0,8)} — {item.status}</Text>
      <Text style={{ color: colors.subtext, marginTop: 6 }}>Total: ₵{Number(item.total ?? 0).toFixed(2)}</Text>
      <View style={{ marginTop: 8 }}>
        {((item.order_items || []) as any[]).map((it) => (
          <View key={it.id} style={{ paddingVertical: 8, borderTopWidth: 1, borderColor: colors.faint }}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>{it.product_id ? (it.product?.title ?? 'Product') : 'Item'}</Text>
            <Text style={{ color: colors.subtext }}>{it.quantity} × ₵{it.unit_price} = ₵{it.total}</Text>
          </View>
        ))}
      </View>
    </TouchableOpacity>
  );

  if (loading) return <SafeAreaView style={{ flex:1, alignItems:'center', justifyContent:'center' }}><ActivityIndicator/></SafeAreaView>;

  return (
    <SwipeBackContainer>
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ padding: 16 }}>
        <SimpleHeader title="Orders" />
        {orders.length === 0 ? (
          <Text style={{ color: colors.subtext, marginTop: 12 }}>No orders found.</Text>
        ) : (
          <FlatList data={orders} keyExtractor={(o) => String(o.id)} renderItem={renderItem as any} style={{ marginTop: 12 }} />
        )}
      </View>
    </SafeAreaView>
    </SwipeBackContainer>
  );
}
