import { supabase } from '@/lib/supabase';
import * as FileSystem from 'expo-file-system';
// uploadAsync is deprecated in some SDKs — prefer legacy upload API when available
import * as FileSystemLegacy from 'expo-file-system/legacy';

const getUploadAsync = (FileSystemLegacy as any)?.uploadAsync ?? (FileSystem as any).uploadAsync;
import mime from 'mime';

export async function uploadFile(uri: string, bucket: string) {
  try {
    // Compute a reliable file name and mime type
    let fileName = uri.split('/').pop() ?? `upload-${Date.now()}`;
    let mimeType = mime.getType(fileName) || 'application/octet-stream';

    // Handle Android content:// URIs (these often fail with fetch). Copy to cache and use file:// path.
    let useUri = uri;
    try {
      if (uri.startsWith('content:')) {
        const ext = (mime.getExtension(mimeType) ? `.${mime.getExtension(mimeType)}` : '.bin') as string;
        const dest = `${FileSystem.cacheDirectory}upload-${Date.now()}${ext}`;
        try {
          await FileSystem.copyAsync({ from: uri, to: dest });
          // copyAsync doesn't return the dest info — we know dest already
          useUri = dest;
          fileName = dest.split('/').pop() ?? fileName;
          mimeType = mime.getType(fileName) || mimeType;
        } catch (copyErr) {
          console.warn('upload: failed to copy content URI to cache', copyErr);
          // fallback to original uri
          useUri = uri;
        }
      }
    } catch (e) {
      console.warn('upload: prepare uri', e);
      useUri = uri;
    }

    // Try fetching the file URI directly to obtain a Blob — this works for local file:// and remote URIs
    let blob: Blob | null = null;
    try {
      const fetched = await fetch(useUri);
      if (typeof (fetched as any).blob === 'function') {
        blob = await (fetched as any).blob();
      } else if (typeof (fetched as any).arrayBuffer === 'function') {
        const arr = await (fetched as any).arrayBuffer();
        try { blob = new Blob([arr], { type: mimeType }); } catch (err) { blob = null; }
      }
    } catch (fetchErr) {
      console.debug('upload: fetch->blob/arrayBuffer failed - will try base64 fallback', fetchErr);
    }

    if (!blob) {
      try {
        const base64 = await FileSystem.readAsStringAsync(useUri, { encoding: 'base64' } as any);
        let binaryString: string | null = null;
        if (typeof (globalThis as any).atob === 'function') {
          binaryString = (globalThis as any).atob(base64);
        }
        if (binaryString != null) {
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
          try { blob = new Blob([bytes], { type: mimeType }); } catch (err) { blob = null; }
        } else if (typeof (globalThis as any).Buffer === 'function') {
          try {
            const buf = (globalThis as any).Buffer.from(base64, 'base64');
            try { blob = new Blob([buf], { type: mimeType }); } catch (err) { blob = null; }
          } catch {}
        }
        if (!blob) {
          try {
            const dataUrl = `data:${mimeType};base64,${base64}`;
            const resp = await fetch(dataUrl);
            if (typeof (resp as any).blob === 'function') blob = await (resp as any).blob();
          } catch (e) {
            console.warn('upload: base64->blob fallback failed', e);
          }
        }
        if (!blob) throw new Error('Could not create blob from file');
      } catch (fallbackErr) {
        console.error('upload: failed to obtain blob', fallbackErr);
        throw fallbackErr;
      }
    }

    // Use a unique path in the bucket (timestamp + filename) to avoid collisions and cache issues
    const remotePath = `${Date.now()}-${fileName}`;

    try {
      const { data, error } = await supabase.storage.from(bucket).upload(remotePath, blob, {
        contentType: mimeType,
        upsert: true,
      });
      if (error) {
        console.warn('uploadFile: storage.upload returned error — will attempt REST fallback', error);
        throw error;
      }
    } catch (uploadErr) {
      // REST fallback (see uploadFileWithMeta logic)
      try {
        const session = await supabase.auth.getSession();
        const token = (session as any)?.data?.session?.access_token ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
        const base = process.env.EXPO_PUBLIC_SUPABASE_URL;
        if (!base) throw new Error('Missing SUPABASE URL in environment');
        const uploadUrl = `${base.replace(/\/$/, '')}/storage/v1/object/${encodeURIComponent(bucket)}/${encodeURIComponent(remotePath)}`;
        if (useUri && (useUri.startsWith('file://') || useUri.startsWith(FileSystem.cacheDirectory || ''))) {
          const uploadRes = await getUploadAsync(uploadUrl, useUri, {
            httpMethod: 'PUT',
            uploadType: (FileSystem as any).FileSystemUploadType?.BINARY_CONTENT ?? (FileSystem as any).UploadType?.BINARY_CONTENT ?? undefined,
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': mimeType,
              'x-upsert': 'true',
            },
          });
          if ((uploadRes as any).status && (uploadRes as any).status >= 400) {
            console.error('uploadFile: FileSystem.uploadAsync fallback failed', uploadRes);
            return null;
          }
        } else {
          const resp = await fetch(uploadUrl, { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': mimeType, 'x-upsert': 'true' }, body: blob as any });
          if (!resp.ok) {
            console.error('uploadFile: fetch PUT fallback failed', resp.status);
            return null;
          }
        }
      } catch (fallbackErr) {
        console.error('uploadFile: REST fallback failed', fallbackErr);
        return null;
      }
    }

    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(remotePath);
    return urlData.publicUrl;
  } catch (err) {
    console.error('Upload failed:', err);
    return null;
  }
}

/**
 * Upload a file and return both public url and the storage path used (remotePath).
 * This is useful when callers also need to store the path in the DB.
 */
export async function uploadFileWithMeta(uri: string, bucket: string): Promise<{ publicUrl: string | null; path: string | null; error?: any } | null> {
  try {
    // replicate the same logic as uploadFile to produce the blob and remotePath
    let fileName = uri.split('/').pop() ?? `upload-${Date.now()}`;
    let mimeType = mime.getType(fileName) || 'application/octet-stream';

    let useUri = uri;
    try {
      if (uri.startsWith('content:')) {
        const ext = (mime.getExtension(mimeType) ? `.${mime.getExtension(mimeType)}` : '.bin') as string;
        const dest = `${FileSystem.cacheDirectory}upload-${Date.now()}${ext}`;
        try {
          await FileSystem.copyAsync({ from: uri, to: dest });
          useUri = dest;
          fileName = dest.split('/').pop() ?? fileName;
          mimeType = mime.getType(fileName) || mimeType;
        } catch (copyErr) {
          console.warn('uploadWithMeta: failed to copy content URI to cache', copyErr);
          useUri = uri;
        }
      }
    } catch (e) {
      console.warn('uploadWithMeta: prepare uri', e);
      useUri = uri;
    }

    let blob: Blob | null = null;
    try {
      const fetched = await fetch(useUri);
      // prefer blob() when available
      if (typeof (fetched as any).blob === 'function') {
        blob = await (fetched as any).blob();
      } else if (typeof (fetched as any).arrayBuffer === 'function') {
        const arr = await (fetched as any).arrayBuffer();
        try {
          blob = new Blob([arr], { type: mimeType });
        } catch (err) {
          // some environments may not support Blob constructor - fall through to base64 approach
          console.debug('uploadWithMeta: Blob constructor not available, will try base64 fallback', err);
          blob = null;
        }
      } else {
        // no blob/arrayBuffer available — fall back to base64
        blob = null;
      }
    } catch (fetchErr) {
      console.debug('uploadWithMeta: fetch->blob/arrayBuffer failed, will try base64 fallback', fetchErr);
    }

    // Final fallback: read file as base64 then convert
    if (!blob) {
      try {
        const base64 = await FileSystem.readAsStringAsync(useUri, { encoding: 'base64' } as any);
        // If runtime supports atob/btoa, use atob to decode base64 -> binary string
        let binaryString: string | null = null;
        if (typeof (globalThis as any).atob === 'function') {
          binaryString = (globalThis as any).atob(base64);
        }

        if (binaryString != null) {
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
          try { blob = new Blob([bytes], { type: mimeType }); } catch (err) { blob = null; }
        } else if (typeof (globalThis as any).Buffer === 'function') {
          // Node-like Buffer available (rare in RN) - convert
          try {
            const buf = (globalThis as any).Buffer.from(base64, 'base64');
            try { blob = new Blob([buf], { type: mimeType }); } catch (err) { blob = null; }
          } catch {}
        }

        if (!blob) {
          // As last resort, upload the base64 as data url via fetch to obtain a blob, if fetch(dataUrl).blob exists
          try {
            const dataUrl = `data:${mimeType};base64,${base64}`;
            const resp = await fetch(dataUrl);
            if (typeof (resp as any).blob === 'function') blob = await (resp as any).blob();
          } catch (e) {
            console.warn('uploadWithMeta fallback -> could not create blob from base64', e);
          }
        }

        if (!blob) {
          // give up with a helpful error
          const err = new Error('Could not create Blob for upload. Consider using a platform that supports fetch().blob() or ensure atob/Buffer is available.');
          console.error('uploadWithMeta: final blob creation failed');
          return { publicUrl: null, path: null, error: err };
        }
      } catch (fallbackErr) {
        console.error('uploadWithMeta: failed to obtain blob via base64 fallback', fallbackErr);
        return { publicUrl: null, path: null, error: fallbackErr };
      }
    }

    const remotePath = `${Date.now()}-${fileName}`;
    try {
      const { data, error } = await supabase.storage.from(bucket).upload(remotePath, blob, { contentType: mimeType, upsert: true });
      if (error) {
        console.warn('uploadWithMeta: storage.upload returned error — will attempt REST fallback', { bucket, remotePath, error });
        throw error;
      }
    } catch (uploadErr) {
      // Attempt a direct REST PUT to storage endpoint using current session access token.
      try {
        const session = await supabase.auth.getSession();
        const token = (session as any)?.data?.session?.access_token ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
        const base = process.env.EXPO_PUBLIC_SUPABASE_URL;
        if (!base) throw new Error('Missing SUPABASE URL in environment');
        const uploadUrl = `${base.replace(/\/$/, '')}/storage/v1/object/${encodeURIComponent(bucket)}/${encodeURIComponent(remotePath)}`;

        // prefer a file upload if we have a file path available (useUri should be local file:// when we copied content)
        if (useUri && (useUri.startsWith('file://') || useUri.startsWith(FileSystem.cacheDirectory || ''))) {
          try {
            const uploadRes = await getUploadAsync(uploadUrl, useUri, {
              httpMethod: 'PUT',
              uploadType: (FileSystem as any).FileSystemUploadType?.BINARY_CONTENT ?? (FileSystem as any).UploadType?.BINARY_CONTENT ?? undefined,
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': mimeType,
                'x-upsert': 'true',
              },
            });
            if ((uploadRes as any)?.status && (uploadRes as any).status >= 400) {
              console.error('uploadWithMeta: FileSystem.uploadAsync failed', uploadRes);
              return { publicUrl: null, path: null, error: uploadRes };
            }
            // success — fall through to return public url below
          } catch (fsErr) {
            console.error('uploadWithMeta: FileSystem.uploadAsync fallback failed', fsErr);
            return { publicUrl: null, path: null, error: fsErr };
          }
        } else {
          // upload using fetch (PUT) with blob body
          try {
            const resp = await fetch(uploadUrl, {
              method: 'PUT',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': mimeType,
                'x-upsert': 'true',
              },
              body: blob as any,
            });
            if (!resp.ok) {
              const txt = await resp.text().catch(() => String(resp.status));
              console.error('uploadWithMeta: fetch PUT fallback failed', resp.status, txt);
              return { publicUrl: null, path: null, error: { status: resp.status, text: txt } };
            }
          } catch (fetchErr) {
            console.error('uploadWithMeta: fetch PUT fallback failed', fetchErr);
            return { publicUrl: null, path: null, error: fetchErr };
          }
        }
      } catch (restErr) {
        console.error('uploadWithMeta: REST fallback failed', restErr);
        return { publicUrl: null, path: null, error: uploadErr };
      }
    }
    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(remotePath);
    return { publicUrl: urlData?.publicUrl ?? null, path: remotePath };
  } catch (err) {
    console.error('uploadWithMeta exception', err);
    return { publicUrl: null, path: null, error: err };
  }
}
