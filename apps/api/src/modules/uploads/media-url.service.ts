import { Inject, Injectable } from '@nestjs/common';
import { STORAGE_SERVICE, StorageService } from './interfaces/storage.interface';
import { extractMediaKey, isHttpUrl, isMediaKey } from '../../common/media/media-key';

/** C3: signed GET URLs handed to clients live for one hour. */
export const MEDIA_URL_TTL_SECONDS = 3600;

/**
 * Turns stored object keys into short-lived signed URLs at read time.
 * The database only ever holds keys, so nothing stored can expire.
 */
@Injectable()
export class MediaUrlService {
  constructor(@Inject(STORAGE_SERVICE) private readonly storage: StorageService) {}

  /** Presigned GET (TTL 1 hour) for a stored key. */
  async sign(key: string): Promise<string> {
    const { downloadUrl } = await this.storage.getPresignedDownloadUrl({
      key,
      expiresInSeconds: MEDIA_URL_TTL_SECONDS,
    });
    return downloadUrl;
  }

  /**
   * Sign whatever is stored in a media column:
   *  - a key                          → signed URL
   *  - a legacy full URL to our store → key extracted, then signed
   *  - anything else (external image) → returned unchanged
   * A signing failure never breaks the whole response: the raw value is returned.
   */
  async resolve(value: string | null | undefined): Promise<string | null | undefined> {
    if (!value) return value;
    const key = isMediaKey(value) ? value : isHttpUrl(value) ? extractMediaKey(value) : null;
    if (!key) return value;
    try {
      return await this.sign(key);
    } catch {
      return value;
    }
  }
}
