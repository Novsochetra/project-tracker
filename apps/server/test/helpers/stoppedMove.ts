import { once } from 'node:events';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { createServer, type Socket } from 'node:net';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { onTestFinished } from 'vitest';
import { writeMoveSource } from './dataMove';
import { OFFLINE_S3_ENV, startMoveCli, type CliResult } from './moveCli';

// Never answering keeps the move waiting with its copy open, so the signal lands mid-move.
async function silentPostgres(): Promise<string> {
  const sockets: Socket[] = [];
  const server = createServer((socket) => sockets.push(socket));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  onTestFinished(async () => {
    for (const socket of sockets) socket.destroy();
    server.close();
    await once(server, 'close');
  });
  return `postgres://mover:s3cret-pw@127.0.0.1:${(server.address() as AddressInfo).port}/railway`;
}

async function until(check: () => Promise<boolean>, what: string): Promise<void> {
  const deadline = Date.now() + 15_000;
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${what}`);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

const copiesIn = async (dir: string) =>
  (await readdir(dir)).filter((name) => name.startsWith('tracker-move-'));

export interface StoppedMove {
  result: CliResult;
  copiesLeft: string[];
}

// Signalled once the plan is out: by then the copy is open and the move waits on the target.
export async function stopMoveWith(signal: NodeJS.Signals): Promise<StoppedMove> {
  const source = await writeMoveSource();
  const temp = await mkdtemp(join(tmpdir(), 'move-tmpdir-'));
  onTestFinished(() => rm(temp, { recursive: true, force: true }));
  const run = startMoveCli(['--from', source.file, '--uploads', source.uploads], {
    ...OFFLINE_S3_ENV,
    DATABASE_URL: await silentPostgres(),
    TMPDIR: temp,
  });
  onTestFinished(() => void run.child.kill('SIGKILL'));

  await until(async () => (await copiesIn(temp)).length > 0, 'the copy');
  await until(() => Promise.resolve(run.stdout().includes('To copy:')), 'the plan');
  run.child.kill(signal);
  const result = await run.done;
  return { result, copiesLeft: await copiesIn(temp) };
}
