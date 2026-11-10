import { BadRequestException } from '@nestjs/common';
import {
  ImageProcessingService,
  MAX_UPLOAD_FILE_SIZE,
  detectImageMime,
} from './image-processing.service';

const pad = (head: number[]) =>
  Buffer.concat([Buffer.from(head), Buffer.alloc(64, 0)]);

describe('ImageProcessingService — content validation', () => {
  const service = new ImageProcessingService();

  it('detects allowed image signatures', () => {
    expect(detectImageMime(pad([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(
      detectImageMime(pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    ).toBe('image/png');
    const webp = Buffer.concat([
      Buffer.from('RIFF'),
      Buffer.alloc(4),
      Buffer.from('WEBP'),
      Buffer.alloc(32),
    ]);
    expect(detectImageMime(webp)).toBe('image/webp');
    const heic = Buffer.concat([
      Buffer.alloc(4),
      Buffer.from('ftypheic'),
      Buffer.alloc(32),
    ]);
    expect(detectImageMime(heic)).toBe('image/heic');
  });

  it('rejects non-image bytes even when the declared type is an image', () => {
    const text = Buffer.from('MZ this is not an image at all, just text bytes');
    expect(detectImageMime(text)).toBeNull();
    expect(() => service.assertValidImage(text, 'image/jpeg')).toThrow(
      BadRequestException,
    );
  });

  it('rejects content that does not match the declared type', () => {
    const png = pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(() => service.assertValidImage(png, 'image/jpeg')).toThrow(
      /does not match/,
    );
  });

  it('never returns the original buffer when decoding fails', async () => {
    const junk = pad([0xff, 0xd8, 0xff, 0xe0]); // valid header, invalid content
    await expect(service.stripExif(junk)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('enforces the maximum file size', () => {
    expect(() => service.validateFileSize(MAX_UPLOAD_FILE_SIZE + 1)).toThrow(
      BadRequestException,
    );
  });
});
