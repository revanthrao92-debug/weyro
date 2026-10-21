import { Injectable, Logger } from '@nestjs/common';
import {
  FinalizeImageResult,
  PresignedDownloadUrlParams,
  PresignedDownloadUrlResult,
  PresignedUrlParams,
  PresignedUrlResult,
  StorageService,
} from '../interfaces/storage.interface';
import * as crypto from 'crypto';

@Injectable()
export class MockStorageService implements StorageService {
  private readonly logger = new Logger(MockStorageService.name);

  constructor() {
    this.logger.warn(
      'MockStorageService initialized. Only for non-production development.',
    );
  }

  async getPresignedUploadUrl(
    params: PresignedUrlParams,
  ): Promise<PresignedUrlResult> {
    const { filename, folder = 'damage-requests', ownerId } = params;
    const cleanExt = filename.split('.').pop()?.toLowerCase() || 'jpg';
    const randomId = crypto.randomBytes(8).toString('hex');
    const ownerPrefix = ownerId ? `${ownerId}/` : '';
    const key = `${folder}/${ownerPrefix}${Date.now()}_${randomId}.${cleanExt}`;

    return {
      uploadUrl: `https://storage.mock.local/upload/${key}?sig=mock_presigned_signature`,
      fileUrl: `https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=800&q=80`,
      key,
      expiresInSeconds: 300,
    };
  }

  async getPresignedDownloadUrl(
    params: PresignedDownloadUrlParams,
  ): Promise<PresignedDownloadUrlResult> {
    const { key, expiresInSeconds = 300 } = params;
    return {
      downloadUrl: `https://storage.mock.local/download/${key}?sig=mock_presigned_download&expires=${expiresInSeconds}`,
      key,
      expiresInSeconds,
    };
  }

  async finalizeImage(params: {
    key: string;
    contentType: string;
  }): Promise<FinalizeImageResult> {
    return {
      fileUrl: `https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=800&q=80`,
      key: params.key,
    };
  }
}
