import { ForbiddenException } from '@nestjs/common';
import { UploadsController } from './uploads.controller';
import { StorageService } from './interfaces/storage.interface';
import { S3StorageService } from './services/s3-storage.service';
import { presignedUrlQuerySchema } from './dto/presigned-url.dto';
import { AuthUserPayload } from '../../common/types/auth-user-payload.type';

const user = {
  sub: 'user-1',
  email: 'user@test.com',
  phone: '+919876543210',
  role: 'CUSTOMER',
} as AuthUserPayload;

describe('Uploads Module', () => {
  let controller: UploadsController;
  let mockStorage: jest.Mocked<StorageService>;
  let mockPrisma: { uploadedObject: { upsert: jest.Mock } };

  beforeEach(() => {
    mockStorage = {
      getPresignedUploadUrl: jest.fn(),
      getPresignedDownloadUrl: jest.fn(),
      finalizeImage: jest.fn(),
    };

    mockPrisma = { uploadedObject: { upsert: jest.fn().mockResolvedValue({}) } };
    controller = new UploadsController(mockStorage, mockPrisma as any);
  });

  describe('UploadsController', () => {
    it('generates presigned PUT URL for valid image/jpeg', async () => {
      mockStorage.getPresignedUploadUrl.mockResolvedValue({
        uploadUrl: 'https://s3.amazonaws.com/bucket/key?sig=123',
        fileUrl: 'https://cdn.weyro.in/damage-requests/key.jpg',
        key: 'damage-requests/key.jpg',
        expiresInSeconds: 300,
      });

      const result = await controller.getPresignedUrl(user, {
        filename: 'bumper.jpg',
        contentType: 'image/jpeg',
        folder: 'damage-requests',
        fileSize: 1024,
      });

      expect(mockStorage.getPresignedUploadUrl).toHaveBeenCalledWith({
        filename: 'bumper.jpg',
        contentType: 'image/jpeg',
        folder: 'damage-requests',
        fileSize: 1024,
        ownerId: 'user-1',
      });
      expect(result.uploadUrl).toContain('https://s3.amazonaws.com');
    });

    it('rejects disallowed content types', () => {
      expect(
        presignedUrlQuerySchema.safeParse({
          filename: 'malware.exe',
          contentType: 'application/x-msdownload',
          fileSize: 1024,
        }).success,
      ).toBe(false);

      expect(
        presignedUrlQuerySchema.safeParse({
          filename: 'document.pdf',
          contentType: 'application/pdf',
          fileSize: 1024,
        }).success,
      ).toBe(false);
    });

    it('rejects empty filenames and oversized files', () => {
      expect(
        presignedUrlQuerySchema.safeParse({
          filename: '',
          contentType: 'image/png',
          fileSize: 1024,
        }).success,
      ).toBe(false);

      expect(
        presignedUrlQuerySchema.safeParse({
          filename: 'photo.png',
          contentType: 'image/png',
          fileSize: 11 * 1024 * 1024,
        }).success,
      ).toBe(false);
    });

    it('finalizes only keys owned by the caller', async () => {
      mockStorage.finalizeImage.mockResolvedValue({
        previewUrl: 'https://cdn.weyro.in/damage-requests/user-1/key.jpg?sig=1',
        key: 'damage-requests/user-1/key.jpg',
      });

      const result = await controller.finalize(user, {
        key: 'damage-requests/user-1/key.jpg',
        contentType: 'image/jpeg',
      });

      expect(result.key).toBe('damage-requests/user-1/key.jpg');

      await expect(
        controller.finalize(user, {
          key: 'damage-requests/other-user/key.jpg',
          contentType: 'image/jpeg',
        }),
      ).rejects.toThrow(ForbiddenException);
      // Only the caller's own key was recorded; the foreign key was refused.
      expect(mockPrisma.uploadedObject.upsert).toHaveBeenCalledTimes(1);
    });

    it('H4: records the finalized key against its owner', async () => {
      mockStorage.finalizeImage.mockResolvedValue({
        previewUrl: 'https://cdn.weyro.in/x?sig=1',
        key: 'damage-requests/user-1/key.jpg',
      });

      await controller.finalize(user, {
        key: 'damage-requests/user-1/key.jpg',
        contentType: 'image/jpeg',
      });

      expect(mockPrisma.uploadedObject.upsert).toHaveBeenCalledWith({
        where: { key: 'damage-requests/user-1/key.jpg' },
        update: { finalizedAt: expect.any(Date) },
        create: { key: 'damage-requests/user-1/key.jpg', ownerId: 'user-1' },
      });
    });
  });

  describe('S3StorageService', () => {
    it('generates a key and withholds a working URL until finalize', async () => {
      const s3Service = new S3StorageService({
        bucket: 'weyro-prod-media',
        region: 'ap-south-1',
        publicUrl: 'https://cdn.weyro.in',
        accessKey: 'test_access_key',
        secretKey: 'test_secret_key',
      });

      const result = await s3Service.getPresignedUploadUrl({
        filename: 'dent.png',
        contentType: 'image/png',
        folder: 'damage-requests',
      });

      expect(result.key).toMatch(/^damage-requests\/\d+_[a-f0-9]+\.png$/);
      expect(result.fileUrl).toBe('');
      expect(result.uploadUrl).toBeDefined();
    });
  });
});
