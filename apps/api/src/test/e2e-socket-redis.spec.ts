/**
 * Cross-replica websocket broadcast through Redis (chat, live tracking).
 *
 * Two socket.io servers built by RedisIoAdapter stand in for two API replicas:
 * a client on replica B must receive an emit made on replica A. Goes through
 * the same path Nest uses for a gateway namespace (`create(port, { namespace })`).
 *
 * Needs a Redis: set TEST_REDIS_URL (CI provides one); skipped otherwise.
 */

import type { AddressInfo } from 'net';
import { io as connect, Socket as ClientSocket } from 'socket.io-client';
import { RedisIoAdapter } from '../common/redis/redis-io.adapter';

const redisUrl = process.env.TEST_REDIS_URL;
const describeWithRedis = redisUrl ? describe : describe.skip;

describeWithRedis('Websocket broadcast across replicas (E2E, Redis)', () => {
  const room = `booking:${Date.now()}`;
  const adapters: RedisIoAdapter[] = [];
  const namespaces: any[] = [];
  let client: ClientSocket | undefined;

  const startReplica = () => {
    // No Nest app: the adapter then creates its own HTTP server on `port`.
    const adapter = new RedisIoAdapter(undefined as any, redisUrl!);
    const nsp = adapter.create(0, { namespace: '/tracking' } as any);
    nsp.on('connection', (socket: any) => socket.join(room));
    adapters.push(adapter);
    namespaces.push(nsp);
    return nsp;
  };

  afterAll(async () => {
    client?.disconnect();
    await Promise.all(adapters.map((a, i) => a.close(namespaces[i].server)));
  });

  it('delivers an emit from one replica to a client connected to another', async () => {
    const replicaA = startReplica();
    const replicaB = startReplica();
    const port = (replicaB.server.httpServer.address() as AddressInfo).port;

    client = connect(`http://localhost:${port}/tracking`, { transports: ['websocket'] });
    await new Promise<void>((resolve, reject) => {
      client!.on('connect', () => resolve());
      client!.on('connect_error', reject);
    });
    // Let the server-side join and the Redis subscription settle.
    await new Promise((r) => setTimeout(r, 200));

    let timer: NodeJS.Timeout | undefined;
    const received = new Promise((resolve, reject) => {
      client!.on('location', resolve);
      timer = setTimeout(() => reject(new Error('not delivered')), 3000);
    });
    replicaA.to(room).emit('location', { lat: 12.97, lng: 77.59 });

    await expect(received.finally(() => clearTimeout(timer))).resolves.toEqual({
      lat: 12.97,
      lng: 77.59,
    });
  });
});
