import { describe, it, expect, afterEach } from '@jest/globals';
import * as fs from 'fs/promises';
import * as path from 'path';
import sharp from 'sharp';
import { LocalStorageService } from './local-storage.service';

describe('LocalStorageService', () => {
  const keys: string[] = [];

  afterEach(async () => {
    for (const key of keys.splice(0)) {
      await fs.rm(path.resolve(process.cwd(), 'uploads', key), {
        force: true,
      });
    }
  });

  it('stores, validates and strips a real image', async () => {
    const service = new LocalStorageService();
    const presigned = await service.getPresignedUploadUrl({
      filename: 'photo.png',
      contentType: 'image/png',
      folder: 'avatars',
      ownerId: 'user-test',
    });
    keys.push(presigned.key);

    const original = await sharp({
      create: {
        width: 4,
        height: 4,
        channels: 3,
        background: { r: 20, g: 40, b: 60 },
      },
    })
      .png()
      .toBuffer();

    await service.receiveLocalUpload(presigned.key, original);
    const finalized = await service.finalizeImage({
      key: presigned.key,
      contentType: 'image/png',
    });

    expect(finalized.key).toBe(presigned.key);
    expect(finalized.fileUrl).toContain('/api/v1/uploads/local-file?key=');

    const stored = await service.readLocalFile(presigned.key);
    expect(stored.contentType).toBe('image/png');
    expect(stored.body.length).toBeGreaterThan(0);
  });

  it('rejects a file whose bytes are not an allowed image', async () => {
    const service = new LocalStorageService();
    const presigned = await service.getPresignedUploadUrl({
      filename: 'fake.png',
      contentType: 'image/png',
      folder: 'avatars',
      ownerId: 'user-test',
    });
    keys.push(presigned.key);

    await service.receiveLocalUpload(
      presigned.key,
      Buffer.from('this is not an image'),
    );

    await expect(
      service.finalizeImage({
        key: presigned.key,
        contentType: 'image/png',
      }),
    ).rejects.toThrow('not a supported image');
  });

  it('refuses path traversal keys', async () => {
    const service = new LocalStorageService();
    await expect(
      service.receiveLocalUpload('../escape.png', Buffer.from([1, 2, 3])),
    ).rejects.toThrow('Invalid storage key');
  });
});
