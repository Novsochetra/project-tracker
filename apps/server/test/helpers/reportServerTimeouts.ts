import { Server } from 'node:http';

// Loaded ahead of src/main.ts in a child process (test/regression/slow-upload-timeout): when the
// server main.ts starts would listen, it writes its timeouts instead and the process ends, so a
// test reads the real settings without a port or a five-minute wait.
Server.prototype.listen = function reportTimeouts(this: Server) {
  const { requestTimeout, headersTimeout } = this;
  process.stdout.write(`${JSON.stringify({ requestTimeout, headersTimeout })}\n`);
  process.exit(0);
} as Server['listen'];
