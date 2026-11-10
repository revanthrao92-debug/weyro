import { stdSerializers } from 'pino';

/**
 * HTTP log serializers.
 *
 * The pino-http default request serializer includes `req.headers`, which would
 * write `Authorization: Bearer <access token>` and cookies into every log line.
 * These serializers log only non-sensitive routing metadata.
 *
 * Keep this list minimal — never add bodies, headers or query tokens.
 */

type RequestLike = {
  id?: string;
  method?: string;
  url?: string;
  remoteAddress?: string;
  remotePort?: number;
};

type ResponseLike = { statusCode?: number };

export const httpSerializers = {
  req: (req: RequestLike) => ({
    id: req.id,
    method: req.method,
    url: req.url,
    remoteAddress: req.remoteAddress,
    remotePort: req.remotePort,
  }),
  res: (res: ResponseLike) => ({ statusCode: res.statusCode }),
  err: stdSerializers.err,
};
