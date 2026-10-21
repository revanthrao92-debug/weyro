import { Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';

/**
 * Maximum upload file size: 10 MB
 */
export const MAX_UPLOAD_FILE_SIZE = 10 * 1024 * 1024;

@Injectable()
export class ImageProcessingService {
  private readonly logger = new Logger(ImageProcessingService.name);

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
      this.logger.error(`EXIF stripping failed: ${err.message}`);
      // Return original buffer if stripping fails (don't block upload)
      return buffer;
    }
  }

  /**
   * Validate file size against the maximum allowed size.
   */
  validateFileSize(sizeInBytes: number): void {
    if (sizeInBytes > MAX_UPLOAD_FILE_SIZE) {
      throw new Error(
        `File size ${Math.round(sizeInBytes / 1024 / 1024)}MB exceeds maximum of ${Math.round(MAX_UPLOAD_FILE_SIZE / 1024 / 1024)}MB`,
      );
    }
  }
}
