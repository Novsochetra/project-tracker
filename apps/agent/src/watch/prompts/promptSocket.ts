import { mkdtempSync, rmSync } from 'node:fs';
import { createServer, type Socket } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deny, type PromptDecision } from './promptCall';

// A Write's call holds the whole file; anything past this is no call of Claude Code's.
const LINE_MAX = 16 * 1024 * 1024;

// Why a wait was stopped: the run ended, or Claude closed the call while the run goes on.
export const RUN_STOPPED = 'run-stopped';
export const CALL_CLOSED = 'call-closed';

export type Answer = (args: unknown, signal: AbortSignal) => Promise<PromptDecision>;

export interface PromptSocket {
  path: string;
  close: () => void;
}

function readLine(socket: Socket): Promise<string> {
  return new Promise((resolve, reject) => {
    let text = '';
    socket.setEncoding('utf8');
    socket.on('data', (chunk: string) => {
      text += chunk;
      const end = text.indexOf('\n');
      if (end >= 0) resolve(text.slice(0, end));
      else if (text.length > LINE_MAX) reject(new Error('The call is too long.'));
    });
    socket.on('end', () => reject(new Error('The call ended early.')));
    socket.on('error', reject);
  });
}

function parsed(line: string): unknown {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

async function serve(socket: Socket, answer: Answer, stopped: AbortSignal): Promise<void> {
  const gone = new AbortController();
  socket.on('close', () => gone.abort(CALL_CLOSED));
  let decision: PromptDecision;
  try {
    decision = await answer(
      parsed(await readLine(socket)),
      AbortSignal.any([stopped, gone.signal]),
    );
  } catch {
    decision = deny('The call could not be read.');
  }
  if (!socket.destroyed) socket.end(`${JSON.stringify(decision)}\n`);
}

// The prompt tool asks the helper rather than the tracker: it needs no token, nothing secret
// goes into Claude's argv, and the helper keeps the run's lifecycle and its own --url and
// --token. mkdtemp makes the folder 0700, so only this user can reach the socket.
export async function openPromptSocket(answer: Answer): Promise<PromptSocket> {
  const dir = mkdtempSync(join(tmpdir(), 'tracker-prompt-'));
  const path = join(dir, 'prompt.sock');
  const stopped = new AbortController();
  const sockets = new Set<Socket>();
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    void serve(socket, answer, stopped.signal);
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(path, resolve);
  });
  return {
    path,
    close: () => {
      stopped.abort(RUN_STOPPED);
      for (const socket of sockets) socket.destroy();
      server.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
