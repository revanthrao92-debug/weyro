export interface PresignedUrlParams {
  filename: string;
  contentType: string;
  folder?: string;
}

export interface PresignedUrlResult {
  uploadUrl: string;
  fileUrl: string;
  key: string;
  expiresInSeconds: number;
}

export interface StorageService {
  getPresignedUploadUrl(params: PresignedUrlParams): Promise<PresignedUrlResult>;
}

export const STORAGE_SERVICE = Symbol('STORAGE_SERVICE');
