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
import { ALLOWED_MIME_TYPES } from './dto/presigned-url.dto';

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
  ) {
    if (!filename || filename.trim().length === 0) {
      throw new BadRequestException('filename query parameter is required');
    }

    if (!contentType || !ALLOWED_MIME_TYPES.includes(contentType as any)) {
      throw new BadRequestException(
        `Invalid contentType "${contentType}". Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`,
      );
    }

    return this.storageService.getPresignedUploadUrl({
      filename: filename.trim(),
      contentType: contentType.trim(),
      folder: folder?.trim(),
    });
  }
}
