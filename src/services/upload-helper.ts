import { apiClient } from './api-client';

export interface PresignedUploadResult {
  uploadUrl: string;
  fileUrl: string;
  key: string;
}

/** Maximum upload file size: 10 MB (must match API MAX_FILE_SIZE) */
export const MAX_UPLOAD_FILE_SIZE = 10 * 1024 * 1024;

export async function uploadImageViaPresignedUrl(
  uri: string,
  mimeType: string = 'image/jpeg',
): Promise<string> {
  const extension = mimeType.split('/')[1] || 'jpg';
  const filename = `photo_${Date.now()}.${extension}`;

  // Fetch the local file as a blob to check size before requesting presigned URL
  const response = await fetch(uri);
  const blob = await response.blob();

  if (blob.size > MAX_UPLOAD_FILE_SIZE) {
    throw new Error(
      `File size exceeds maximum of ${MAX_UPLOAD_FILE_SIZE / (1024 * 1024)} MB`,
    );
  }

  // 1. Request presigned PUT URL from backend
  const presigned = await apiClient.get<PresignedUploadResult>(
    '/uploads/presigned-url',
    {
      params: {
        filename,
        contentType: mimeType,
        fileSize: blob.size,
      },
    },
  );

  // 2. Upload directly to S3/R2/MinIO via PUT
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

  // 3. Ask the API to strip EXIF/GPS metadata before the URL is persisted
  const finalized = await apiClient.post<{ fileUrl: string; key: string }>(
    '/uploads/finalize',
    { key: presigned.key, contentType: mimeType },
  );

  return finalized.fileUrl;
}
