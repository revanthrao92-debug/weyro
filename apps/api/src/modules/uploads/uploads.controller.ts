import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  STORAGE_SERVICE,
  StorageService,
} from './interfaces/storage.interface';
import { presignedUrlQuerySchema, MAX_FILE_SIZE, ALLOWED_MIME_TYPES } from './dto/presigned-url.dto';
import { z } from 'zod';

@Controller('uploads')
export class UploadsController {
  constructor(
    @Inject(STORAGE_SERVICE) private readonly storageService: StorageService,
  ) {}

  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Get('presigned-url')
  async getPresignedUrl(
    @Query('filename') filename: string,
    @Query('contentType') contentType: string,
    @Query('folder') folder?: string,
    @Query('fileSize') fileSize?: string,
  ) {
    if (!filename || filename.trim().length === 0) {
      throw new BadRequestException('filename query parameter is required');
    }

    if (!contentType || !ALLOWED_MIME_TYPES.includes(contentType as any)) {
      throw new BadRequestException(
        `Invalid contentType "${contentType}". Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`,
      );
    }

    // Validate file size if provided
    if (fileSize !== undefined) {
      const size = parseInt(fileSize, 10);
      if (isNaN(size) || size <= 0) {
        throw new BadRequestException('fileSize must be a positive integer');
      }
      if (size > MAX_FILE_SIZE) {
        throw new BadRequestException(
          `File size exceeds maximum of ${MAX_FILE_SIZE / (1024 * 1024)} MB`,
        );
      }
    }

    return this.storageService.getPresignedUploadUrl({
      filename: filename.trim(),
      contentType: contentType.trim(),
      folder: folder?.trim(),
    });
  }
}
