import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, expect, it } from 'vitest';
import { deliver } from '../../src/push/deliver';
import { loadSender } from '../../src/push/senderKeys';
import { createTestDatabase } from '../helpers/server';
import { newDevice } from '../helpers/push';

const servers: Server[] = [];

async function listen(handler: Parameters<typeof createServer>[1]): Promise<string> {
  const server = createServer(handler);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map((server) => new Promise((resolve) => server.close(resolve))),
  );
});

// fetch follows a 307 or 308 with the same signed POST, so a push service, or whoever answers
// for one, could send it on to any address, past the list of push services (PT-201 review).
it('never follows a push service that redirects, and keeps the device', async () => {
  const reached: string[] = [];
  const inside = await listen((request, response) => {
    reached.push(request.url ?? '');
    response.end();
  });
  for (const status of [301, 307, 308]) {
    const push = await listen((_request, response) => {
      response.writeHead(status, { location: `${inside}/internal` }).end();
    });
    const db = await createTestDatabase('sqlite');
    const device = newDevice();
    const target = { ...device.subscription.keys, endpoint: `${push}/send` };
    await db
      .insertInto('pushSubscriptions')
      .values({ id: 's', userId: null, sessionId: null, createdAt: 1, ...target })
      .execute();
    const sender = await loadSender(db, { keys: null, subject: 'mailto:me@example.com' }, 1);
    const message = { title: 'MOB-1: Claude finished', body: '', url: '/p/MOB/1', tag: 't' };
    await expect(deliver({ db, sender, send: fetch, now: 1 }, target, message)).rejects.toThrow();
    expect(await db.selectFrom('pushSubscriptions').selectAll().execute()).toHaveLength(1);
    await db.destroy();
  }
  expect(reached).toEqual([]);
});
