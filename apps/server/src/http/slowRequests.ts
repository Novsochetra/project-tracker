import type { IncomingMessage, Server, ServerResponse } from 'node:http';

// Node's own default for a whole request to arrive.
export const REQUEST_TIMEOUT_MS = 5 * 60 * 1000;

// What Node writes when its requestTimeout ends a request.
const TIMEOUT_ANSWER = 'HTTP/1.1 408 Request Timeout\r\nConnection: close\r\n\r\n';

export const isUploadRequest = (req: IncomingMessage): boolean =>
  req.method === 'POST' && req.url?.split('?')[0] === '/api/attachments';

function endRequest(req: IncomingMessage, res: ServerResponse): void {
  if (!res.headersSent && req.socket.writable) req.socket.write(TIMEOUT_ANSWER);
  req.socket.destroy();
}

// Node's requestTimeout is one value for the whole server, and uploads need an hour. This ends any
// other request whose body is still arriving after timeoutMs the way Node does, so a client can't
// hold a connection for the hour by sending a small body slowly. The timer runs until the body has
// arrived, not until the answer is sent: a GET or HEAD is answered without reading its body, and
// its connection stays open while the rest of that body arrives.
export function endSlowRequests(
  server: Server,
  timeoutMs: number,
  exempt: (req: IncomingMessage) => boolean,
): void {
  server.on('request', (req: IncomingMessage, res: ServerResponse) => {
    if (exempt(req)) return;
    const { socket } = req;
    const stop = () => {
      clearTimeout(timer);
      req.off('end', stop);
      socket.off('close', stop);
    };
    const timer = setTimeout(() => {
      stop();
      if (!req.complete) endRequest(req, res);
    }, timeoutMs);
    req.once('end', stop);
    // A kept-alive socket serves many requests, so each one removes its listener when it stops.
    socket.once('close', stop);
  });
}
