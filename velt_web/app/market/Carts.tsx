import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
  Modal,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import SimpleHeader from '@/components/SimpleHeader';
import SwipeBackContainer from '@/components/SwipeBackContainer';
import { supabase } from '@/lib/supabase';
import { publicUrlFromShopr } from '@/lib/storage';
import { useRouter } from 'expo-router';
import { withSafeRouter } from '@/lib/navigation';
import { useProfileStore } from '@/lib/store/profile';
import { useMarketTheme } from '@/utils/marketTheme';

const PLACEHOLDER_IMAGE = 'https://via.placeholder.com/300';

type Product = {
  id: string;
  title: string;
  images?: string[] | null;
  image_url?: string | null;
  price?: number | null;
};

type CartItem = {
  id: string;
  user_id: string;
  product_id: string;
  seller_id?: string | null;
  quantity?: number;
  product?: Product;
  seller?: { id: string; full_name?: string | null; avatar_url?: string | null } | null;
  created_at?: string;
};

const imageFromProduct = (product?: Product | null) => {
  if (!product) return PLACEHOLDER_IMAGE;
  const first = Array.isArray(product.images) && product.images.length ? product.images[0] : (typeof product.image_url === 'string' && product.image_url.length ? product.image_url : null);
  if (!first) return PLACEHOLDER_IMAGE;
  return publicUrlFromShopr(first) || first || PLACEHOLDER_IMAGE;
};

const formatPrice = (value?: number | null, currency = 'GHS') => {
  const num = typeof value === 'number' ? value : Number(value ?? 0);
  const safeNum = Number.isFinite(num) ? num : 0;
  return `${currency} ${safeNum.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
};

export default function CartsScreen() {
  const router = withSafeRouter(useRouter());
  const { profile } = useProfileStore();
  const { colors } = useMarketTheme();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [sendingOrder, setSendingOrder] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [checkoutVisible, setCheckoutVisible] = useState(false);
  const sheetAnim = useRef(new Animated.Value(0)).current;

  const fetchCart = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      // Attempt to include product->stores relation; if DB doesn't support it
      // yet, retry without the stores join so the carts page still works.
      let data: any = null;
      let error: any = null;
      // fetch carts with product data only (no joins to stores or profiles)
      const selWithoutRelations = "*, product:products(id, sku, title, description, price, images, size, color, material, brand, category, stock)";

      try {
        const res = await supabase.from('carts').select(selWithoutRelations).eq('user_id', profile.id);
        data = res.data;
        error = res.error;
      } catch (e) {
        error = e;
      }

      if (error && String(error.message || error).toLowerCase().includes('store') && String(error.message || error).toLowerCase().includes('does not exist')) {
        try {
          const res2 = await supabase.from('carts').select(selWithoutRelations).eq('user_id', profile.id);
          data = res2.data;
          error = res2.error;
        } catch (e2) {
          error = e2;
        }
      }

      if (error) throw error;
      const items = Array.isArray(data) ? (data as CartItem[]).map((item) => ({ ...item, quantity: item.quantity ?? 1 })) : [];
      setCartItems(items);
    } catch (err: any) {
      setErrorMsg(err?.message ?? 'Could not fetch cart items.');
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  const totals = useMemo(() => {
    const subtotal = cartItems.reduce((sum, item) => {
      const price = Number(item.product?.price ?? 0);
      const qty = item.quantity ?? 1;
      return sum + price * qty;
    }, 0);
    const itemCount = cartItems.reduce((sum, item) => sum + (item.quantity ?? 1), 0);
    const sellers = new Set(
      cartItems
        .map((item) => item.seller_id || item.seller?.id || (item.product as any)?.profiles?.id)
        .filter(Boolean)
    ).size;
    const shipping = itemCount ? Math.max(25, subtotal * 0.04) : 0;
    const service = itemCount ? subtotal * 0.015 : 0;
    const grandTotal = subtotal + shipping + service;
    return { subtotal, shipping, service, grandTotal, itemCount, sellers };
  }, [cartItems]);

  const handleQuantityChange = (index: number, delta: number) => {
    setCartItems((prev) => {
      const next = [...prev];
      const currentQty = next[index]?.quantity ?? 1;
      const newQty = Math.max(1, currentQty + delta);
      next[index] = { ...next[index], quantity: newQty };
      return next;
    });
  };

  const removeFromCart = async (cartId: string) => {
    try {
      const { error } = await supabase.from('carts').delete().eq('id', cartId);
      if (error) throw error;
      setCartItems((items) => items.filter((item) => item.id !== cartId));
    } catch {
      Alert.alert('Error', 'Could not remove item.');
    }
  };

  const openCheckout = () => {
    setCheckoutVisible(true);
    Animated.timing(sheetAnim, {
      toValue: 1,
      duration: 320,
      easing: Easing.out(Easing.exp),
      useNativeDriver: true,
    }).start();
  };

  const closeCheckout = () => {
    Animated.timing(sheetAnim, {
      toValue: 0,
      duration: 240,
      easing: Easing.in(Easing.exp),
      useNativeDriver: true,
    }).start(() => setCheckoutVisible(false));
  };

  const checkoutToSellers = async () => {
    if (!profile?.id || !profile?.full_name) return;
    setSendingOrder(true);

    const itemsBySeller: Record<string, CartItem[]> = {};
    cartItems.forEach((item) => {
      const sellerId = (item.seller_id as string) || (item.seller?.id as string) || (item.product as any)?.profiles?.id;
      if (!sellerId || sellerId === profile.id) return;
      if (!itemsBySeller[sellerId]) itemsBySeller[sellerId] = [];
      itemsBySeller[sellerId].push(item);
    });

    if (!Object.keys(itemsBySeller).length) {
      Alert.alert('Checkout', 'No valid sellers found for this order.');
      setSendingOrder(false);
      return;
    }

    let allSuccess = true;

    for (const sellerId of Object.keys(itemsBySeller)) {
      const sellerItems = itemsBySeller[sellerId];
      const summary = sellerItems
        .map((item) => `${item.product?.title} x ${item.quantity ?? 1} = ${formatPrice((item.product?.price ?? 0) * (item.quantity ?? 1), 'GHS')}`)
        .join('\n');
      const orderText = `Order from ${profile.full_name}\n${summary}\nTotal: ${formatPrice(
        sellerItems.reduce((sum, item) => sum + (item.product?.price ?? 0) * (item.quantity ?? 1), 0),
        'GHS'
      )}`;

      let conversationId: string | null = null;
      try {
        const { data: buyerParts } = await supabase
          .from('conversation_participants')
          .select('conversation_id')
          .eq('user_id', profile.id);
        const buyerConvos = (buyerParts || []).map((row: any) => row.conversation_id);

        const { data: sellerParts } = await supabase
          .from('conversation_participants')
          .select('conversation_id')
          .eq('user_id', sellerId);
        const sellerConvos = (sellerParts || []).map((row: any) => row.conversation_id);

        const sharedIds = buyerConvos.filter((id: string) => sellerConvos.includes(id));
        if (sharedIds.length) {
          const { data: convos } = await supabase
            .from('conversations')
            .select('id, is_group')
            .in('id', sharedIds)
            .eq('is_group', false);
          for (const convo of convos || []) {
            const { data: participants } = await supabase
              .from('conversation_participants')
              .select('user_id')
              .eq('conversation_id', convo.id);
            if ((participants || []).length === 2) {
              conversationId = convo.id;
              break;
            }
          }
        }

        if (!conversationId) {
          const { data: convo, error: convoErr } = await supabase
            .from('conversations')
            .insert({ is_group: false, created_by: profile.id })
            .select('id')
            .single();
          if (convoErr || !convo?.id) throw convoErr || new Error('Failed to create conversation');
          conversationId = convo.id;
          let partErr: any = null;
          try {
            const { error } = await supabase.from('conversation_participants').insert([
              { conversation_id: conversationId, user_id: profile.id, accepted: true },
              { conversation_id: conversationId, user_id: sellerId, accepted: false },
            ]);
            partErr = error;
          } catch (e) { partErr = e; }
          if (partErr) {
            console.warn('conversation_participants insert failed with accepted flag', partErr);
            try {
              const { error: fbErr } = await supabase.from('conversation_participants').insert([
                { conversation_id: conversationId, user_id: profile.id },
                { conversation_id: conversationId, user_id: sellerId },
              ]);
              if (fbErr) throw fbErr;
            } catch (e) {
              throw e; // bubbled up to the outer catch which cleans up
            }
          }
        }
      } catch (error) {
        allSuccess = false;
        console.log('Conversation error', error);
        continue;
      }

      try {
        // invites are prompt-driven via conversation_participants.accepted; do not insert system messages

        const { error: sendErr } = await supabase
          .from('messages')
          .insert({ conversation_id: conversationId, sender_id: profile.id, content: `[Order]\n${orderText}` });
        if (sendErr) {
          allSuccess = false;
          console.log('Message send error', sendErr);
        }
      } catch (error) {
        allSuccess = false;
        console.log('Message exception', error);
      }

      // --- Marketplace order creation logic ---
      try {
        const sellerTotal = sellerItems.reduce((sum, item) => sum + (item.product?.price ?? 0) * (item.quantity ?? 1), 0);
        const { data: orderData, error: orderErr } = await supabase
          .from('orders')
          .insert({ buyer_id: profile.id, seller_id: sellerId, shipping_address_id: null, total: sellerTotal })
          .select('id')
          .single();
        if (orderErr || !orderData?.id) {
          allSuccess = false;
          console.log('order create error', orderErr);
        } else {
          const orderId = orderData.id;
          const itemsToInsert = sellerItems.map((it) => ({
            order_id: orderId,
            product_id: it.product_id,
            variant_id: (it as any).variant_id ?? null,
            seller_id: sellerId,
            unit_price: Number(it.product?.price ?? 0),
            quantity: it.quantity ?? 1,
            total: Number(it.product?.price ?? 0) * (it.quantity ?? 1),
          }));
          const { error: itemsErr } = await supabase.from('order_items').insert(itemsToInsert);
          if (itemsErr) {
            allSuccess = false;
            console.log('order items insert error', itemsErr);
          } else {
            // remove purchased items from carts
            const cartIds = sellerItems.map((it) => it.id);
            try {
              await supabase.from('carts').delete().in('id', cartIds);
            } catch (e) {}
          }
        }
      } catch (error) {
        allSuccess = false;
        console.log('order creation exception', error);
      }
      // --- End order creation logic ---
    }

    setSendingOrder(false);
    closeCheckout();
    Alert.alert('Order', allSuccess ? 'Order summary sent to sellers!' : 'Some orders could not be delivered.');
  };

  const renderCartItem = (item: CartItem, index: number) => {
    // Replace seller logic with VELT branding
    const avatar = 'https://via.placeholder.com/40';
    const image = imageFromProduct(item.product);
    const price = Number(item.product?.price ?? 0);

    return (
      <View key={`${item.id}-${index}`} style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Image source={{ uri: image }} style={styles.productImage} />
        <View style={{ flex: 1, marginLeft: 14 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Text style={[styles.productTitle, { color: colors.text }]} numberOfLines={2}>
              {item.product?.title}
            </Text>
            <TouchableOpacity onPress={() => removeFromCart(item.id)} style={[styles.iconPill, { backgroundColor: colors.faint }]}>
              <Ionicons name="trash-outline" size={18} color={colors.subtext} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.productPrice, { color: colors.accent }]}>{formatPrice(price)}</Text>
          <View style={styles.metaRow}>
            <Image source={{ uri: avatar }} style={[styles.sellerAvatar, { borderColor: colors.border }]} />
            <Text style={{ color: colors.subtext, fontWeight: '700', marginLeft: 8 }}>VELT</Text>
            <TouchableOpacity onPress={() => handleQuantityChange(index, 1)} style={[styles.qtyBtn, { backgroundColor: colors.faint }]}>
              <Ionicons name="add" size={16} color={colors.text} />
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
            <Text style={{ color: colors.subtext, fontWeight: '700' }}>{formatPrice(price * (item.quantity ?? 1))}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SwipeBackContainer>
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <View style={[styles.headerRow, { borderColor: colors.border }]}>
          <SimpleHeader title="Your Cart" rightAction={{ icon: 'cart-outline' }} />
          <Text style={{ color: colors.subtext, marginTop: 4 }}>Curate and send in one tap</Text>
        </View>

        <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.heroKicker, { color: colors.subtext }]}>Order summary</Text>
            <Text style={[styles.heroTitle, { color: colors.text }]}>{totals.itemCount || 0} items ready</Text>
            <Text style={[styles.heroSubtitle, { color: colors.subtext }]}>Linked to {totals.sellers} seller{totals.sellers === 1 ? '' : 's'}.</Text>
            <View style={styles.heroStats}>
              <View>
                <Text style={[styles.heroStatLabel, { color: colors.subtext }]}>Value</Text>
                <Text style={[styles.heroStatValue, { color: colors.text }]}>{formatPrice(totals.subtotal)}</Text>
              </View>
              <View>
                <Text style={[styles.heroStatLabel, { color: colors.subtext }]}>Shipping est.</Text>
                <Text style={[styles.heroStatValue, { color: colors.text }]}>{formatPrice(totals.shipping)}</Text>
              </View>
            </View>
          </View>
          <TouchableOpacity onPress={fetchCart} style={[styles.heroRefresh, { backgroundColor: colors.faint }]}>
            {loading ? <ActivityIndicator color={colors.accent} /> : <Ionicons name="refresh" size={20} color={colors.text} />}
          </TouchableOpacity>
        </View>

        {errorMsg ? (
          <View style={[styles.alertCard, { backgroundColor: colors.faint, borderColor: colors.border }]}>
            <Ionicons name="warning-outline" size={18} color={colors.accent} style={{ marginRight: 8 }} />
            <Text style={{ color: colors.text, flex: 1 }}>{errorMsg}</Text>
          </View>
        ) : null}

        {loading && !cartItems.length ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
        ) : null}

        {!loading && cartItems.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="bag-outline" size={56} color={colors.subtext} />
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800', marginTop: 12 }}>No saved items yet</Text>
            <Text style={{ color: colors.subtext, textAlign: 'center', marginTop: 6 }}>
              Browse Shopr and tap the cart icon on any listing to collect it here.
            </Text>
            <TouchableOpacity onPress={() => Alert.alert('Tip', 'Jump back to Shopr tab to add products.')} style={[styles.browseBtn, { borderColor: '#fff', backgroundColor: 'transparent' }]}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>Browse marketplace</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
            {cartItems.map(renderCartItem)}
          </View>
        )}

        {cartItems.length > 0 && (
          <View style={{ paddingHorizontal: 16 }}>
            <View style={[styles.breakdownCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Row label="Subtotal" value={formatPrice(totals.subtotal)} color={colors} />
              <Row label="Shipping estimate" value={formatPrice(totals.shipping)} color={colors} />
              <Row label="Service fee" value={formatPrice(totals.service)} color={colors} />
              <View style={styles.rowDivider} />
              <Row label="Total due" value={formatPrice(totals.grandTotal)} bold color={colors} />
            </View>
            <TouchableOpacity
              style={[styles.checkoutBtn, { backgroundColor: colors.accent }]}
              activeOpacity={0.9}
              onPress={() => router.push('/market/Checkout')}
            >
              <Text style={styles.checkoutText}>Checkout</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <Modal visible={checkoutVisible} transparent animationType="none" onRequestClose={closeCheckout}>
        <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={closeCheckout} />
        <Animated.View
          style={[
            styles.sheet,
            { backgroundColor: colors.card },
            { transform: [{ translateY: sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [400, 0] }) }] },
          ]}
        >
          <View style={styles.sheetHandle} />
          <Text style={[styles.sheetTitle, { color: colors.text }]}>Checkout summary</Text>
          <View style={{ maxHeight: 260 }}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {cartItems.map((item, idx) => (
                <View
                  key={`${item.id}-modal-${idx}`}
                  style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}
                >
                  <Image source={{ uri: imageFromProduct(item.product) }} style={styles.miniImage} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={{ color: colors.text }} numberOfLines={1}>
                      {item.product?.title}
                    </Text>
                    <Text style={{ color: colors.subtext, fontSize: 12 }}>x {item.quantity ?? 1}</Text>
                  </View>
                  <Text style={{ color: colors.accent, fontWeight: '700' }}>
                    {formatPrice((item.product?.price ?? 0) * (item.quantity ?? 1))}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>
          <View style={styles.modalTotals}>
            <Row label="Subtotal" value={formatPrice(totals.subtotal)} color={colors} />
            <Row label="Shipping" value={formatPrice(totals.shipping)} color={colors} />
            <Row label="Service fee" value={formatPrice(totals.service)} color={colors} />
            <Row label="Grand total" value={formatPrice(totals.grandTotal)} bold color={colors} />
          </View>
          <TouchableOpacity
            style={[styles.checkoutBtn, { backgroundColor: colors.accent }]}
            activeOpacity={0.9}
            disabled={sendingOrder}
            onPress={checkoutToSellers}
          >
            {sendingOrder ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.checkoutText}>Send order to sellers</Text>
            )}
          </TouchableOpacity>
        </Animated.View>
      </Modal>
    </SafeAreaView>
    </SwipeBackContainer>
  );
}

type RowProps = {
  label: string;
  value: string;
  color: { text: string; subtext: string };
  bold?: boolean;
};

const Row = ({ label, value, color, bold }: RowProps) => (
  <View style={styles.row}>
    <Text style={{ color: color.subtext }}>{label}</Text>
    <Text style={{ color: color.text, fontWeight: bold ? '900' : '700' }}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 8 : 12,
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 26,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
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
    fontSize: 22,
    fontWeight: '900',
    marginTop: 6,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
  },
  heroStats: {
    flexDirection: 'row',
    marginTop: 18,
    gap: 24,
  },
  heroStatLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroStatValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  heroRefresh: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  emptyState: {
    marginHorizontal: 20,
    marginTop: 32,
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
  },
  browseBtn: {
    marginTop: 20,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  itemCard: {
    flexDirection: 'row',
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 3,
  },
  productImage: {
    width: 86,
    height: 86,
    borderRadius: 16,
    backgroundColor: '#111',
  },
  productTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  productPrice: {
    fontSize: 15,
    fontWeight: '900',
    marginTop: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  sellerAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: {
    fontWeight: '800',
    fontSize: 16,
    marginHorizontal: 14,
  },
  iconPill: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  breakdownCard: {
    marginTop: 10,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  checkoutBtn: {
    marginTop: 16,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkoutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 22,
    minHeight: 360,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 20,
  },
  sheetHandle: {
    width: 50,
    height: 5,
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 12,
  },
  miniImage: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#111',
  },
  modalTotals: {
    marginTop: 10,
    gap: 8,
  },
});
