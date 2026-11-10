import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';

/**
 * Maximum upload file size: 10 MB
 */
export const MAX_UPLOAD_FILE_SIZE = 10 * 1024 * 1024;

export type AllowedImageMime =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'image/heic';

/**
 * Detect an image type from its magic bytes. A declared Content-Type is not
 * evidence — clients can lie, and presigned PUTs bypass the API entirely.
 */
export function detectImageMime(buffer: Buffer): AllowedImageMime | null {
  if (buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return 'image/png';
  }

  // WebP: "RIFF" .... "WEBP"
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }

  // HEIC/HEIF: .... "ftyp" <brand>
  if (buffer.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brand = buffer.subarray(8, 12).toString('ascii');
    if (['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(brand)) {
      return 'image/heic';
    }
  }

  return null;
}

@Injectable()
export class ImageProcessingService {
  private readonly logger = new Logger(ImageProcessingService.name);

  /**
   * Verify the bytes really are an allowed image and match the declared type.
   * Throws 400 (never silently stores the original).
   */
  assertValidImage(buffer: Buffer, declaredContentType?: string): AllowedImageMime {
    const detected = detectImageMime(buffer);
    if (!detected) {
      throw new BadRequestException(
        'Uploaded file is not a supported image (jpeg, png, webp, heic)',
      );
    }
    if (declaredContentType && detected !== declaredContentType) {
      throw new BadRequestException(
        `File content (${detected}) does not match the declared type (${declaredContentType})`,
      );
    }
    return detected;
  }

  /**
   * Strip EXIF metadata (including GPS coordinates) from an image buffer
   * and re-encode with stripped metadata. Returns the processed buffer.
   */
  async stripExif(buffer: Buffer): Promise<Buffer> {
    try {
      // sharp by default strips all EXIF metadata when re-encoding
      const processed = await sharp(buffer)
        .rotate() // auto-orient based on EXIF, then discard orientation tag
        .withMetadata({}) // strip all metadata including EXIF/GPS
        .toBuffer();

      this.logger.log(
        `EXIF stripped: ${buffer.length} bytes -> ${processed.length} bytes`,
      );
      return processed;
    } catch (err: any) {
      this.logger.warn(`Image decode failed: ${err.message}`);
      // Never store unprocessable bytes — this is how non-images slip through.
      throw new BadRequestException('Uploaded file could not be processed as an image');
    }
  }

  /**
   * Validate file size against the maximum allowed size.
   */
  validateFileSize(sizeInBytes: number): void {
    if (sizeInBytes > MAX_UPLOAD_FILE_SIZE) {
      throw new BadRequestException(
        `File size ${Math.round(sizeInBytes / 1024 / 1024)}MB exceeds maximum of ${Math.round(MAX_UPLOAD_FILE_SIZE / 1024 / 1024)}MB`,
      );
    }
  }
}
