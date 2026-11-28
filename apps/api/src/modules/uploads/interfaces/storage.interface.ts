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
  /**
   * Store a private, non-image file written by the server (e.g. the nightly dataset). Keys outside
   * the media folders are never signed for clients (see common/media/media-key.ts).
   */
  putPrivateObject(params: { key: string; body: Buffer; contentType: string; contentEncoding?: string }): Promise<void>;
  /** True when a file already exists at this key. */
  objectExists(key: string): Promise<boolean>;
  /** Remove a server-written private file (no error if it's already gone). */
  deletePrivateObject(key: string): Promise<void>;
}

export const STORAGE_SERVICE = Symbol('STORAGE_SERVICE');
