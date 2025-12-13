import { supabase } from './supabase';

// simple in-memory cache for signed urls. key -> { url, expiresAt }
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

export function clearSignedUrlCache() {
  signedUrlCache.clear();
}

export function signedUrlCacheStats() {
  return { size: signedUrlCache.size };
}

/**
 * Return a public URL for a file stored in the `shopr` bucket.
 * If the value is already an absolute URL it is returned unchanged.
 */
export function publicUrlFromShopr(pathOrUrl?: string | null): string | null {
  if (!pathOrUrl) return null;
  const trimmed = String(pathOrUrl).trim();
  if (!trimmed) return null;
  // Already a full URL — return as-is
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;

  // If path starts with a leading slash remove it (Supabase storage expects 'folder/name.jpg')
  const key = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;

  try {
    const res = supabase.storage.from('shopr').getPublicUrl(key);
    // supabase client can return either { publicURL: '..' } or { data: { publicUrl: '...' } }
    // support both shapes for robustness
    // @ts-ignore
    if (res?.publicURL) return res.publicURL;
    // @ts-ignore
    return res?.data?.publicUrl ?? null;
  } catch (e) {
    console.warn('publicUrlFromShopr error', e);
    return null;
  }
}

/**
 * Return a public URL for a file stored in any bucket.
 * If the value is already an absolute URL it is returned unchanged.
 */
export function publicUrlFromBucket(bucket: string, pathOrUrl?: string | null): string | null {
  if (!pathOrUrl) return null;
  const trimmed = String(pathOrUrl).trim();
  if (!trimmed) return null;
  // Already a full URL — return as-is
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;

  // If path starts with a leading slash remove it (Supabase storage expects 'folder/name.jpg')
  const key = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;

  try {
    const res = supabase.storage.from(bucket).getPublicUrl(key);
    // supabase client can return either { publicURL: '..' } or { data: { publicUrl: '...' } }
    // support both shapes for robustness
    // @ts-ignore
    if (res?.publicURL) return res.publicURL;
    // @ts-ignore
    return res?.data?.publicUrl ?? null;
  } catch (e) {
    console.warn('publicUrlFromBucket error', bucket, e);
    return null;
  }
}

/**
 * Create a short-lived signed URL for a file stored in a bucket.
 * Use this when your bucket is private. Returns null on failure.
 */
export async function signedUrlFromBucket(bucket: string, path?: string | null, expiresSeconds = 60): Promise<string | null> {
  if (!path) return null;
  const key = String(path).trim().startsWith('/') ? String(path).trim().slice(1) : String(path).trim();
  const cacheKey = `${bucket}:${key}:${expiresSeconds}`;
  try {
    const now = Date.now();
    const cached = signedUrlCache.get(cacheKey);
    // small safety buffer before expiry (2s)
    if (cached && typeof cached.expiresAt === 'number' && cached.expiresAt > now + 2000) {
      // cache hit
        console.debug('[signedUrlFromBucket] cache hit', cacheKey);
      return cached.url;
    }
  } catch (e) {
    // ignore cache errors
  }
  try {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(key, expiresSeconds);
    if (error) {
      console.warn('signedUrlFromBucket error', bucket, key, error);
      return null;
    }
    // modern supabase returns { signedUrl }
    const signed = (data as any)?.signedUrl ?? null;
    if (signed) {
      try {
        const expiresAt = Date.now() + expiresSeconds * 1000;
        signedUrlCache.set(cacheKey, { url: signed, expiresAt });
        console.debug('[signedUrlFromBucket] cache set', cacheKey, { expiresAt });
      } catch {}
    }
    return signed;
  } catch (e) {
    console.warn('signedUrlFromBucket exception', e);
    return null;
  }
}
