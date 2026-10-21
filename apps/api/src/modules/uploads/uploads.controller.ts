import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Post,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  STORAGE_SERVICE,
  StorageService,
} from './interfaces/storage.interface';
import {
  finalizeUploadSchema,
  FinalizeUploadDto,
  presignedUrlQuerySchema,
  PresignedUrlQueryDto,
} from './dto/presigned-url.dto';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUserPayload } from '../../common/types/auth-user-payload.type';
import { z } from 'zod';

const UPLOAD_FOLDERS = [
  'damage-requests',
  'vehicles',
  'avatars',
  'spare-parts',
] as const;

const presignedDownloadQuerySchema = z
  .object({
    key: z.string().min(1).max(512),
    expiresInSeconds: z.coerce.number().int().min(60).max(3600).default(300),
  })
  .strict();

type PresignedDownloadQueryDto = z.infer<typeof presignedDownloadQuerySchema>;

@Controller('uploads')
export class UploadsController {
  constructor(
    @Inject(STORAGE_SERVICE) private readonly storageService: StorageService,
  ) {}

  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Get('presigned-url')
  async getPresignedUrl(
    @CurrentUser() user: AuthUserPayload,
    @Query(new ZodValidationPipe(presignedUrlQuerySchema))
    query: PresignedUrlQueryDto,
  ) {
    return this.storageService.getPresignedUploadUrl({
      filename: query.filename,
      contentType: query.contentType,
      folder: query.folder,
      fileSize: query.fileSize,
      ownerId: user.sub,
    });
  }

  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Get('presigned-download-url')
  async getPresignedDownloadUrl(
    @CurrentUser() user: AuthUserPayload,
    @Query(new ZodValidationPipe(presignedDownloadQuerySchema))
    query: PresignedDownloadQueryDto,
  ) {
    // Ownership check: only allow downloading keys that belong to the caller
    const isOwnedKey = UPLOAD_FOLDERS.some((folder) =>
      query.key.startsWith(`${folder}/${user.sub}/`),
    );

    if (!isOwnedKey || query.key.includes('..')) {
      throw new ForbiddenException('You can only download your own uploads');
    }

    return this.storageService.getPresignedDownloadUrl({
      key: query.key,
      expiresInSeconds: query.expiresInSeconds,
    });
  }

  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post('finalize')
  async finalize(
    @CurrentUser() user: AuthUserPayload,
    @Body(new ZodValidationPipe(finalizeUploadSchema)) dto: FinalizeUploadDto,
  ) {
    const isOwnedKey = UPLOAD_FOLDERS.some((folder) =>
      dto.key.startsWith(`${folder}/${user.sub}/`),
    );

    if (!isOwnedKey || dto.key.includes('..')) {
      throw new ForbiddenException('You can only finalize your own uploads');
    }

    return this.storageService.finalizeImage({
      key: dto.key,
      contentType: dto.contentType,
    });
  }
}
