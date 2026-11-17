export interface PresignedUrlParams {
  filename: string;
  contentType: string;
  folder?: string;
  fileSize?: number;
  ownerId?: string;
}

export interface PresignedUrlResult {
  uploadUrl: string;
  fileUrl: string;
  key: string;
  expiresInSeconds: number;
}

export interface PresignedDownloadUrlParams {
  key: string;
  expiresInSeconds?: number;
}

export interface PresignedDownloadUrlResult {
  downloadUrl: string;
  key: string;
  expiresInSeconds: number;
}

export interface FinalizeImageResult {
  /** The value to store and send back to the API — never a URL. */
  key: string;
  /** Short-lived signed URL, only for showing the image right after upload. */
  previewUrl: string;
}

export interface StorageService {
  /** Development-only local driver hooks. Absent for S3. */
  receiveLocalUpload?(key: string, body: Buffer): Promise<void>;
  verifyLocalKey?(key: string, token: string): boolean;
  readLocalFile?(key: string): Promise<{ body: Buffer; contentType: string }>;
  getPresignedUploadUrl(params: PresignedUrlParams): Promise<PresignedUrlResult>;
  getPresignedDownloadUrl(
    params: PresignedDownloadUrlParams,
  ): Promise<PresignedDownloadUrlResult>;
  finalizeImage(params: {
    key: string;
    contentType: string;
  }): Promise<FinalizeImageResult>;
}

export const STORAGE_SERVICE = Symbol('STORAGE_SERVICE');
