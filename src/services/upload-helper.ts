import { apiClient } from './api-client';

export interface PresignedUploadResult {
  uploadUrl: string;
  publicUrl: string;
  key: string;
}

export async function uploadImageViaPresignedUrl(
  uri: string,
  mimeType: string = 'image/jpeg',
): Promise<string> {
  const extension = mimeType.split('/')[1] || 'jpg';
  const filename = `photo_${Date.now()}.${extension}`;

  // 1. Request presigned PUT URL from backend
  const presigned = await apiClient.get<PresignedUploadResult>(
    '/uploads/presigned-url',
    {
      params: {
        filename,
        contentType: mimeType,
      },
    },
  );

  // 2. Fetch the local file as a blob
  const response = await fetch(uri);
  const blob = await response.blob();

  // 3. Upload directly to S3/R2/MinIO via PUT
  const uploadRes = await fetch(presigned.uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': mimeType,
    },
    body: blob,
  });

  if (!uploadRes.ok) {
    throw new Error(`Direct upload failed with status ${uploadRes.status}`);
  }

  // 4. Return permanent public URL
  return presigned.publicUrl;
}
