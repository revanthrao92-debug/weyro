import { Injectable, Logger } from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  PresignedUrlParams,
  PresignedUrlResult,
  StorageService,
} from '../interfaces/storage.interface';
import { env } from '../../../config/env.config';
import * as crypto from 'crypto';

@Injectable()
export class S3StorageService implements StorageService {
  private readonly logger = new Logger(S3StorageService.name);
  private readonly s3Client: S3Client;
  private readonly bucket: string;
  private readonly publicUrl: string;

  constructor(options?: {
    bucket?: string;
    region?: string;
    endpoint?: string;
    accessKey?: string;
    secretKey?: string;
    publicUrl?: string;
  }) {
    const bucket = options?.bucket || env.STORAGE_BUCKET || 'weyro-uploads';
    const region = options?.region || env.STORAGE_REGION || 'ap-south-1';
    const endpoint = options?.endpoint || env.STORAGE_ENDPOINT;
    const accessKey = options?.accessKey || env.STORAGE_ACCESS_KEY || '';
    const secretKey = options?.secretKey || env.STORAGE_SECRET_KEY || '';

    this.bucket = bucket;
    this.publicUrl =
      options?.publicUrl ||
      env.STORAGE_PUBLIC_URL ||
      (endpoint
        ? `${endpoint}/${bucket}`
        : `https://${bucket}.s3.${region}.amazonaws.com`);

    this.s3Client = new S3Client({
      region,
      endpoint: endpoint || undefined,
      credentials:
        accessKey && secretKey
          ? {
              accessKeyId: accessKey,
              secretAccessKey: secretKey,
            }
          : undefined,
      forcePathStyle: Boolean(endpoint),
    });
  }

  async getPresignedUploadUrl(
    params: PresignedUrlParams,
  ): Promise<PresignedUrlResult> {
    const { filename, contentType, folder = 'damage-requests' } = params;
    const cleanExt = filename.split('.').pop()?.toLowerCase() || 'jpg';
    const randomId = crypto.randomBytes(8).toString('hex');
    const key = `${folder}/${Date.now()}_${randomId}.${cleanExt}`;
    const expiresInSeconds = 300; // 5 minutes

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: expiresInSeconds,
    });

    const fileUrl = `${this.publicUrl}/${key}`;

    this.logger.log(`Generated presigned PUT URL for key: ${key}`);

    return {
      uploadUrl,
      fileUrl,
      key,
      expiresInSeconds,
    };
  }
}
