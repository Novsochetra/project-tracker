import { Server } from 'node:http';

// Loaded ahead of src/main.ts in a child process: the server listens on a free port instead of
// PORT, so a test can start the real main.ts next to anything else running.
const listen = Server.prototype.listen;
Server.prototype.listen = function onAnyPort(this: Server, ...args: unknown[]) {
  return listen.apply(this, [0, ...args.slice(1)] as Parameters<Server['listen']>);
} as Server['listen'];
