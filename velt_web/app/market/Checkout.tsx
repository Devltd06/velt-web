import React, { useEffect, useState } from 'react';
import { Platform, Modal } from 'react-native';
import { WebView } from 'react-native-webview';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, FlatList, Image, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SimpleHeader from '@/components/SimpleHeader';
import SwipeBackContainer from '@/components/SwipeBackContainer';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { publicUrlFromShopr } from '@/lib/storage';
import { PAYSTACK_MERCHANT_CURRENCY, PAYSTACK_PUBLIC_KEY } from '../utils/paystackConfig';
import { useRouter } from 'expo-router';
import { withSafeRouter } from '@/lib/navigation';
import { useProfileStore } from '@/lib/store/profile';
import { useMarketTheme } from '@/utils/marketTheme';

export default function CheckoutScreen() {
  const { profile } = useProfileStore();
  const { colors } = useMarketTheme();
  const [loading, setLoading] = useState(false);
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [payReference, setPayReference] = useState<string | null>(null);
  const [verifyPolling, setVerifyPolling] = useState<boolean>(false);
  const [addressExpanded, setAddressExpanded] = useState<boolean>(true);
  const [inAppWebVisible, setInAppWebVisible] = useState(false);
  const [inAppUrl, setInAppUrl] = useState<string | null>(null);
  const [inAppHtml, setInAppHtml] = useState<string | null>(null);
  const [pendingPaymentId, setPendingPaymentId] = useState<string | null>(null);
  const [autoRedirected, setAutoRedirected] = useState(false);
  const router = withSafeRouter(useRouter());

  useEffect(() => {
    fetchCartAndAddresses();
  }, []);

  const fetchCartAndAddresses = async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      // Try to include stores relation when fetching cart items — if DB hasn't
      // applied the migration yet this may error; safely retry without stores.
      let data: any = null;
      let error: any = null;
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
      setCartItems((data as any[]) || []);
      setCartItems((data as any[]) || []);

      const { data: addrs } = await supabase.from('shipping_addresses').select('*').eq('user_id', profile.id);
      setAddresses((addrs as any[]) || []);
      if (addrs && addrs.length) setSelectedAddressId(addrs[0].id);
      // If there are no shipping addresses, auto navigate users to add one
      if ((!addrs || addrs.length === 0) && !autoRedirected) {
        setAutoRedirected(true);
        // small delay to allow UI to mount before navigation
        setTimeout(() => router.push('/profile/shipping-addresses'), 300);
      }
    } catch (err:any) {
      Alert.alert('Error', err?.message ?? 'Failed to load cart.');
    } finally {
      setLoading(false);
    }
  };

  const placeOrders = async () => {
    if (!profile?.id) return;
    if (!cartItems.length) return Alert.alert('Cart empty', 'Nothing to checkout.');
    if (!selectedAddressId) return Alert.alert('No address', 'Please select a shipping address before placing an order.');
    if (!paid) return Alert.alert('Payment required', 'Please complete payment before placing your order.');

    setLoading(true);
    try {
      // All products are from VELT
      const itemsBySeller: Record<string, any[]> = { VELT: cartItems };
      for (const sellerId of Object.keys(itemsBySeller)) {
        const sellerItems = itemsBySeller[sellerId];
        const total = sellerItems.reduce((s:any, i:any) => s + (i.product?.price ?? 0) * (i.quantity ?? 1), 0);

        // create order
        const { data: orderData, error: orderErr } = await supabase
          .from('orders')
          .insert({ buyer_id: profile.id, seller_id: sellerId, shipping_address_id: selectedAddressId, total })
          .select('id')
          .single();

        if (orderErr || !orderData?.id) {
          console.warn('order create failed', orderErr);
          continue;
        }
        const orderId = orderData.id;

        const itemsToInsert = sellerItems.map((it:any) => ({
          order_id: orderId,
          product_id: it.product_id,
          variant_id: it.variant_id ?? null,
          seller_id: sellerId,
          unit_price: Number(it.product?.price ?? 0),
          quantity: it.quantity ?? 1,
          total: Number(it.product?.price ?? 0) * (it.quantity ?? 1),
        }));

        await supabase.from('order_items').insert(itemsToInsert);

        // decrement stock for each item
        for (const it of itemsToInsert) {
          try {
            // Fetch current stock to avoid negative totals
            const { data: prod } = await supabase.from('products').select('id, stock').eq('id', it.product_id).single();
            const currentStock = (prod?.stock ?? null);
            if (typeof currentStock === 'number') {
              const nextStock = Math.max(0, Number(currentStock) - Number(it.quantity ?? 1));
              await supabase.from('products').update({ stock: nextStock }).eq('id', it.product_id);
            }
          } catch (uErr) {
            console.warn('checkout: failed to update product stock', uErr);
          }
        }
        // remove cart rows
        const cartIds = sellerItems.map((s:any) => s.id);
        await supabase.from('carts').delete().in('id', cartIds);
      }

      // route buyer to orders page to track status (do not show redundant 'orders created' popup)
      fetchCartAndAddresses();
      router.push('/market/orders');
    } catch (err:any) {
      console.error('checkout err', err);
      Alert.alert('Error', err?.message ?? 'Could not place order.');
    } finally {
      setLoading(false);
    }
  };

  // helper used by client-only flow after a successful payment
  const finalizeOrdersAfterPayment = async (paymentId: string | null) => {
    if (!profile?.id) return;
    if (!cartItems.length) return;
    if (!selectedAddressId) {
      Alert.alert('No address', 'Please add a shipping address before placing an order.');
      return;
    }

    try {
      // avoid duplicate creation: check payment metadata for order_ids
      let payRow: any = null;
      if (paymentId) {
        const { data: p } = await supabase.from('payments').select('*, metadata').eq('id', paymentId).single();
        payRow = p;
      }
      if (payRow && payRow.metadata && Array.isArray(payRow.metadata.order_ids) && payRow.metadata.order_ids.length) {
        // already created orders for this payment
        return;
      }

      // All products are from VELT
      const itemsBySeller: Record<string, any[]> = { VELT: cartItems };
      const createdOrders: string[] = [];

      for (const sellerId of Object.keys(itemsBySeller)) {
        const sellerItems = itemsBySeller[sellerId];
        const total = sellerItems.reduce((s: any, i: any) => s + (i.product?.price ?? 0) * (i.quantity ?? 1), 0);

        const { data: orderData, error: orderErr } = await supabase
          .from('orders')
          .insert({ buyer_id: profile.id, seller_id: sellerId, shipping_address_id: selectedAddressId, total })
          .select('id')
          .single();

        if (orderErr || !orderData?.id) {
          console.warn('order create failed (auto)', orderErr);
          continue;
        }
        const orderId = orderData.id;
        createdOrders.push(orderId);

        const itemsToInsert = sellerItems.map((it: any) => ({
          order_id: orderId,
          product_id: it.product_id,
          variant_id: it.variant_id ?? null,
          seller_id: sellerId,
          unit_price: Number(it.product?.price ?? 0),
          quantity: it.quantity ?? 1,
          total: Number(it.product?.price ?? 0) * (it.quantity ?? 1),
        }));

        const { error: itemsErr } = await supabase.from('order_items').insert(itemsToInsert);
        if (itemsErr) console.warn('order_items insert failed (auto)', itemsErr);

        // decrement stock for these items (auto finalize flow)
        for (const it of itemsToInsert) {
          try {
            const { data: prod } = await supabase.from('products').select('id, stock').eq('id', it.product_id).single();
            const currentStock = (prod?.stock ?? null);
            if (typeof currentStock === 'number') {
              const nextStock = Math.max(0, Number(currentStock) - Number(it.quantity ?? 1));
              await supabase.from('products').update({ stock: nextStock }).eq('id', it.product_id);
            }
          } catch (uErr) {
            console.warn('auto finalize: failed to update product stock', uErr);
          }
        }

        // remove cart rows
        const cartIds = sellerItems.map((s: any) => s.id).filter(Boolean);
        if (cartIds.length) await supabase.from('carts').delete().in('id', cartIds);
      }

      // update payments metadata with order ids for idempotency
      if (paymentId && createdOrders.length) {
        try {
          const meta = (payRow?.metadata) || {};
          await supabase.from('payments').update({ metadata: { ...meta, order_ids: createdOrders }, updated_at: new Date().toISOString() }).eq('id', paymentId);
        } catch (uErr) {
          console.warn('failed to update payment metadata with order ids', uErr);
        }
      }

      // refresh cart UI silently
      fetchCartAndAddresses();
    } catch (err: any) {
      console.error('auto finalize orders err', err);
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={{ padding: 12, borderBottomWidth: 1, borderColor: colors.border, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
      {Array.isArray(item.product?.images) && item.product.images[0] ? (
        <View style={{ width: 68, height: 50, borderRadius: 8, overflow: 'hidden' }}>
          <Image source={{ uri: publicUrlFromShopr(String(item.product.images[0])) || String(item.product.images[0]) }} style={{ width: '100%', height: '100%' }} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: '700' }}>{item.product?.title}</Text>
        <Text style={{ color: colors.subtext }}>{item.quantity ?? 1} × ₵{item.product?.price ?? 0}</Text>
        {item.product?.stores ? (
          <TouchableOpacity onPress={() => router.push({ pathname: '/market/store/[id]', params: { id: item.product.stores.id } })} style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {item.product?.stores?.avatar_url ? (
              <Image source={{ uri: item.product.stores.avatar_url }} style={{ width: 22, height: 22, borderRadius: 11 }} />
            ) : (
              <Ionicons name="storefront-outline" size={18} color={colors.subtext} />
            )}
            <Text style={{ color: colors.subtext, fontSize: 12 }}>{item.product.stores.title}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ color: colors.text, fontWeight: '800' }}>₵{Number((item.product?.price ?? 0) * (item.quantity ?? 1)).toFixed(2)}</Text>
      </View>
    </View>
  );

  if (loading) return <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent:'center' }}><ActivityIndicator/></SafeAreaView>;

  const orderTotal = cartItems.reduce((s:number, i:any) => s + (Number(i.product?.price ?? 0) * (i.quantity ?? 1)), 0);

  return (
    <SwipeBackContainer>
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ padding: 16 }}>
        <SimpleHeader
          title="Checkout"
          onBack={() => router.back()}
          rightAction={{ icon: 'list-outline', onPress: () => router.push('/market/orders') }}
        />
        <View style={{ marginTop: 12, backgroundColor: colors.card, borderRadius: 12, padding: 12 }}>
          <Text style={{ color: colors.subtext }}>Shipping address</Text>
          {addresses.length === 0 ? (
            <View style={{ marginTop: 8 }}>
              <Text style={{ color: colors.text }}>No shipping addresses found — add one now.</Text>
              <TouchableOpacity onPress={() => router.push('/profile/shipping-addresses')} style={{ marginTop: 8, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: colors.accent, alignSelf: 'flex-start' }}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>Add shipping address</Text>
              </TouchableOpacity>
            </View>
          ) : (
            (() => {
              const sel = addresses.find((a:any) => a.id === selectedAddressId) || addresses[0];
              return (
                <View style={{ marginTop: 8 }}>
                  <TouchableOpacity onPress={() => setAddressExpanded(!addressExpanded)} style={{ padding: 12, borderRadius: 10, backgroundColor: colors.faint, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View>
                      <Text style={{ color: colors.text, fontWeight: '700' }}>{sel.label || `${sel.line1}${sel.line2 ? ', ' + sel.line2 : ''}`}</Text>
                      <Text style={{ color: colors.subtext, fontSize: 12 }}>{sel.city} {sel.postal_code ? `· ${sel.postal_code}` : ''}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                      <TouchableOpacity onPress={() => router.push('/profile/shipping-addresses')} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}>
                        <Text style={{ color: colors.text, fontWeight: '700' }}>Edit</Text>
                      </TouchableOpacity>
                      <Ionicons name={addressExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.subtext} />
                    </View>
                  </TouchableOpacity>

                  {addressExpanded ? (
                    <View style={{ marginTop: 10, padding: 10, borderRadius: 8, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}>
                      <Text style={{ color: colors.text }}>{sel.name ? `${sel.name}` : ''}</Text>
                      <Text style={{ color: colors.subtext, marginTop: 6 }}>{sel.line1}{sel.line2 ? `, ${sel.line2}` : ''}</Text>
                      <Text style={{ color: colors.subtext }}>{sel.city}{sel.state ? `, ${sel.state}` : ''}{sel.postal_code ? ` ${sel.postal_code}` : ''}</Text>
                      {sel.phone ? <Text style={{ color: colors.subtext, marginTop: 8 }}>Phone: {sel.phone}</Text> : null}

                      {addresses.length > 1 ? (
                        <View style={{ marginTop: 12 }}>
                          <Text style={{ color: colors.subtext, fontWeight: '700', marginBottom: 8 }}>Other addresses</Text>
                          {addresses.filter((a:any) => a.id !== sel.id).map((a:any) => (
                            <TouchableOpacity key={a.id} onPress={() => setSelectedAddressId(a.id)} style={{ paddingVertical: 8 }}>
                              <Text style={{ color: colors.text }}>{a.label || `${a.line1}, ${a.city}`}</Text>
                              <Text style={{ color: colors.subtext, fontSize: 12 }}>{a.line1}{a.line2 ? ` · ${a.line2}` : ''} · {a.city}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              );
            })()
          )}
        </View>

        {/* Cart items review */}
        <View style={{ marginTop: 12, backgroundColor: colors.card, borderRadius: 12, padding: 8 }}>
          <Text style={{ color: colors.subtext, padding: 8 }}>Items being purchased</Text>
          <FlatList data={cartItems} keyExtractor={(i) => String(i.id)} renderItem={renderItem as any} />
          <View style={{ padding: 12, borderTopWidth: 1, borderColor: colors.faint, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: colors.text, fontWeight: '800' }}>Total</Text>
            <Text style={{ color: colors.text, fontWeight: '900', fontSize: 18 }}>₵{Number(orderTotal).toFixed(2)}</Text>
          </View>
        </View>

        {/* Payment section - require payment before order */}
        <View style={{ marginTop: 12, backgroundColor: colors.card, borderRadius: 12, padding: 12 }}>
          <Text style={{ color: colors.subtext }}>Payment</Text>
          <View style={{ marginTop: 8 }}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>Paystack</Text>
            <Text style={{ color: colors.subtext, marginTop: 6, fontSize: 12 }}>Pay securely with Paystack. You will be redirected to complete payment.</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <TouchableOpacity disabled={processingPayment || verifyPolling || paid} onPress={async () => {
                if (!profile?.email) return Alert.alert('Missing email', 'We need your account email to initialize payment.');
                try {
                  setProcessingPayment(true);
                  // call serverless function to initialize
                  // include full cart snapshot and shipping address in the init payload
                  const payload = {
                    amount: orderTotal,
                    email: profile.email,
                    cartItems: cartItems.map((it:any) => ({
                      cart_id: it.id,
                      product_id: it.product_id ?? it.product?.id,
                      variant_id: it.variant_id ?? null,
                      quantity: it.quantity ?? 1,
                      unit_price: Number(it.product?.price ?? it.unit_price ?? 0),
                      seller_id: it.seller_id ?? it.product?.profiles?.id ?? it.product?.stores?.owner_id ?? null,
                    })),
                    shipping_address_id: selectedAddressId ?? null,
                  };
                  // create client-side payment record (pending) instead of calling edge functions
                  try {
                    const { data: p, error: pErr } = await supabase
                      .from('payments')
                      .insert({ user_id: profile.id, amount: orderTotal, currency: PAYSTACK_MERCHANT_CURRENCY, status: 'pending', metadata: { cartItems: payload.cartItems, shipping_address_id: payload.shipping_address_id } })
                      .select('*')
                      .single();
                    if (pErr) {
                      console.warn('could not insert payment row', pErr);
                    } else {
                      setPendingPaymentId(p?.id ?? null);
                    }
                  } catch (insErr) {
                    console.warn('insert payment err', insErr);
                  }

                  // open an inline Paystack checkout inside a native WebView (or fallback to authUrl on web)
                  try {
                    // small inline page that uses Paystack's inline script and posts results back to RN WebView
                    if (Platform.OS === 'web') {
                      // we don't have a server init here — for web we still fallback to opening Paystack authUrl if available
                      await Linking.openURL(String(`https://paystack.com/pay/`));
                    } else {
                      const inlineHtml = `<!doctype html><html><head><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"></head><body><script src=\"https://js.paystack.co/v1/inline.js\"></script><script>function run(){try{const handler=PaystackPop.setup({key:'${PAYSTACK_PUBLIC_KEY}',email:'${payload.email}',amount:${Math.round(orderTotal*100)},currency:'${PAYSTACK_MERCHANT_CURRENCY}',onClose:function(){window.ReactNativeWebView.postMessage(JSON.stringify({status:'closed'}));},callback:function(response){window.ReactNativeWebView.postMessage(JSON.stringify({status:'success', reference:response.reference, payload: response}));}}); handler.openIframe();}catch(e){window.ReactNativeWebView.postMessage(JSON.stringify({status:'error', message: String(e)}));}} window.onload=run;</script></body></html>`;
                      setInAppHtml(inlineHtml);
                      // no authUrl available in client-only flow; use null and rely on inAppHtml
                        setInAppUrl(null);
                      setInAppWebVisible(true);
                    }
                  } catch (openErr) { console.warn('open inline err', openErr); }

                  setProcessingPayment(false);
                  } catch (err:any) {
                  console.error('pay init err', err);
                  setProcessingPayment(false);
                  const msg = err?.message ?? String(err) ?? 'Could not start payment';
                  Alert.alert('Payment error', msg);
                }
              }} style={{ flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', backgroundColor: paid ? '#22c55e' : (processingPayment ? '#60a5fa' : colors.accent) }}>
                {processingPayment ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800' }}>{paid ? 'Paid ✓' : 'Pay now'}</Text>}
              </TouchableOpacity>

              {/* Manual verify removed: Checkout flow now uses inline in-app verification and auto-finalizes orders */}
            </View>
          </View>
        </View>

        {/* In-app webview modal for native in-app Paystack checkout */}
        {inAppWebVisible && (inAppHtml || inAppUrl) ? (
          <Modal visible={inAppWebVisible} animationType="slide" onRequestClose={() => setInAppWebVisible(false)}>
            <SafeAreaView style={{ flex: 1 }}>
              <WebView
              source={inAppHtml ? { html: inAppHtml } : { uri: inAppUrl ?? '' }}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              originWhitelist={["*"]}
              mixedContentMode="always"
              startInLoadingState
              onMessage={async (event) => {
                try {
                  const payload = JSON.parse(event.nativeEvent.data || '{}');
                  if (payload?.status === 'success') {
                    // update payments row to paid
                    try {
                      if (pendingPaymentId) {
                        await supabase.from('payments').update({ status: 'paid', reference: payload?.reference ?? null, gateway_response: payload }).eq('id', pendingPaymentId);
                      }
                    } catch (uErr) { console.warn('failed updating payment row after success', uErr); }
                    setPaid(true);
                    // finalize orders automatically and route buyer to Orders
                    await finalizeOrdersAfterPayment(pendingPaymentId);
                    setInAppWebVisible(false);
                    router.push('/market/orders');
                  } else if (payload?.status === 'closed') {
                    setInAppWebVisible(false);
                  } else if (payload?.status === 'error') {
                    // show helpful error details from Paystack inline (if available)
                    console.warn('Paystack inline error', payload?.message ?? payload);
                    try { if (pendingPaymentId) await supabase.from('payments').update({ status: 'failed', gateway_response: payload, updated_at: new Date().toISOString() }).eq('id', pendingPaymentId); } catch (e) { console.warn('failed to update payment on inline error', e); }
                    Alert.alert('Payment error', String(payload?.message ?? 'An error occurred during payment.'));
                  }
                } catch (e) { console.warn('webview message parse err', e); }
              }}
              onNavigationStateChange={async (navState) => {
                try {
                  const url = navState?.url ?? '';
                  // Paystack typically redirects back to a configured url with reference in the query
                  // detect `reference` param and auto-verify
                  const parsed = new URL(url);
                  const referenceParam = parsed.searchParams.get('reference') || parsed.searchParams.get('trans') || parsed.searchParams.get('access_code');
                  if (referenceParam) {
                    // close the webview and mark payment paid (client-side flow)
                    setInAppWebVisible(false);
                    setInAppUrl(null);
                    setInAppHtml(null);
                    setPayReference(referenceParam);
                    try {
                      if (pendingPaymentId) {
                        await supabase.from('payments').update({ status: 'paid', reference: referenceParam }).eq('id', pendingPaymentId);
                      }
                        setPaid(true);
                        await finalizeOrdersAfterPayment(pendingPaymentId);
                        router.push('/market/orders');
                    } catch (e) { console.warn('failed to mark payment after redirect', e); }
                  }
                } catch (e) {
                  // ignore invalid url parsing
                }
              }}
            />
            </SafeAreaView>
          </Modal>
        ) : null}

        {/* Place order (button stays, but text does not show 'Pay first to place order') */}
        <TouchableOpacity onPress={placeOrders} disabled={!paid || loading} style={{ marginTop: 16, paddingVertical: 14, backgroundColor: (!paid || loading) ? '#b3d4ff' : colors.accent, borderRadius: 12, alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontWeight: '800' }}>{loading ? 'Placing order…' : 'Place order'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
    </SwipeBackContainer>
  );
}
