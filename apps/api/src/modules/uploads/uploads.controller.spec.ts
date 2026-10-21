import { BadRequestException } from '@nestjs/common';
import { UploadsController } from './uploads.controller';
import { StorageService } from './interfaces/storage.interface';
import { S3StorageService } from './services/s3-storage.service';

describe('Uploads Module', () => {
  let controller: UploadsController;
  let mockStorage: jest.Mocked<StorageService>;

  beforeEach(() => {
    mockStorage = {
      getPresignedUploadUrl: jest.fn(),
    };

    controller = new UploadsController(mockStorage);
  });

  describe('UploadsController', () => {
    it('generates presigned PUT URL for valid image/jpeg', async () => {
      mockStorage.getPresignedUploadUrl.mockResolvedValue({
        uploadUrl: 'https://s3.amazonaws.com/bucket/key?sig=123',
        fileUrl: 'https://cdn.weyro.in/damage-requests/key.jpg',
        key: 'damage-requests/key.jpg',
        expiresInSeconds: 300,
      });

      const result = await controller.getPresignedUrl(
        'bumper.jpg',
        'image/jpeg',
        'damage-requests',
      );

      expect(mockStorage.getPresignedUploadUrl).toHaveBeenCalledWith({
        filename: 'bumper.jpg',
        contentType: 'image/jpeg',
        folder: 'damage-requests',
      });
      expect(result.uploadUrl).toContain('https://s3.amazonaws.com');
    });

    it('rejects disallowed content types with 400 Bad Request', async () => {
      await expect(
        controller.getPresignedUrl('malware.exe', 'application/x-msdownload'),
      ).rejects.toThrow(BadRequestException);

      await expect(
        controller.getPresignedUrl('document.pdf', 'application/pdf'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects empty filename with 400 Bad Request', async () => {
      await expect(
        controller.getPresignedUrl('', 'image/png'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('S3StorageService', () => {
    it('generates valid key and fileUrl from configured bucket and region', async () => {
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
      expect(result.fileUrl).toContain('https://cdn.weyro.in/damage-requests/');
      expect(result.uploadUrl).toBeDefined();
    });
  });
});
