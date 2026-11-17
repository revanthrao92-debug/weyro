import {
  BadRequestException,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  FinalizeImageResult,
  PresignedDownloadUrlParams,
  PresignedDownloadUrlResult,
  PresignedUrlParams,
  PresignedUrlResult,
  StorageService,
} from '../interfaces/storage.interface';
import { env } from '../../../config/env.config';
import {
  ImageProcessingService,
  MAX_UPLOAD_FILE_SIZE,
} from './image-processing.service';
import * as crypto from 'crypto';

/** Preview URLs returned by finalize only need to outlive the upload screen. */
const MEDIA_PREVIEW_TTL_SECONDS = 900;

@Injectable()
export class S3StorageService implements StorageService {
  private readonly logger = new Logger(S3StorageService.name);
  private readonly imageProcessor = new ImageProcessingService();
  private readonly s3Client: S3Client;
  private readonly bucket: string;
  private readonly publicUrl: string;
  private readonly isPublicBucket: boolean;

  constructor(
    @Optional()
    options?: {
    bucket?: string;
    region?: string;
    endpoint?: string;
    accessKey?: string;
    secretKey?: string;
      publicUrl?: string;
    },
  ) {
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
    // Public only when a public base URL is explicitly configured. Everything
    // else is served through short-lived presigned GETs.
    this.isPublicBucket = Boolean(options?.publicUrl || env.STORAGE_PUBLIC_URL);

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
      forcePathStyle: env.STORAGE_FORCE_PATH_STYLE === 'true',
      // SigV4 presigned PUTs from browsers must not include SDK checksum
      // headers that the client cannot reproduce.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }

  async getPresignedUploadUrl(
    params: PresignedUrlParams,
  ): Promise<PresignedUrlResult> {
    const {
      contentType,
      folder = 'damage-requests',
      fileSize,
      ownerId,
    } = params;
    const cleanExt =
      contentType === 'image/png'
        ? 'png'
        : contentType === 'image/webp'
          ? 'webp'
          : contentType === 'image/heic'
            ? 'heic'
            : 'jpg';
    const randomId = crypto.randomBytes(8).toString('hex');
    const ownerPrefix = ownerId ? `${ownerId}/` : '';
    const key = `${folder}/${ownerPrefix}${Date.now()}_${randomId}.${cleanExt}`;
    const expiresInSeconds = 300; // 5 minutes

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
      ...(fileSize ? { ContentLength: fileSize } : {}),
    });

    const uploadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: expiresInSeconds,
    });

    // Never hand out a working URL before finalize has validated the bytes.
    const fileUrl = '';

    this.logger.log(`Generated presigned PUT URL for key: ${key}`);

    return {
      uploadUrl,
      fileUrl,
      key,
      expiresInSeconds,
    };
  }

  private async createDownloadUrl(key: string, expiresInSeconds: number): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.s3Client, command, { expiresIn: expiresInSeconds });
  }

  async getPresignedDownloadUrl(
    params: PresignedDownloadUrlParams,
  ): Promise<PresignedDownloadUrlResult> {
    const { key, expiresInSeconds = 300 } = params;

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const downloadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: expiresInSeconds,
    });

    this.logger.log(`Generated presigned download URL for key: ${key}`);

    return {
      downloadUrl,
      key,
      expiresInSeconds,
    };
  }

  async finalizeImage(params: {
    key: string;
    contentType: string;
  }): Promise<FinalizeImageResult> {
    const head = await this.s3Client.send(
      new HeadObjectCommand({ Bucket: this.bucket, Key: params.key }),
    );
    if (
      typeof head.ContentLength === 'number' &&
      head.ContentLength > MAX_UPLOAD_FILE_SIZE
    ) {
      throw new BadRequestException('Uploaded object exceeds the size limit');
    }

    const object = await this.s3Client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: params.key }),
    );

    const bytes = await object.Body?.transformToByteArray();
    if (!bytes || bytes.length === 0) {
      throw new BadRequestException('Uploaded object is empty or missing');
    }

    if (bytes.length > MAX_UPLOAD_FILE_SIZE) {
      throw new BadRequestException('Uploaded object exceeds the size limit');
    }

    // H2: verify magic bytes match the declared type before storing.
    this.imageProcessor.assertValidImage(
      Buffer.from(bytes),
      params.contentType,
    );

    const cleaned = await this.imageProcessor.stripExif(Buffer.from(bytes));

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: params.key,
        Body: cleaned,
        ContentType: params.contentType,
        CacheControl: 'private, max-age=0',
      }),
    );

    this.logger.log(`Sanitized image metadata for key: ${params.key}`);

    return {
      key: params.key,
      previewUrl: this.isPublicBucket
        ? `${this.publicUrl}/${params.key}`
        : await this.createDownloadUrl(params.key, MEDIA_PREVIEW_TTL_SECONDS),
    };
  }
}
