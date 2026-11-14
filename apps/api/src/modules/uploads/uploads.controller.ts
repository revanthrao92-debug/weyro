import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Post,
  Put,
  Query,
  Req,
  Res,
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
import { Public } from '../../common/decorators/public.decorator';
import { AuthUserPayload } from '../../common/types/auth-user-payload.type';
import { z } from 'zod';

const UPLOAD_FOLDERS = [
  'damage-requests',
  'vehicles',
  'avatars',
  'spare-parts',
  'verification-documents',
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

  /**
   * Development-only local driver. The PUT body is captured by express.raw in
   * main.ts; finalize still validates the image signature and strips EXIF.
   */
  // The local driver is development-only and both routes require the
  // short-lived HMAC token embedded in the presigned URL.
  @Public()
  @Put('local-upload')
  async localUpload(
    @Query('key') key: string,
    @Query('token') token: string,
    @Req() req: any,
  ) {
    if (!this.storageService.receiveLocalUpload ||
        !this.storageService.verifyLocalKey) {
      throw new BadRequestException('Local uploads are not enabled');
    }
    if (!key || !token || !this.storageService.verifyLocalKey(key, token)) {
      throw new BadRequestException('Invalid or expired upload token');
    }
    await this.storageService.receiveLocalUpload(key, req.body);
    return { uploaded: true };
  }

  @Public()
  @Get('local-file')
  async localFile(
    @Query('key') key: string,
    @Query('token') token: string,
    @Res() res: any,
  ) {
    if (!this.storageService.readLocalFile ||
        !this.storageService.verifyLocalKey) {
      throw new BadRequestException('Local storage is not enabled');
    }
    if (!key || !token || !this.storageService.verifyLocalKey(key, token)) {
      throw new BadRequestException('Invalid or expired file token');
    }
    const file = await this.storageService.readLocalFile(key);
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Cache-Control', 'private, max-age=0');
    res.send(file.body);
  }
}
