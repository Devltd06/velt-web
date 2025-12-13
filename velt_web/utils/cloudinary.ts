// utils/cloudinary.ts
// Helper utilities for uploading assets to Cloudinary.

export type UploadCategory = 'image' | 'video' | 'audio';

export const CLOUDINARY_BILLBOARD_PRESET = 'in_app_ads';
export const CLOUDINARY_BILLBOARD_CLOUD = 'dpejjmjxg';
export const CLOUDINARY_PRODUCTS_PRESET = 'products';

import * as FileSystem from 'expo-file-system';

export async function uploadToCloudinaryLocal(
  uri: string,
  type: UploadCategory,
  preset = CLOUDINARY_BILLBOARD_PRESET,
  mimeOverride?: string,
  cloudName = CLOUDINARY_BILLBOARD_CLOUD
) {
  const resourceType = type === 'image' ? 'image' : 'video';
  const url = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`;
  const inferredMime =
    mimeOverride ||
    (type === 'image' ? 'image/jpeg' : type === 'video' ? 'video/mp4' : 'audio/m4a');
  const extension = inferredMime.split('/')[1] || (type === 'image' ? 'jpg' : type === 'video' ? 'mp4' : 'm4a');

  // On Android the uri may be a content:// URI which can cause issues with uploading.
  let uploadUri = uri;
  try {
    if (uploadUri && uploadUri.startsWith('content:')) {
      // Copy to cache and use a file:// path for upload
      const ext = `.${extension}`;
      const dest = `${FileSystem.cacheDirectory}cloudinary_upload_${Date.now()}${ext}`;
      try {
        await FileSystem.copyAsync({ from: uploadUri, to: dest });
        uploadUri = dest;
      } catch (copyErr) {
        console.warn('uploadToCloudinaryLocal: failed to copy content URI to cache', copyErr);
      }
    }
  } catch (err) {
    console.warn('uploadToCloudinaryLocal: prepare uri', err);
  }

  return await new Promise<{ secure_url: string }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    const fd: any = new FormData();
    const name = `${resourceType}_${Date.now()}.${extension}`;
    fd.append('file', { uri: uploadUri, type: inferredMime, name } as any);
    fd.append('upload_preset', preset);

    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText);
          resolve({ secure_url: res.secure_url || res.url });
        } catch (e) {
          reject(new Error('Invalid upload response'));
        }
      } else {
        reject(new Error('Upload failed: ' + xhr.responseText));
      }
    };
    xhr.send(fd);
  });
}

export function uploadBillboardAsset(uri: string, type: Extract<UploadCategory, 'image' | 'video'>, mimeOverride?: string) {
  return uploadToCloudinaryLocal(uri, type, CLOUDINARY_BILLBOARD_PRESET, mimeOverride, CLOUDINARY_BILLBOARD_CLOUD);
}

export function uploadProductAsset(uri: string, type: Extract<UploadCategory, 'image' | 'video'>, mimeOverride?: string) {
  return uploadToCloudinaryLocal(uri, type, CLOUDINARY_PRODUCTS_PRESET, mimeOverride, CLOUDINARY_BILLBOARD_CLOUD);
}
