import { apiClient } from './api-client';

export type UploadFolder = 'damage-requests' | 'vehicles' | 'avatars' | 'spare-parts' | 'verification-documents';

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
 * presign -> PUT the bytes -> finalize.
 *
 * The returned URL is only ever the one the server finalized. A failed PUT
 * must fail the upload; there is no placeholder success path.
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

  const put = await fetch(presign.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body,
  });
  if (!put.ok) {
    throw new Error(`Photo upload failed (${put.status}). Try again.`);
  }

  const finalized = await apiClient<{ fileUrl: string; key: string }>('/uploads/finalize', {
    method: 'POST',
    body: JSON.stringify({ key: presign.key, contentType }),
  });

  if (!finalized.fileUrl) {
    throw new Error('Photo upload could not be confirmed. Try again.');
  }

  return { url: finalized.fileUrl, key: presign.key };
}
