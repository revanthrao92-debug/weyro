import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { MediaUrlService } from '../../modules/uploads/media-url.service';

/** Fields that hold a single media key (or null). */
const SINGLE_FIELDS = new Set(['imageUrl', 'avatarUrl']);
/** Fields that hold an array of media keys. */
const ARRAY_FIELDS = new Set(['damagePhotos', 'mediaUrls']);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * C3: every HTTP response that carries media is serialized here — stored keys
 * are swapped for freshly signed URLs on the way out. Dates, Decimals, Buffers
 * and other class instances are passed through untouched.
 */
@Injectable()
export class MediaUrlInterceptor implements NestInterceptor {
  constructor(private readonly media: MediaUrlService) {}

  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(mergeMap((body) => this.transform(body)));
  }

  async transform(value: unknown): Promise<unknown> {
    if (Array.isArray(value)) {
      return Promise.all(value.map((item) => this.transform(item)));
    }
    if (!isPlainObject(value)) return value;

    const out: Record<string, unknown> = {};
    // A RequestMedia row looks like { url, fileType, ... }.
    const isMediaRow = typeof value.url === 'string' && typeof value.fileType === 'string';

    await Promise.all(
      Object.entries(value).map(async ([field, item]) => {
        if (SINGLE_FIELDS.has(field) && (typeof item === 'string' || item === null)) {
          out[field] = await this.media.resolve(item);
        } else if (isMediaRow && field === 'url' && typeof item === 'string') {
          out[field] = await this.media.resolve(item);
        } else if (
          ARRAY_FIELDS.has(field) &&
          Array.isArray(item) &&
          item.every((entry) => typeof entry === 'string')
        ) {
          out[field] = await Promise.all(
            (item as string[]).map((entry) => this.media.resolve(entry)),
          );
        } else {
          out[field] = await this.transform(item);
        }
      }),
    );
    // Preserve the original key order for stable snapshots / clients.
    return Object.fromEntries(Object.keys(value).map((k) => [k, out[k]]));
  }
}
