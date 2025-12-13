import { supabase } from '@/lib/supabase';
import { uploadBillboardAsset } from '@/utils/cloudinary';

export async function fetchInAppAds(limit = 20) {
  try {
    const { data, error } = await supabase
      .from('billboards')
      .select('*')
      .eq('destination', 'in_app')
      .order('created_at', { ascending: false })
      .limit(limit);
    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
}

export async function recordImpression({ ad_campaign_id, billboard_id, user_id, metadata }: { ad_campaign_id?: string | null; billboard_id?: string | null; user_id?: string | null; metadata?: any }) {
  try {
    const row = {
      ad_campaign_id: ad_campaign_id ?? null,
      billboard_id: billboard_id ?? null,
      user_id: user_id ?? null,
      metadata: metadata ?? null,
    };
    const { data, error } = await supabase.from('ad_impressions').insert([row]);
    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
}

export async function recordClick({ ad_campaign_id, billboard_id, ad_impression_id, user_id, click_metadata }: { ad_campaign_id?: string | null; billboard_id?: string | null; ad_impression_id?: string | null; user_id?: string | null; click_metadata?: any }) {
  try {
    const row = {
      ad_campaign_id: ad_campaign_id ?? null,
      ad_impression_id: ad_impression_id ?? null,
      billboard_id: billboard_id ?? null,
      user_id: user_id ?? null,
      click_metadata: click_metadata ?? null,
    };
    const { data, error } = await supabase.from('ad_clicks').insert([row]);
    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
}

export async function createInAppAd({
  owner_id,
  title,
  localUri,
  mediaType,
  metadata,
  budget,
  starts_at,
  ends_at,
}: {
  owner_id: string;
  title: string;
  localUri: string; // local file:// URI
  mediaType: 'image' | 'video';
  metadata?: Record<string, any>;
  budget?: number;
  starts_at?: string | null;
  ends_at?: string | null;
}) {
  try {
    // 1) upload to Cloudinary using preset in_app_ads
    const res = await uploadBillboardAsset(localUri, mediaType);
    const publicUrl = res.secure_url;

    // 2) insert media row
    const { data: mediaRow, error: mediaErr } = await supabase.from('media').insert([{ owner_id, storage_provider: 'cloudinary', path: publicUrl, filename: publicUrl.split('/').pop(), mime_type: mediaType === 'image' ? 'image/jpeg' : 'video/mp4', metadata: metadata ?? null }]).select('*').maybeSingle();
    if (mediaErr) return { data: null, error: mediaErr };

    // 3) insert billboard row as in_app destination referencing media
    const billboardRow: any = {
      user_id: owner_id,
      title,
      media_id: mediaRow?.id ?? null,
      media_path: publicUrl,
      media_type: mediaType,
      media_metadata: metadata ?? null,
      destination: 'in_app',
      budget: budget ?? 0,
      starts_at: starts_at ?? null,
      ends_at: ends_at ?? null,
    };

    const { data: bData, error: bErr } = await supabase.from('billboards').insert([billboardRow]).select('*').maybeSingle();
    if (bErr) return { data: null, error: bErr };

    return { data: { media: mediaRow, billboard: bData }, error: null };
  } catch (error) {
    return { data: null, error };
  }
}
