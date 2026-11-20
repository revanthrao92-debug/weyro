import { INestApplicationContext, Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';

/**
 * Socket.io adapter that relays broadcasts through Redis, so an emit on one API
 * replica reaches clients connected to any replica (chat, live tracking).
 *
 * It must be installed on the socket.io Server, before Nest creates the
 * gateway namespaces: a gateway's `afterInit` receives a Namespace, where
 * `adapter` is a property, not the setter, so it can't be done there.
 */
export class RedisIoAdapter extends IoAdapter {
  private readonly redisLogger = new Logger(RedisIoAdapter.name);
  private readonly pub: Redis;
  private readonly sub: Redis;

  constructor(app: INestApplicationContext, redisUrl: string) {
    super(app);
    this.pub = new Redis(redisUrl);
    this.sub = this.pub.duplicate();
    for (const client of [this.pub, this.sub]) {
      client.on('error', (err) => this.redisLogger.error(`socket.io redis: ${err.message}`));
    }
  }

  // Typed via IoAdapter: Nest bundles its own socket.io copy (same 4.8 line).
  createIOServer(port: number, options?: Parameters<IoAdapter['createIOServer']>[1]) {
    const server = super.createIOServer(port, options);
    server.adapter(createAdapter(this.pub, this.sub));
    return server;
  }

  async close(server: Parameters<IoAdapter['close']>[0]): Promise<void> {
    await super.close(server);
    this.pub.disconnect();
    this.sub.disconnect();
  }
}
