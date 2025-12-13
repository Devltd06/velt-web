// app/helpers/shared.ts
export function buildCloudinaryUrl(publicIdOrUrl: unknown, mediaType: "image" | "video"): string | null {
  const CLOUDINARY_CLOUD = "dpejjmjxg"; // keep in sync with your other files
  if (publicIdOrUrl == null) return null;
  try {
    const s = String(publicIdOrUrl).trim();
    if (!s) return null;
    if (s.startsWith("http://") || s.startsWith("https://")) return s;
    const resource = mediaType === "video" ? "video" : "image";
    return `https://res.cloudinary.com/${CLOUDINARY_CLOUD}/${resource}/upload/${s}`;
  } catch {
    return null;
  }
}

import * as FileSystem from "expo-file-system";
import { downloadAsync as downloadAsyncHelper } from '@/utils/filesystem';
const FS_ANY: any = FileSystem;
const STORIES_CACHE_DIR = `${FS_ANY.cacheDirectory ?? FS_ANY.documentDirectory ?? ""}stories/`;

export async function ensureCacheDir() {
  try {
    const info = await FS_ANY.getInfoAsync(STORIES_CACHE_DIR);
    if (!info.exists) await FS_ANY.makeDirectoryAsync(STORIES_CACHE_DIR, { intermediates: true });
  } catch {}
}

export function cacheFilenameForUrl(url: string) {
  return `${STORIES_CACHE_DIR}${encodeURIComponent(url)}`;
}

export async function downloadToCache(url?: string | null) {
  if (!url) return null;
  try {
    await ensureCacheDir();
    const dest = cacheFilenameForUrl(url);
    const info = await FS_ANY.getInfoAsync(dest).catch(() => null);
    if (info?.exists) return info.uri;
    const res = await downloadAsyncHelper(url, dest);
    return res?.uri ?? null;
  } catch {
    return null;
  }
}

export async function preloadMediaToCache(url?: string | null) {
  try {
    return await downloadToCache(url);
  } catch {
    return null;
  }
}

export function formatCount(n?: number) {
  if (n === 0) return "0";
  if (!n) return "";
  if (n < 1000) return String(n);
  if (n < 1_000_000) {
    const v = n / 1000;
    return v >= 100 ? `${Math.round(v)}K` : `${parseFloat(v.toFixed(1))}K`;
  }
  const v = n / 1_000_000;
  return v >= 100 ? `${Math.round(v)}M` : `${parseFloat(v.toFixed(1))}M`;
}
