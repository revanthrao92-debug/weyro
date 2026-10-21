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

const UPLOAD_FOLDERS = [
  'damage-requests',
  'vehicles',
  'avatars',
  'spare-parts',
] as const;

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
