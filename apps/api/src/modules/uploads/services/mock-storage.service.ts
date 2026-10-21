import { Injectable, Logger } from '@nestjs/common';
import {
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
    const { filename, folder = 'damage-requests' } = params;
    const cleanExt = filename.split('.').pop()?.toLowerCase() || 'jpg';
    const randomId = crypto.randomBytes(8).toString('hex');
    const key = `${folder}/${Date.now()}_${randomId}.${cleanExt}`;

    return {
      uploadUrl: `https://storage.mock.local/upload/${key}?sig=mock_presigned_signature`,
      fileUrl: `https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=800&q=80`,
      key,
      expiresInSeconds: 300,
    };
  }
}
