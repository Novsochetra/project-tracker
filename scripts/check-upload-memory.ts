// Starts the API on a spare port, sends it one small upload to load its code, then large videos
// one after another, and reports the server's memory after each:
// npx tsx scripts/check-upload-memory.ts [MB per file, default 95] [files, default 3]
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { once } from 'node:events';
import { createServer, request } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FILE_NAME_HEADER } from '@tracker/shared';

const MB = 1024 * 1024;
// Reading a 95 MB upload whole grew the server by about 600 MB, and kept it. Streamed, nothing is
// kept (after a GC the heap and buffers are back where they were), but the chunks that passed wait
// for the collector: a fresh server's memory rises 40-65 MB over its first uploads and stays there,
// whatever their size or number. A server that read a file whole would fail this.
const ALLOWED_GROWTH_MB = 80;
const SERVER_ROOT = fileURLToPath(new URL('../apps/server', import.meta.url));

const rssMb = (pid: number): number =>
  Number(
    execFileSync('ps', ['-o', 'rss=', '-p', String(pid)])
      .toString()
      .trim(),
  ) / 1024;

async function sparePort(): Promise<number> {
  const probe = createServer().listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const { port } = probe.address() as AddressInfo;
  probe.close();
  return port;
}

async function startServer(dataDir: string): Promise<{ child: ChildProcess; port: number }> {
  const port = await sparePort();
  const child = spawn(process.execPath, ['--import', 'tsx', 'src/main.ts'], {
    cwd: SERVER_ROOT,
    env: {
      ...process.env,
      PORT: String(port),
      HOST: '127.0.0.1',
      DATABASE_URL: join(dataDir, 'tracker.db'),
      UPLOADS_DIR: join(dataDir, 'uploads'),
      WEB_DIST: join(dataDir, 'no-web'),
    },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  return new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('exit', () => reject(new Error('The server stopped before it listened.')));
    child.stdout?.on('data', (chunk: Buffer) => {
      if (chunk.toString().includes('Tracker API on')) resolve({ child, port });
    });
  });
}

function upload(port: number, bytes: number): Promise<number> {
  const chunk = Buffer.alloc(MB, 7);
  return new Promise((resolve, reject) => {
    const req = request({
      host: '127.0.0.1',
      port,
      method: 'POST',
      path: '/api/attachments',
      headers: {
        'content-type': 'video/mp4',
        'content-length': String(bytes),
        [FILE_NAME_HEADER]: 'big.mp4',
      },
    });
    req.on('response', (res) => {
      res.resume();
      res.on('end', () => resolve(res.statusCode ?? 0));
    });
    req.on('error', reject);
    let sent = 0;
    const pump = () => {
      while (sent < bytes) {
        const part = chunk.subarray(0, Math.min(MB, bytes - sent));
        sent += part.byteLength;
        if (!req.write(part)) return void req.once('drain', pump);
      }
      req.end();
    };
    pump();
  });
}

async function peakWhile<T>(pid: number, work: Promise<T>): Promise<{ peak: number; result: T }> {
  let peak = rssMb(pid);
  const sampler = setInterval(() => (peak = Math.max(peak, rssMb(pid))), 50);
  const result = await work;
  clearInterval(sampler);
  return { peak, result };
}

async function main(): Promise<void> {
  const megabytes = Number(process.argv[2] ?? 95);
  const count = Number(process.argv[3] ?? 3);
  const dataDir = mkdtempSync(join(tmpdir(), 'tracker-memory-'));
  const { child, port } = await startServer(dataDir);
  const pid = child.pid ?? 0;
  try {
    await upload(port, MB);
    const before = rssMb(pid);
    process.stdout.write(`Server memory after a 1 MB upload: ${before.toFixed(0)} MB\n`);
    let failed = false;
    for (let round = 1; round <= count; round += 1) {
      const { peak, result } = await peakWhile(pid, upload(port, megabytes * MB));
      const growth = peak - before;
      process.stdout.write(
        `Upload ${round} of ${megabytes} MB answered ${result}: at most ${peak.toFixed(0)} MB ` +
          `(+${growth.toFixed(0)} MB)\n`,
      );
      failed ||= result !== 201 || growth > ALLOWED_GROWTH_MB;
    }
    if (failed) {
      process.stdout.write(`Expected 201s and growth under ${ALLOWED_GROWTH_MB} MB.\n`);
      process.exitCode = 1;
    }
  } finally {
    child.kill();
    rmSync(dataDir, { recursive: true, force: true });
  }
}

await main();
