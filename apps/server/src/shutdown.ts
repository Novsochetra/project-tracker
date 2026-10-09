import type { IncomingMessage, Server } from 'node:http';
import type { Socket } from 'node:net';

// How long requests under way get to finish once the server is told to stop (a deploy replacing
// it, Ctrl-C). Uploads can take an hour, so they are cut at the end like anything else.
export const SHUTDOWN_GRACE_MS = 10_000;
const IDLE_SWEEP_MS = 50;

const isLiveStream = (req: IncomingMessage): boolean =>
  req.method === 'GET' && req.url?.split('?')[0] === '/api/events';

// Live-update streams never end on their own, so a stop closes them at once (browsers reconnect,
// to the next server) instead of waiting out the grace period for them.
export function trackLiveStreams(server: Server): Set<Socket> {
  const sockets = new Set<Socket>();
  server.on('request', (req: IncomingMessage) => {
    if (!isLiveStream(req)) return;
    const { socket } = req;
    sockets.add(socket);
    socket.once('close', () => sockets.delete(socket));
  });
  return sockets;
}

// Takes no new connections, lets requests under way finish for up to graceMs, then cuts the rest.
export async function closeServer(
  server: Server,
  liveStreams: ReadonlySet<Socket>,
  graceMs: number,
): Promise<void> {
  const closed = new Promise<void>((resolve) => server.close(() => resolve()));
  for (const socket of liveStreams) socket.destroy();
  // close() ends only the connections idle at that moment; a kept-alive one whose request finishes
  // later would stay open until its keep-alive timeout.
  const sweep = setInterval(() => server.closeIdleConnections(), IDLE_SWEEP_MS);
  const timer = setTimeout(() => server.closeAllConnections(), graceMs);
  await closed;
  clearInterval(sweep);
  clearTimeout(timer);
}

// The database closes after the server, so requests under way keep their connections: Postgres'
// pool ends once each has given its connection back.
export function stopOnSignals(
  server: Server,
  db: { destroy(): Promise<void> },
  graceMs = SHUTDOWN_GRACE_MS,
): void {
  const liveStreams = trackLiveStreams(server);
  const stop = () =>
    closeServer(server, liveStreams, graceMs)
      .then(() => db.destroy())
      .catch((error: unknown) => console.error('The server did not stop cleanly:', error))
      .finally(() => process.exit(0));
  process.once('SIGINT', () => void stop());
  process.once('SIGTERM', () => void stop());
}
