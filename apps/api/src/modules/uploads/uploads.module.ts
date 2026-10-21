import { Module } from '@nestjs/common';
import { UploadsController } from './uploads.controller';
import { STORAGE_SERVICE } from './interfaces/storage.interface';
import { S3StorageService } from './services/s3-storage.service';
import { MockStorageService } from './services/mock-storage.service';
import { env } from '../../config/env.config';

@Module({
  controllers: [UploadsController],
  providers: [
    {
      provide: STORAGE_SERVICE,
      useClass:
        env.STORAGE_DRIVER === 's3' && env.STORAGE_BUCKET
          ? S3StorageService
          : MockStorageService,
    },
  ],
  exports: [STORAGE_SERVICE],
})
export class UploadsModule {}
