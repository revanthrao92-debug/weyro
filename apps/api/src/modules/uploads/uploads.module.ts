import { Module } from '@nestjs/common';
import { UploadsController } from './uploads.controller';
import { STORAGE_SERVICE } from './interfaces/storage.interface';
import { S3StorageService } from './services/s3-storage.service';
import { LocalStorageService } from './services/local-storage.service';
import { MediaUrlService } from './media-url.service';
import { UploadsCleanupService } from './uploads-cleanup.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { AdvisoryLockService } from '../../prisma/advisory-lock.service';
import { env } from '../../config/env.config';

@Module({
  imports: [PrismaModule],
  controllers: [UploadsController],
  providers: [
    {
      provide: STORAGE_SERVICE,
      useClass:
        env.STORAGE_DRIVER === 's3' && env.STORAGE_BUCKET
          ? S3StorageService
          : LocalStorageService,
    },
    AdvisoryLockService,
    UploadsCleanupService,
    MediaUrlService,
  ],
  exports: [STORAGE_SERVICE, MediaUrlService],
})
export class UploadsModule {}
