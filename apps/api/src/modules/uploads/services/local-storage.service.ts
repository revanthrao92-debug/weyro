import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
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

/**
 * Development-only local disk storage.
 *
 * The API accepts the PUT through a dev upload route, validates the file
 * signature, strips EXIF and serves the cleaned file back. It never fabricates
 * a successful upload.
 */
@Injectable()
export class LocalStorageService implements StorageService {
  private readonly logger = new Logger(LocalStorageService.name);
  private readonly imageProcessor = new ImageProcessingService();
  private readonly rootDir = path.resolve(process.cwd(), 'uploads');

  constructor() {
    if (env.NODE_ENV === 'production') {
      throw new Error(
        'FATAL: LocalStorageService cannot run in production. Set STORAGE_DRIVER=s3 with real credentials.',
      );
    }
  }

  private apiBase(): string {
    return (
      env.API_PUBLIC_URL?.replace(/\/+$/, '') ||
      `http://localhost:${env.PORT}`
    );
  }

  private resolveKey(key: string): string {
    if (!key || key.includes('..') || path.isAbsolute(key)) {
      throw new BadRequestException('Invalid storage key');
    }
    const resolved = path.resolve(this.rootDir, key);
    if (!resolved.startsWith(`${this.rootDir}${path.sep}`)) {
      throw new BadRequestException('Invalid storage key');
    }
    return resolved;
  }

  private sign(key: string, ttlSeconds = 900): string {
    const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
    const mac = crypto
      .createHmac('sha256', env.JWT_ACCESS_SECRET)
      .update(`${key}:${expires}`)
      .digest('hex');
    return `${expires}.${mac}`;
  }

  verifyLocalKey(key: string, token: string): boolean {
    const [expiresRaw, mac] = token.split('.');
    const expires = Number(expiresRaw);
    if (!Number.isFinite(expires) || expires < Date.now() / 1000 || !mac) {
      return false;
    }
    const expected = crypto
      .createHmac('sha256', env.JWT_ACCESS_SECRET)
      .update(`${key}:${expires}`)
      .digest('hex');
    const a = Buffer.from(mac, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  private fileUrl(key: string, ttlSeconds?: number): string {
    return `${this.apiBase()}/api/v1/uploads/local-file?key=${encodeURIComponent(key)}&token=${encodeURIComponent(this.sign(key, ttlSeconds))}`;
  }

  async getPresignedUploadUrl(
    params: PresignedUrlParams,
  ): Promise<PresignedUrlResult> {
    const { contentType, folder = 'damage-requests', ownerId } = params;
    const ext =
      contentType === 'image/png'
        ? 'png'
        : contentType === 'image/webp'
          ? 'webp'
          : contentType === 'image/heic'
            ? 'heic'
            : 'jpg';
    const randomId = crypto.randomBytes(8).toString('hex');
    const ownerPrefix = ownerId ? `${ownerId}/` : '';
    const key = `${folder}/${ownerPrefix}${Date.now()}_${randomId}.${ext}`;
    const token = this.sign(key, 300);

    return {
      uploadUrl: `${this.apiBase()}/api/v1/uploads/local-upload?key=${encodeURIComponent(key)}&token=${encodeURIComponent(token)}`,
      fileUrl: '',
      key,
      expiresInSeconds: 300,
    };
  }

  async getPresignedDownloadUrl(
    params: PresignedDownloadUrlParams,
  ): Promise<PresignedDownloadUrlResult> {
    return {
      downloadUrl: this.fileUrl(params.key, params.expiresInSeconds),
      key: params.key,
      expiresInSeconds: params.expiresInSeconds ?? 300,
    };
  }

  async receiveLocalUpload(key: string, body: Buffer): Promise<void> {
    const target = this.resolveKey(key);
    if (!Buffer.isBuffer(body) || body.length === 0) {
      throw new BadRequestException('Uploaded file is empty');
    }
    if (body.length > MAX_UPLOAD_FILE_SIZE) {
      throw new BadRequestException('Uploaded file exceeds the size limit');
    }
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, body);
  }

  async readLocalFile(
    key: string,
  ): Promise<{ body: Buffer; contentType: string }> {
    const target = this.resolveKey(key);
    const stat = await fs.stat(target);
    if (stat.size > MAX_UPLOAD_FILE_SIZE) {
      throw new BadRequestException('Stored object exceeds the size limit');
    }
    const body = await fs.readFile(target);
    const extension = path.extname(target).toLowerCase();
    const contentType =
      extension === '.png'
        ? 'image/png'
        : extension === '.webp'
          ? 'image/webp'
          : extension === '.heic'
            ? 'image/heic'
            : 'image/jpeg';
    return { body, contentType };
  }

  async finalizeImage(params: {
    key: string;
    contentType: string;
  }): Promise<FinalizeImageResult> {
    const target = this.resolveKey(params.key);
    const stat = await fs.stat(target);
    if (stat.size > MAX_UPLOAD_FILE_SIZE) {
      throw new BadRequestException('Uploaded object exceeds the size limit');
    }
    const original = await fs.readFile(target);
    if (original.length > MAX_UPLOAD_FILE_SIZE) {
      throw new BadRequestException('Uploaded object exceeds the size limit');
    }

    this.imageProcessor.assertValidImage(original, params.contentType);
    const cleaned = await this.imageProcessor.stripExif(original);
    await fs.writeFile(target, cleaned);

    this.logger.log(`Sanitized local image metadata for key: ${params.key}`);
    return { key: params.key, previewUrl: this.fileUrl(params.key) };
  }
}
