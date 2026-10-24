import { apiClient } from './api-client';

export type UploadFolder = 'damage-requests' | 'vehicles' | 'avatars' | 'spare-parts';

export interface UploadedImage {
  url: string;
  key: string;
}

/** Local file metadata from expo-image-picker (avoids re-deriving it). */
export interface LocalImageMeta {
  fileName?: string | null;
  mimeType?: string;
  fileSize?: number;
}

const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
};

interface PresignResponse {
  uploadUrl: string;
  fileUrl: string;
  key: string;
  expiresInSeconds: number;
}

/**
 * Upload a local image (file:// uri from expo-image-picker) to the backend:
 * presign -> PUT the bytes -> finalize -> return the public URL.
 *
 * Dev note: the default `mock` storage driver returns a non-routable presigned
 * URL, so the PUT is expected to fail locally. In __DEV__ we fall back to the
 * placeholder fileUrl it provides so the UI flow stays testable end-to-end.
 */
export async function uploadImage(
  uri: string,
  folder: UploadFolder = 'damage-requests',
  meta: LocalImageMeta = {}
): Promise<UploadedImage> {
  const filename =
    meta.fileName || uri.split('/').pop()?.split('?')[0] || `photo-${Date.now()}.jpg`;
  const ext = (filename.split('.').pop() || 'jpg').toLowerCase();
  const contentType = meta.mimeType || MIME_BY_EXT[ext] || 'image/jpeg';

  const body = await (await fetch(uri)).blob();
  const fileSize = meta.fileSize ?? (body.size > 0 ? body.size : 1);

  const qs = new URLSearchParams({
    filename,
    contentType,
    folder,
    fileSize: String(fileSize),
  });
  const presign = await apiClient<PresignResponse>(`/uploads/presigned-url?${qs.toString()}`);

  try {
    const put = await fetch(presign.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body,
    });
    if (!put.ok) {
      throw new Error(`Upload failed (${put.status})`);
    }
    const finalized = await apiClient<{ fileUrl: string; key: string }>('/uploads/finalize', {
      method: 'POST',
      body: JSON.stringify({ key: presign.key, contentType }),
    });
    return { url: finalized.fileUrl || presign.fileUrl, key: presign.key };
  } catch (error) {
    if (__DEV__) {
      // Mock storage driver — keep the flow usable with its placeholder image.
      return { url: presign.fileUrl, key: presign.key };
    }
    throw error;
  }
}
