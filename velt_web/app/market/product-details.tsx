// app/(tabs)/market/product-details.tsx
import React, { useEffect, useState, useRef } from 'react';
import { Platform, Modal, Linking } from 'react-native';
import { WebView } from 'react-native-webview';
import {
  View,
  Text,
  Image,
  FlatList,
  TextInput,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Alert,
  Pressable,
} from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { withSafeRouter } from '@/lib/navigation';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from 'lib/supabase';
import { PAYSTACK_MERCHANT_CURRENCY, PAYSTACK_PUBLIC_KEY } from '../utils/paystackConfig';
import { SafeAreaView } from 'react-native-safe-area-context';
import dayjs from 'dayjs';
import { useColorScheme } from 'react-native';
import { useTheme, VELT_ACCENT, BUTTON_COLORS, GRADIENTS } from 'app/themes';
import { publicUrlFromShopr } from '@/lib/storage';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import MapView, { Marker } from 'react-native-maps';

// your profile store (Zustand)
import { useProfileStore } from '@/lib/store/profile';

const { width } = Dimensions.get('window');

// --- Accent (using unified VELT_ACCENT) ---
const ACCENT = VELT_ACCENT;

// (Using shared ThemeProvider: useTheme())

export default function ProductDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = withSafeRouter(useRouter());
  const { colors, isReady } = useTheme();
  const profile = useProfileStore((s) => s.profile); // current user profile from store

  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDM, setLoadingDM] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);
  const [buyNowProcessing, setBuyNowProcessing] = useState(false);
  const [inAppWebVisible, setInAppWebVisible] = useState(false);
  const [inAppUrl, setInAppUrl] = useState<string | null>(null);
  const [inAppHtml, setInAppHtml] = useState<string | null>(null);
  const [pendingPaymentId, setPendingPaymentId] = useState<string | null>(null);
  const [buyNowReference, setBuyNowReference] = useState<string | null>(null);
  const [buyVerifyPolling, setBuyVerifyPolling] = useState(false);

  const finalizeBuyNowOrder = async (paymentId: string | null, reference?: string | null) => {
    try {
      // avoid duplicate orders if metadata contains order_ids
      let payRow: any = null;
      if (paymentId) {
        const { data: p } = await supabase.from('payments').select('*, metadata').eq('id', paymentId).single();
        payRow = p;
      }
      if (payRow?.metadata?.order_ids && Array.isArray(payRow.metadata.order_ids) && payRow.metadata.order_ids.length) return;

      // ensure buyer and product exist
      if (!profile?.id || !product?.id) return;

      // create order for this single item
      const sid = product?.profiles?.id ?? (Array.isArray(product?.profiles) ? product.profiles[0]?.id : null) ?? null;
      const sellerId = sid || null;
      const totalPrice = selectedVariant?.price != null ? Number(selectedVariant.price) : (typeof product.price === 'number' ? product.price : Number(product.price) || 0);

      // shipping address - pick first available for user (if any)
      const { data: addrs } = await supabase.from('shipping_addresses').select('*').eq('user_id', profile.id).limit(1);
      const chosenAddressId = (addrs && addrs[0]?.id) ? addrs[0].id : null;

      const { data: orderData, error: orderErr } = await supabase.from('orders').insert({ buyer_id: profile.id, seller_id: sellerId, shipping_address_id: chosenAddressId, total: totalPrice }).select('id').single();
      if (orderErr || !orderData?.id) {
        console.warn('buy-now order create failed', orderErr);
        return;
      }
      const orderId = orderData.id;

      const itemsToInsert = [{ order_id: orderId, product_id: product.id, variant_id: selectedVariant?.id ?? null, seller_id: sellerId, unit_price: Number(totalPrice), quantity: 1, total: Number(totalPrice) }];
      const { error: oiErr } = await supabase.from('order_items').insert(itemsToInsert);
      if (oiErr) console.warn('buy-now order_items insert failed', oiErr);

      // decrement stock for the purchased product (single-item buy now)
      try {
        if (product?.id) {
          const currentStock = typeof product.stock === 'number' ? product.stock : null;
          if (currentStock !== null) {
            const newStock = Math.max(0, Number(currentStock) - 1);
            await supabase.from('products').update({ stock: newStock }).eq('id', product.id);
            setProduct((p:any) => ({ ...(p||{}), stock: newStock }));
          }
        }
      } catch (sErr) {
        console.warn('buy-now: failed to update product stock', sErr);
      }

      // update payment metadata with order id
      if (paymentId) {
        try {
          const meta = payRow?.metadata ?? {};
          await supabase.from('payments').update({ metadata: { ...meta, order_ids: [orderId], reference: reference ?? meta.reference ?? null }, updated_at: new Date().toISOString() }).eq('id', paymentId);
        } catch (uErr) { console.warn('failed updating payment row after buynow', uErr); }
      }
    } catch (err) {
      console.warn('finalizeBuyNowOrder err', err);
    }
  };
  const [deleting, setDeleting] = useState(false);
  const [otherItems, setOtherItems] = useState<any[]>([]);
  const [maybeYouAlsoLike, setMaybeYouAlsoLike] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [newRating, setNewRating] = useState<number>(5);
  const [newReviewText, setNewReviewText] = useState<string>('');
  const [activeImage, setActiveImage] = useState<number>(0);
  const [selectedVariant, setSelectedVariant] = useState<any | null>(null);
  const carouselRef = useRef<FlatList | null>(null);

  useEffect(() => {
    if (id) fetchProduct();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Remove all store and profile relationships from product fetch
  const selectProduct = `
    id,
    sku,
    title,
    description,
    price,
    avg_rating,
    review_count,
    size,
    color,
    material,
    brand,
    category,
    stock,
    images,
    created_at
  `;

  const fetchProduct = async () => {
    setLoading(true);
    let data: any = null;
    let error: any = null;
    try {
      const res = await supabase.from('products').select(selectProduct).eq('id', id).single();
      data = res.data;
      error = res.error;
    } catch (e) {
      error = e;
    }
    if (error) {
      Alert.alert('Error', error.message || 'Could not fetch product.');
      setLoading(false);
      return;
    }
    setProduct(data);
    setLoading(false);
  };

  // ----------------------
  // startOrOpenDM - robust utility to open/create 1:1 convo
  // ----------------------
  const startOrOpenDM = async (targetId: string, targetName?: string, targetAvatar?: string) => {
    if (!profile?.id) {
      Alert.alert('Not signed in', 'You must be signed in to message the seller.');
      return;
    }

    setLoadingDM(true);
    try {
      const currentUserId = profile.id;

      // 1) fetch conversation_ids current user participates in
      const { data: myParts, error: partsErr } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', currentUserId);

      if (partsErr) {
        console.error('Error fetching conversation_participants for current user:', partsErr);
        // continue; may still create new conversation
      }

      const myConvoIds = (myParts || []).map((p: any) => p.conversation_id);

      // 2) filter those conversations to is_group = false (DM candidates)
      let dmIds: string[] = [];
      if (myConvoIds.length) {
        const { data: dmRows, error: dmErr } = await supabase
          .from('conversations')
          .select('id')
          .in('id', myConvoIds)
          .eq('is_group', false);

        if (dmErr) {
          console.error('Error fetching DM conversation rows:', dmErr);
        } else {
          dmIds = (dmRows || []).map((r: any) => r.id);
        }
      }

      // 3) check participants for candidate dmIds (exactly {currentUserId, targetId})
      if (dmIds.length) {
        const { data: participants, error: participantsErr } = await supabase
          .from('conversation_participants')
          .select('conversation_id, user_id')
          .in('conversation_id', dmIds);

        if (participantsErr) {
          console.error('Error fetching participants for dm candidates:', participantsErr);
        } else {
          const byConvo: Record<string, Set<string>> = {};
          (participants || []).forEach((row: any) => {
            if (!byConvo[row.conversation_id]) byConvo[row.conversation_id] = new Set();
            byConvo[row.conversation_id].add(row.user_id);
          });

          for (const [cid, members] of Object.entries(byConvo)) {
            if (members.size === 2 && members.has(currentUserId) && members.has(targetId)) {
              // found existing DM -> navigate
              setLoadingDM(false);
              router.push({
                pathname: `/message/chat/${cid}`,
                params: { otherName: targetName ?? '', otherAvatar: targetAvatar ?? '' },
              });
              return;
            }
            // also populate 'you may also like' by category from variants if available
              try {
              const categories = new Set<string>();
              const cats = ((product?.product_variants || []) as any[]).map((v:any) => v.category).filter(Boolean);
              cats.forEach((c:any) => categories.add(c));
              let maybe: any[] = [];
              if (categories.size) {
                const cat = Array.from(categories)[0];
                // find product ids that have variants in the same category
                const { data: pvrows } = await supabase.from('product_variants').select('product_id').eq('category', cat).limit(40);
                const ids = (pvrows || []).map((r:any) => r.product_id).filter((pid:any) => pid !== id);
                if (ids.length) {
                  const { data: rel } = await supabase.from('products').select('id, title, price, images').in('id', ids).limit(8);
                  maybe = (rel || []).filter((p:any) => p.id !== id);
                }
              }
              setMaybeYouAlsoLike((maybe || []) as any[]);
            } catch (err) { /* ignore */ }
          }
        }
      }

      // 4) No existing DM -> create conversation (minimal insert)
      const { data: convData, error: convErr } = await supabase
        .from('conversations')
        .insert({ is_group: false })
        .select('id')
        .single();

      if (convErr || !convData) {
        console.error('Error creating conversation:', convErr);
        Alert.alert('Error', 'Could not create a conversation.');
        setLoadingDM(false);
        return;
      }

      const cid = convData.id;

      // 5) insert participants (try with accepted flags, fallback to legacy insert)
      let partErr: any = null;
      try {
        const { error } = await supabase.from('conversation_participants').insert([
          { conversation_id: cid, user_id: currentUserId, accepted: true },
          { conversation_id: cid, user_id: targetId, accepted: false },
        ]);
        partErr = error;
      } catch (e) {
        partErr = e;
      }

      if (partErr) {
        console.warn('participants.insert failed with accepted field; attempting fallback', partErr);
        try {
          const { error: fbErr } = await supabase.from('conversation_participants').insert([
            { conversation_id: cid, user_id: currentUserId },
            { conversation_id: cid, user_id: targetId },
          ]);
          if (fbErr) {
            console.error('Error inserting conversation participants (fallback):', fbErr);
            try {
              await supabase.from('conversations').delete().eq('id', cid);
            } catch (cleanupErr) {
              console.error('Cleanup failed for conversation:', cleanupErr);
            }
            Alert.alert('Error', 'Could not add participants to the conversation.');
            setLoadingDM(false);
            return;
          }
        } catch (e) {
          console.error('participants.insert fallback threw', e);
          try { await supabase.from('conversations').delete().eq('id', cid); } catch (_) {}
          Alert.alert('Error', 'Could not add participants to the conversation.');
          setLoadingDM(false);
          return;
        }
      }

      // create invite system message so recipient gets the accept/abort prompt
      // invites are prompt-driven via conversation_participants.accepted; do not create message rows

      // success -> navigate to chat
      setLoadingDM(false);
      router.push({
        pathname: `/message/chat/${cid}`,
        params: { otherName: targetName ?? '', otherAvatar: targetAvatar ?? '' },
      });
    } catch (err) {
      console.error('Unexpected error in startOrOpenDM:', err);
      Alert.alert('Error', 'Could not start chat.');
      setLoadingDM(false);
    }
  };

  const addToCart = async () => {
    if (!profile?.id) {
      Alert.alert('Not signed in', 'Please sign in to add items to your cart.');
      return;
    }
    if (!product?.id) return;
    // If product has variants, require that user selects a variant before adding
    if (product?.product_variants && Array.isArray(product.product_variants) && product.product_variants.length && !selectedVariant) {
      Alert.alert('Choose a variant', 'Please select a size / color variant before adding to cart.');
      return;
    }
    setAddingToCart(true);
    try {
      const sId = product?.profiles?.id ?? (Array.isArray(product?.profiles) ? product.profiles[0]?.id : null) ?? null;
      const insertPayload: any = { user_id: profile.id, product_id: product.id };
      if (selectedVariant?.id) insertPayload.variant_id = selectedVariant.id;
      // only add seller_id if we actually have a seller id value
      if (sId) insertPayload.seller_id = sId;

      const { data: cartRow, error } = await supabase.from('carts').insert(insertPayload).select('*').maybeSingle();
      if (error) {
        console.error('Add to cart error', error);
        // surface the raw DB message if available (helps diagnose missing column)
        const msg = error?.message || JSON.stringify(error);
        Alert.alert('Error', msg || 'Could not add to cart.');
        return false;
      } else {
        Alert.alert('Added', 'Product added to your cart.');
        return true;
      }
    } catch (err) {
      console.error('addToCart exception', err);
      Alert.alert('Error', 'Unexpected error adding to cart.');
      return false;
    } finally {
      setAddingToCart(false);
    }
  };

  const deleteProduct = async () => {
    const sId = product?.profiles?.id ?? (Array.isArray(product?.profiles) ? product.profiles[0]?.id : null) ?? null;
    if (!profile?.id || !sId || profile.id !== sId) return;
    Alert.alert('Delete product', 'Are you sure you want to delete this product? This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            const { error } = await supabase.from('products').delete().eq('id', id);
            if (error) {
              console.error('delete product error', error);
              Alert.alert('Error', 'Failed to delete product.');
            } else {
              Alert.alert('Deleted', 'Product removed successfully.');
              router.back();
            }
          } catch (err) {
            console.error('delete exception', err);
            Alert.alert('Error', 'Unexpected error deleting product.');
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  };

  

  const submitReview = async () => {
    if (!profile?.id) {
      Alert.alert('Sign in required', 'Please sign in to leave a review.');
      return;
    }
    if (!id) return;
    try {
      const { error } = await supabase
        .from('product_reviews')
        .insert({ product_id: id, reviewer_id: profile.id, rating: newRating, body: newReviewText.trim() });
      if (error) throw error;
      // refresh list
      const { data: rdata } = await supabase
        .from('product_reviews')
        .select('*, reviewer:profiles(id, full_name, avatar_url)')
        .eq('product_id', id)
        .order('created_at', { ascending: false })
        .limit(50);
      setReviews(rdata || []);
      // update product aggregates
      const { data: agg } = await supabase.rpc('aggregate_product_reviews', { p_product_id: id });
      // fallback: compute from reviews
      try {
        const avg = (rdata || []).reduce((s: number, r: any) => s + (r.rating ?? 0), 0) / Math.max(1, (rdata || []).length);
        await supabase.from('products').update({ avg_rating: Number(avg.toFixed(2)), review_count: (rdata || []).length }).eq('id', id);
        // update UI product state immediately
        setProduct((p:any) => ({ ...(p||{}), avg_rating: Number(avg.toFixed(2)), review_count: (rdata||[]).length }));
      } catch {}
      setNewReviewText('');
      setNewRating(5);
      Alert.alert('Thanks!', 'Your review has been posted.');
    } catch (err) {
      console.error('submitReview err', err);
      Alert.alert('Error', 'Could not post review.');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={colors.accent} size="large" />
      </SafeAreaView>
    );
  }

  if (!product) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: colors.bg }]}>
        <Text style={{ color: colors.text }}>Product not found.</Text>
      </SafeAreaView>
    );
  }

  const title = typeof product.title === 'string' ? product.title : '';
  const description = typeof product.description === 'string' ? product.description : '';
  // price should use selected variant price if available
  const price = selectedVariant?.price != null ? Number(selectedVariant.price) : (typeof product.price === 'number' ? product.price : Number(product.price) || 0);
  const createdAt = product.created_at ? dayjs(product.created_at).format('MMM D, YYYY') : '';

  // product.profiles might be an object or an array depending on how your relationship is returned.
  // normalize it so we always have a single seller object
  const rawProfiles = product.profiles;
  const seller = Array.isArray(rawProfiles) ? rawProfiles[0] : rawProfiles || {};
  // Prefer store title when available for seller display (shows store name/avatar instead of user full name)
  const sellerName = product?.store?.title || (typeof seller?.full_name === 'string' ? seller.full_name : 'User');
  const sellerId = seller?.id ?? null;

  const isOwnerViewer = profile?.id && sellerId && profile.id === sellerId;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}> 
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable 
          onPress={() => router.back()} 
          style={({ pressed }) => [styles.backButton, { transform: [{ scale: pressed ? 0.9 : 1 }] }]}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Product Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 140 }}>
        {/* Hero / Carousel */}
        <View style={styles.heroWrap}>
            <FlatList
              ref={(r) => { carouselRef.current = r }}
            data={product.images && product.images.length ? product.images.map((p:string) => publicUrlFromShopr(p) || p) : []}
            keyExtractor={(_, index) => String(index)}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <View style={{ position: 'relative' }}>
                <Image source={{ uri: String(item) }} style={[styles.productImage, { width }]} />
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.4)']}
                  style={[StyleSheet.absoluteFill, { top: '50%' }]}
                />
              </View>
            )}
            ListEmptyComponent={
              <View style={[styles.productImageFallback, { width }]}>
                <Ionicons name="image-outline" size={48} color={colors.subtext} />
                <Text style={{ marginTop: 6, color: colors.subtext }}>No Image</Text>
              </View>
            }
            onMomentumScrollEnd={(ev) => {
              try {
                const offset = ev.nativeEvent.contentOffset.x || 0;
                const idx = Math.round(offset / width);
                setActiveImage(idx);
              } catch {}
            }}
          />

          {/* Badge row (price chip + date) */}
          <View style={styles.badgeRow}>
            <View style={[styles.priceChip, { backgroundColor: VELT_ACCENT }]}>
              <Text style={styles.priceChipText}>₵{price}</Text>
            </View>
            {createdAt ? (
              <View style={[styles.dateChip, { backgroundColor: colors.faint }]}>
                <Ionicons name="time-outline" size={14} color={colors.text} style={{ marginRight: 6 }} />
                <Text style={[styles.dateChipText, { color: colors.text }]}>{createdAt}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Thumbnails */}
        {product.images && product.images.length > 1 ? (
          <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
            <FlatList
              data={product.images.map((p:string) => publicUrlFromShopr(p) || p)}
              horizontal
              keyExtractor={(_, i) => String(i)}
              showsHorizontalScrollIndicator={false}
              renderItem={({ item, index }) => (
                <Pressable
                  onPress={() => {
                    try { carouselRef.current?.scrollToIndex({ index, animated: true }); } catch {}
                    setActiveImage(index);
                  }}
                  style={({ pressed }) => [{ marginRight: 8, transform: [{ scale: pressed ? 0.95 : 1 }] }]}
                >
                  <Image source={{ uri: publicUrlFromShopr(String(item)) || String(item) }} style={{ width: 84, height: 56, borderRadius: 8, borderWidth: activeImage === index ? 2 : 0, borderColor: activeImage === index ? VELT_ACCENT : 'transparent' }} />
                </Pressable>
              )}
            />
          </View>
        ) : null}

        {/* Product Info */}
        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
            {title}
          </Text>
          {/* Show selected variant meta if available */}
          {selectedVariant ? (
            <View style={{ marginTop: 8 }}>
              {selectedVariant.brand ? <Text style={{ color: colors.subtext, fontSize: 12 }}>Brand: <Text style={{ color: colors.text, fontWeight: '700' }}>{selectedVariant.brand}</Text></Text> : null}
              {selectedVariant.category ? <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 2 }}>Category: <Text style={{ color: colors.text, fontWeight: '700' }}>{selectedVariant.category}</Text></Text> : null}
              {selectedVariant.condition ? <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 2 }}>Condition: <Text style={{ color: colors.text, fontWeight: '700' }}>{selectedVariant.condition}</Text></Text> : null}
            </View>
          ) : null}
          {!!description && (
            <View>
              <Text style={[styles.description, { color: colors.subtext, fontSize: 15 }]} numberOfLines={3} ellipsizeMode="tail">{description}</Text>
              <View style={{ marginTop: 8, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                {selectedVariant?.condition ? (
                  <Text style={{ color: colors.subtext, fontSize: 13 }}>Condition: <Text style={{ color: colors.text, fontWeight: '700' }}>{selectedVariant.condition}</Text></Text>
                ) : null}
                {product?.shipping_tag ? (
                  <Text style={{ color: colors.subtext, fontSize: 13 }}>Shipping: <Text style={{ color: colors.text, fontWeight: '700' }}>{product.shipping_tag.name}{product.shipping_tag.estimated_days ? ` • ${product.shipping_tag.estimated_days}d` : ''}</Text></Text>
                ) : null}
              </View>
            </View>
          )}

          {/* Ratings + quick meta */}
          <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {/* Stars (rounded) - derived from product.avg_rating */}
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {([1,2,3,4,5]).map((s) => (
                  <Ionicons key={s} name={s <= Math.round(Number(product?.avg_rating ?? 0)) ? 'star' : 'star-outline'} size={14} color="#FFD166" style={{ marginRight: 4 }} />
                ))}
              </View>
              <Text style={{ color: colors.subtext, marginLeft: 8, fontWeight: '700' }}>{product?.avg_rating ? Number(product.avg_rating).toFixed(1) : '—'}</Text>
              <Text style={{ color: colors.subtext, marginLeft: 6 }}>• {product?.review_count ?? 0} reviews</Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.faint }}>
                <Text style={{ color: colors.subtext, fontSize: 12 }}>Free returns</Text>
              </View>
              <View style={{ paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.faint }}>
                <Text style={{ color: colors.subtext, fontSize: 12 }}>Delivery</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Description (full) */}
        {!!description && (
          <View style={[styles.infoCard, { marginHorizontal: 16, padding: 16, backgroundColor: colors.card, borderColor: colors.border }] as any}>
            <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }}>Description</Text>
            <Text style={{ color: colors.subtext, marginTop: 8, fontSize: 15, lineHeight: 20 }}>{description}</Text>
          </View>
        )}

        {/* Sizes / Variants */}
        {product?.product_variants && Array.isArray(product.product_variants) && product.product_variants.length ? (
          <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
            <Text style={{ color: colors.subtext, fontSize: 12, marginBottom: 8 }}>Variants</Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {product.product_variants.map((v:any, idx:number) => (
                <TouchableOpacity key={`var-${v.id ?? idx}`} onPress={() => setSelectedVariant(v)} style={{ backgroundColor: selectedVariant?.id === v.id ? colors.accent : colors.faint, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}>
                  <Text style={{ color: selectedVariant?.id === v.id ? '#fff' : colors.text, fontWeight: '700' }}>{(v.size || v.sku || `${v.color || ''}`) + (v.price ? ` • ₵${v.price}` : '')}</Text>
                  {(v.brand || v.category || v.condition) ? (
                    <Text style={{ color: selectedVariant?.id === v.id ? '#fff' : colors.subtext, fontSize: 11, marginTop: 4 }}>{[v.brand, v.category, v.condition].filter(Boolean).join(' • ')}</Text>
                  ) : null}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (product?.sizes && Array.isArray(product.sizes) && product.sizes.length ? (
          <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
            <Text style={{ color: colors.subtext, fontSize: 12, marginBottom: 8 }}>Sizes</Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {product.sizes.map((s:any) => (
                <View key={`size-${s}`} style={{ backgroundColor: colors.faint, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}>
                  <Text style={{ color: colors.text }}>{s}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null)}

        {/* You may also like */}
        {maybeYouAlsoLike && maybeYouAlsoLike.length ? (
          <View style={{ marginTop: 16, paddingHorizontal: 16 }}>
            <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16, marginBottom: 8 }}>You may also like</Text>
            <FlatList
              data={maybeYouAlsoLike}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(p) => String(p.id)}
              renderItem={({ item }) => (
                <TouchableOpacity onPress={() => router.push({ pathname: '/market/product-details', params: { id: item.id } })} style={[styles.otherCard, { marginRight: 12, backgroundColor: colors.card, borderColor: colors.border }] as any}>
                  <Image source={{ uri: publicUrlFromShopr(Array.isArray(item.images) ? item.images[0] : (item.images || 'https://via.placeholder.com/320')) || (Array.isArray(item.images) ? item.images[0] : (item.images || 'https://via.placeholder.com/320')) }} style={{ width: 160, height: 120, borderTopLeftRadius: 10, borderTopRightRadius: 10 }} />
                  <View style={{ padding: 8 }}>
                    <Text numberOfLines={2} style={{ color: colors.text, fontWeight: '800' }}>{item.title}</Text>
                    <Text style={{ color: colors.subtext, marginTop: 6 }} numberOfLines={1}>₵{Number(item.price ?? 0)}</Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>
        ) : null}

        {/* Reviews */}
        <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
          <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }}>Reviews</Text>
          <View style={{ marginTop: 8 }}>
            {reviews.length === 0 ? (
              <Text style={{ color: colors.subtext }}>No reviews yet — be the first to review this product.</Text>
            ) : (
              reviews.map((r) => (
                <View key={r.id} style={{ paddingVertical: 10, borderBottomWidth: 1, borderColor: colors.faint }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      {r.reviewer?.avatar_url ? (
                        <Image source={{ uri: r.reviewer.avatar_url }} style={{ width: 36, height: 36, borderRadius: 18 }} />
                      ) : (
                        <Ionicons name="person-circle-outline" size={36} color={colors.subtext} />
                      )}
                      <View>
                        <Text style={{ color: colors.text, fontWeight: '700' }}>{r.reviewer?.full_name ?? 'User'}</Text>
                        <Text style={{ color: colors.subtext, fontSize: 12 }}>{new Date(r.created_at).toLocaleDateString()}</Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={{ color: colors.subtext, fontWeight: '800' }}>{r.rating ?? 0}</Text>
                      <Ionicons name="star" size={12} color="#FFD166" style={{ marginLeft: 6 }} />
                    </View>
                  </View>
                  {!!r.title && <Text style={{ color: colors.text, marginTop: 8, fontWeight: '800' }}>{r.title}</Text>}
                  {!!r.body && <Text style={{ color: colors.text, marginTop: 6 }}>{r.body}</Text>}
                  {Array.isArray(r.images) && r.images.length ? (
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                      {r.images.map((img:string, i:number) => (
                        <Image key={`revimg-${i}`} source={{ uri: String(img) }} style={{ width: 92, height: 72, borderRadius: 8 }} />
                      ))}
                    </View>
                  ) : null}
                </View>
              ))
            )}
          </View>

          {/* Add review - hide when viewing your own product */}
          {!isOwnerViewer ? (
            <View style={{ marginTop: 12, backgroundColor: colors.card, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ color: colors.text, fontWeight: '800' }}>Write a review</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
              <Text style={{ color: colors.subtext, marginRight: 8 }}>Rating</Text>
              {[1,2,3,4,5].map((r) => (
                <TouchableOpacity key={`r-${r}`} onPress={() => setNewRating(r)} style={{ marginRight: 6 }}>
                  <Ionicons name={r <= newRating ? 'star' : 'star-outline'} size={20} color="#FFD166" />
                </TouchableOpacity>
              ))}
            </View>
            <Text style={{ color: colors.subtext, marginTop: 8 }}>Feedback</Text>
            <TextInput value={newReviewText} onChangeText={setNewReviewText} placeholder="Share your experience" placeholderTextColor={colors.subtext} style={{ backgroundColor: colors.faint, padding: 10, borderRadius: 10, marginTop: 8, color: colors.text }} />
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
                <TouchableOpacity onPress={submitReview} style={[styles.primaryButton, { backgroundColor: colors.accent }]}>
                  <Text style={styles.primaryButtonText}>Post review</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </View>

        {/* Store Info (if present) */}
        {product?.store && (
          <View style={[styles.sellerCard, { backgroundColor: colors.card, borderColor: colors.border, marginHorizontal: 16, marginTop: 8 }] as any}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {product.store.avatar_url ? (
                <Image source={{ uri: product.store.avatar_url }} style={[styles.sellerAvatar, { width: 72, height: 72 }]} />
              ) : (
                <Ionicons name="storefront-outline" size={60} color={colors.subtext} />
              )}
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={[styles.sellerName, { color: colors.text, fontSize: 16 }]} numberOfLines={1}>{product.store.title}</Text>
                {!!product.store.description && <Text style={{ color: colors.subtext, marginTop: 6 }} numberOfLines={2}>{product.store.description}</Text>}
              </View>
              <TouchableOpacity onPress={() => router.push({ pathname: '/market/store/[id]', params: { id: product.store.id }})} style={[styles.secondaryButton, { paddingHorizontal: 10, paddingVertical: 8 }] }>
                <Text style={[styles.secondaryBtnText, { color: colors.text, fontSize: 12 }]}>Visit store</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Seller Info */}
        {seller && (
          <View style={[styles.sellerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {/* Avatar: prefer store avatar, else fallback to seller profile avatar; tapping navigates to store or profile */}
              <TouchableOpacity onPress={() => {
                if (product?.store?.id) return router.push({ pathname: '/market/store/[id]', params: { id: product.store.id } });
                if (sellerId) return router.push({ pathname: '/profile/view/[id]', params: { id: sellerId } });
              }}>
                {product?.store?.avatar_url ? (
                  <Image source={{ uri: product.store.avatar_url }} style={styles.sellerAvatar} />
                ) : seller.avatar_url ? (
                  <Image source={{ uri: seller.avatar_url }} style={styles.sellerAvatar} />
                ) : (
                  <Ionicons name="person-circle-outline" size={60} color={colors.subtext} />
                )}
              </TouchableOpacity>
              <View style={{ marginLeft: 12, flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={[styles.sellerName, { color: colors.text }]} numberOfLines={1}>
                    {sellerName}
                  </Text>
                  {/* Verified badge */}
                  <View style={{ backgroundColor: colors.faint, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 8 }}>
                    <Text style={{ color: colors.subtext, fontSize: 12, fontWeight: '700' }}>Seller</Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, justifyContent: 'space-between' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="star" size={14} color="#FFD166" />
                            <Text style={{ color: colors.subtext, marginLeft: 6, fontWeight: '700' }}>{product?.avg_rating ? Number(product.avg_rating).toFixed(1) : '—'}</Text>
                            <Text style={{ color: colors.subtext, marginLeft: 6 }}>• {product?.review_count ?? 0} reviews</Text>
                          </View>
                        </View>
                </View>

                {/* Action buttons */}
                {!isOwnerViewer ? (
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                    <TouchableOpacity
                      style={[styles.primaryButton, { backgroundColor: colors.accent }]}
                      onPress={() => startOrOpenDM(sellerId, sellerName, seller.avatar_url ?? '')}
                      disabled={loadingDM}
                    >
                      <Ionicons name="chatbubble-ellipses-outline" size={16} color="#fff" />
                      <Text style={styles.primaryButtonText}>{loadingDM ? 'Connecting...' : 'Message'}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.secondaryButton, { borderColor: colors.border, backgroundColor: colors.card }]}
                      onPress={addToCart}
                      disabled={addingToCart}
                    >
                      <Ionicons name="cart-outline" size={16} color={BUTTON_COLORS.success} />
                      <Text style={[styles.secondaryBtnText, { color: colors.text }]}>{addingToCart ? 'Adding...' : 'Add to cart'}</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  // Optionally show a subtle label when it's your own product
                  <View style={{ marginTop: 8, flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity style={[styles.secondaryButton, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => router.push({ pathname: '/market/listproduct', params: { id } })}>
                      <Ionicons name="create-outline" size={16} color={BUTTON_COLORS.warning} />
                      <Text style={[styles.secondaryBtnText, { color: colors.text }]}>Edit</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.dangerButton, { backgroundColor: BUTTON_COLORS.danger }]} onPress={deleteProduct} disabled={deleting}>
                      <Ionicons name="trash-outline" size={16} color="#fff" />
                      <Text style={[styles.primaryButtonText]}>{deleting ? 'Deleting...' : 'Delete'}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Map Section (satellite) */}
        {product.latitude && product.longitude ? (
          <View style={[styles.mapCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Text style={[styles.mapTitle, { color: colors.text }]}>Location</Text>
            <View style={{ height: 240, overflow: 'hidden', borderRadius: 12 }}>
              <MapView
                style={{ flex: 1 }}
                mapType="satellite"
                initialRegion={{
                  latitude: Number(product.latitude),
                  longitude: Number(product.longitude),
                  latitudeDelta: 0.05,
                  longitudeDelta: 0.05,
                }}
              >
                <Marker
                  coordinate={{ latitude: Number(product.latitude), longitude: Number(product.longitude) }}
                  title={title || 'Product'}
                  description={`₵${price}`}
                />
              </MapView>
            </View>
          </View>
        ) : null}

        {/* Other items by seller */}
        {otherItems && otherItems.length ? (
          <View style={{ marginTop: 16, paddingHorizontal: 16 }}>
            <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16, marginBottom: 8 }}>More from {sellerName}</Text>
            <FlatList
              data={otherItems}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(it) => String(it.id)}
              renderItem={({ item }) => {
                const imgs = Array.isArray(item.images) ? item.images.map((p:string) => publicUrlFromShopr(p) || p) : (item.images ? String(item.images).split('||').filter(Boolean).map((p:string) => publicUrlFromShopr(p) || p) : []);
                return (
                  <TouchableOpacity onPress={() => router.push({ pathname: '/market/product-details', params: { id: item.id } })} style={[styles.otherCard, { marginRight: 12, backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={{ position: 'relative' }}>
                      <Image source={{ uri: imgs[0] || 'https://via.placeholder.com/320' }} style={{ width: 160, height: 120, borderTopLeftRadius: 10, borderTopRightRadius: 10 }} />
                      <View style={{ position: 'absolute', left: 8, top: 8, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.45)' }}>
                        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>₵{Number(item.price ?? 0)}</Text>
                      </View>
                    </View>
                    <View style={{ padding: 8 }}>
                      <Text numberOfLines={2} style={{ color: colors.text, fontWeight: '800' }}>{item.title}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                        <Text style={{ color: colors.subtext, fontSize: 12 }}>• {Math.round(Math.random()*1000)} sold</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Ionicons name="star" size={12} color="#FFD166" />
                          <Text style={{ color: colors.subtext, marginLeft: 6, fontSize: 12 }}>4.7</Text>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />

          {/* carousel indicators */}
          {product.images && product.images.length > 1 ? (
            <View style={{ position: 'absolute', bottom: 8, left: 0, right: 0, alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {product.images.map((_: any, idx: number) => (
                  <View key={`dot-${idx}`} style={{ width: activeImage === idx ? 14 : 8, height: activeImage === idx ? 14 : 8, borderRadius: 8, backgroundColor: activeImage === idx ? colors.accent : 'rgba(255,255,255,0.35)', opacity: activeImage === idx ? 1 : 0.85 }} />
                ))}
              </View>
            </View>
          ) : null}
          </View>
        ) : null}
      </ScrollView>

      {/* Sticky action footer */}
      <View style={[styles.stickyFooter, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, flex: 1 }}>
          <View>
            <Text style={{ color: colors.subtext, fontSize: 12 }}>Price</Text>
            <Text style={{ color: colors.text, fontWeight: '900', fontSize: 18 }}>₵{price}</Text>
          </View>

          {!isOwnerViewer ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity
                style={[styles.footerBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
                onPress={addToCart}
                disabled={addingToCart}
              >
                <Ionicons name="cart-outline" size={18} color={colors.text} />
                <Text style={[styles.footerBtnText, { color: colors.text }]}>{addingToCart ? 'Adding...' : 'Add to cart'}</Text>
              </TouchableOpacity>

            <TouchableOpacity
              style={[styles.buyNowBtn, { backgroundColor: colors.accent, opacity: buyNowProcessing ? 0.8 : 1 }]}
              disabled={buyNowProcessing}
              onPress={async () => {
                // One-shot buy: perform payment then create order immediately (no cart row)
                if (!profile?.id) {
                  Alert.alert('Sign in required', 'Please sign in to complete this purchase.');
                  return;
                }
                if (!product?.id) return;
                // require variant if present
                if (product?.product_variants && Array.isArray(product.product_variants) && product.product_variants.length && !selectedVariant) {
                  Alert.alert('Choose a variant', 'Please select a size / color variant before buying.');
                  return;
                }

                try {
                  setBuyNowProcessing(true);

                  // ensure buyer has a shipping address
                  const { data: addrs } = await supabase.from('shipping_addresses').select('*').eq('user_id', profile.id);
                  if (!addrs || addrs.length === 0) {
                    setBuyNowProcessing(false);
                    // navigate user to add address
                    Alert.alert('Shipping address required', 'Please add a shipping address to complete a purchase.');
                    router.push('/profile/shipping-addresses');
                    return;
                  }

                  const chosenAddressId = addrs[0].id;

                  // Start server-backed payment via paystack-init so checkout happens inside the app
                  try {
                    const singleItem = {
                      product_id: product.id,
                      variant_id: selectedVariant?.id ?? null,
                      quantity: 1,
                      unit_price: Number(selectedVariant?.price ?? product.price ?? 0),
                      seller_id: product?.profiles?.id ?? product?.stores?.owner_id ?? null,
                      cart_id: null,
                    };

                    const payload = { amount: Number(selectedVariant?.price ?? product.price ?? 0), email: profile.email, cartItems: [singleItem], shipping_address_id: chosenAddressId };
                    // Create a pending payment row locally so we can track it
                    try {
                      const { data: p, error: pErr } = await supabase.from('payments').insert({ user_id: profile.id, amount: Number(selectedVariant?.price ?? product.price ?? 0), currency: PAYSTACK_MERCHANT_CURRENCY, status: 'pending', metadata: { product_id: product.id, variant_id: selectedVariant?.id ?? null, shipping_address_id: chosenAddressId } }).select('*').single();
                      if (pErr) console.warn('could not insert payment row', pErr);
                      else setPendingPaymentId(p?.id ?? null);
                    } catch (ie) { console.warn('insert payment err', ie); }

                    // open inline Paystack within app on native
                    if (Platform.OS === 'web') {
                      try { await Linking.openURL('https://paystack.com/pay/'); } catch (openErr) { console.warn('open url err', openErr); }
                    } else {
                      const inlineHtml = `<!doctype html><html><head><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"></head><body><script src=\"https://js.paystack.co/v1/inline.js\"></script><script>function run(){try{const handler=PaystackPop.setup({key:'${PAYSTACK_PUBLIC_KEY}',email:'${payload.email}',amount:${Math.round(Number(selectedVariant?.price ?? product.price ?? 0)*100)},currency:'${PAYSTACK_MERCHANT_CURRENCY}',onClose:function(){window.ReactNativeWebView.postMessage(JSON.stringify({status:'closed'}));},callback:function(response){window.ReactNativeWebView.postMessage(JSON.stringify({status:'success', reference:response.reference, payload: response}));}}); handler.openIframe();}catch(e){window.ReactNativeWebView.postMessage(JSON.stringify({status:'error', message: String(e)}));}} window.onload=run;</script></body></html>`;
                      setInAppHtml(inlineHtml);
                      // For inline HTML flow we don't use an authUrl — set to null and rely on inAppHtml
                      setInAppUrl(null);
                      setInAppWebVisible(true);
                    }
                    // verification will be triggered by in-app webview navigation or user using manual verify flow
                  } catch (e) {
                    console.error('pay init err (buy now)', e);
                    throw e;
                  }
                } catch (err: any) {
                  console.error('buyNow error', err);
                  Alert.alert('Payment failed', (err as any)?.message ?? String(err) ?? 'Could not complete purchase.');
                } finally {
                  setBuyNowProcessing(false);
                }
              }}
            >
              {buyNowProcessing ? (
                <ActivityIndicator color={colors.bg} />
              ) : (
                <Text style={{ color: colors.bg, fontWeight: '900' }}>Buy now</Text>
              )}
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </View>
      {/* In-app webview modal for native Buy now flow */}
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
                  if (pendingPaymentId) {
                    try { await supabase.from('payments').update({ status: 'paid', reference: payload?.reference ?? null, gateway_response: payload }).eq('id', pendingPaymentId); } catch (uErr) { console.warn('failed to update payment row', uErr); }
                  }
                  // create order(s) for buy-now and route buyer to Orders
                  await finalizeBuyNowOrder(pendingPaymentId, payload?.reference ?? null);
                  setBuyNowProcessing(false);
                  setInAppWebVisible(false);
                  router.push('/market/orders');
                } else if (payload?.status === 'closed') {
                  setInAppWebVisible(false);
                  setInAppHtml(null);
                } else if (payload?.status === 'error') {
                  console.warn('Paystack inline error (buy now)', payload?.message ?? payload);
                  try { if (pendingPaymentId) await supabase.from('payments').update({ status: 'failed', gateway_response: payload, updated_at: new Date().toISOString() }).eq('id', pendingPaymentId); } catch (e) { console.warn('failed to update payment after inline error', e); }
                  Alert.alert('Payment error', String(payload?.message ?? 'An error occurred during payment.'));
                }
              } catch (e) { console.warn('webview message parse err', e); }
            }}
            onNavigationStateChange={async (navState) => {
              try {
                const url = navState?.url ?? '';
                const parsed = new URL(url);
                const referenceParam = parsed.searchParams.get('reference') || parsed.searchParams.get('access_code') || parsed.searchParams.get('trans');
                if (referenceParam) {
                  setInAppWebVisible(false);
                  setInAppUrl(null);
                  setBuyNowReference(referenceParam);
                  // mark payment paid (client-side flow) for the pending row
                    try {
                      if (pendingPaymentId) {
                        await supabase.from('payments').update({ status: 'paid', reference: referenceParam }).eq('id', pendingPaymentId);
                      }
                      // finalize order for buy-now payment
                      await finalizeBuyNowOrder(pendingPaymentId, referenceParam);
                      setBuyNowProcessing(false);
                      setInAppWebVisible(false);
                      router.push('/market/orders');
                    } catch (err) {
                      console.warn('mark payment paid err', err);
                      setBuyNowProcessing(false);
                    }
                }
              } catch (e) {
                // ignore parse errors
              }
            }}
          />
          </SafeAreaView>
        </Modal>
      ) : null}
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', textAlign: 'center', letterSpacing: 0.2 },

  // --- Hero ---
  heroWrap: {
    position: 'relative',
  },
  productImage: {
    height: 420,
    resizeMode: 'cover',
  },
  productImageFallback: {
    height: 420,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeRow: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  priceChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  priceChipText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 18,
    letterSpacing: 0.2,
  },
  dateChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateChipText: { fontSize: 12, fontWeight: '600' },

  // --- Info Card (magazine style) ---
  infoCard: {
    margin: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: 0.2 },
  description: { fontSize: 15, lineHeight: 21, marginTop: 8 },

  // --- Seller ---
  sellerCard: {
    marginHorizontal: 16,
    marginTop: 2,
    padding: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sellerAvatar: { width: 60, height: 60, borderRadius: 30 },
  sellerName: { fontSize: 16, fontWeight: '700' },
  textUserButton: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  textUserLabel: { color: '#fff', fontWeight: '700', fontSize: 13 },

  // shared button styles
  primaryButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primaryButtonText: { color: '#fff', fontWeight: '800', marginLeft: 6 },
  secondaryButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  secondaryBtnText: { fontWeight: '800', marginLeft: 6 },
  dangerButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#ff3b30',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  otherCard: {
    width: 160,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },

  stickyFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
    zIndex: 90,
  },
  footerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  footerBtnText: { marginLeft: 8, fontWeight: '800' },
  buyNowBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // --- Map ---
  mapCard: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  mapTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 10,
    letterSpacing: 0.3,
  },
});


