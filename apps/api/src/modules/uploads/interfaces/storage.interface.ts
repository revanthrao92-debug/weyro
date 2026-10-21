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

export interface FinalizeImageResult {
  fileUrl: string;
  key: string;
}

export interface StorageService {
  getPresignedUploadUrl(params: PresignedUrlParams): Promise<PresignedUrlResult>;
  finalizeImage(params: {
    key: string;
    contentType: string;
  }): Promise<FinalizeImageResult>;
}

export const STORAGE_SERVICE = Symbol('STORAGE_SERVICE');
