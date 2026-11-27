import { spawn, spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const SCRIPT = resolve(import.meta.dirname, 'e2e-clean.sh');

// `npm ci` in the copy puts a Playwright there that passes, fails, or waits to be stopped, and
// says where it ran. Like Playwright, it is a Node process that ends on SIGINT.
const FAKE_PLAYWRIGHT = `#!/usr/bin/env node
const { existsSync, writeFileSync } = require('node:fs');
const { E2E_DATA_DIR: data, FAKE_MARKER: marker, FAKE_PLAYWRIGHT: outcome } = process.env;
writeFileSync(marker + '.where', process.cwd() + ' ' + data);
if (!existsSync(data)) process.exit(9);
if (outcome !== 'wait') process.exit(outcome === 'pass' ? 0 : 1);
process.on('SIGINT', () => {
  writeFileSync(marker + '.sigint', '');
  process.exit(130);
});
writeFileSync(marker, String(process.pid));
setTimeout(() => process.exit(0), 30000);
`;

const FAKE_NPM = `#!/usr/bin/env bash
mkdir -p node_modules/.bin
cat > node_modules/.bin/playwright <<'STUB'
${FAKE_PLAYWRIGHT}STUB
chmod +x node_modules/.bin/playwright
`;

interface Sandbox {
  root: string;
  repo: string;
  temp: string;
  marker: string;
  env: NodeJS.ProcessEnv;
}

function makeSandbox(): Sandbox {
  const root = mkdtempSync(join(tmpdir(), 'e2e-clean-test-'));
  const repo = join(root, 'repo');
  const temp = join(root, 'tmp');
  const bin = join(root, 'bin');
  for (const dir of [repo, temp, bin]) mkdirSync(dir);
  writeFileSync(join(bin, 'npm'), FAKE_NPM);
  chmodSync(join(bin, 'npm'), 0o755);

  writeFileSync(join(repo, 'package.json'), '{}\n');
  const git = (...args: string[]) => spawnSync('git', args, { cwd: repo, stdio: 'ignore' });
  git('init', '-q');
  git('add', '.');
  const identity = ['-c', 'user.name=Test', '-c', 'user.email=test@example.com'];
  const commit = git(...identity, '-c', 'commit.gpgsign=false', 'commit', '-qm', 'init');
  expect(commit.status).toBe(0);

  const marker = join(root, 'marker');
  const { E2E_DATA_DIR: _data, E2E_KEEP: _keep, ...outer } = process.env;
  const env = { ...outer, PATH: `${bin}:${outer.PATH}`, TMPDIR: temp, FAKE_MARKER: marker };

  return { root, repo, temp, marker, env };
}

function runScript(box: Sandbox, env: NodeJS.ProcessEnv) {
  const child = spawn('bash', [SCRIPT], {
    cwd: box.repo,
    env: { ...box.env, ...env },
    detached: true,
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let stderr = '';
  child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
  const exit = new Promise<{ code: number | null; stderr: string }>((done) => {
    child.on('close', (code) => done({ code, stderr }));
  });

  return { child, exit };
}

async function waitFor(check: () => boolean): Promise<void> {
  for (let tries = 0; tries < 200 && !check(); tries++) {
    await new Promise((done) => setTimeout(done, 50));
  }

  expect(check()).toBe(true);
}

function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

describe('e2e-clean.sh', { timeout: 20_000 }, () => {
  let box: Sandbox;

  beforeEach(() => {
    box = makeSandbox();
  });

  afterEach(() => {
    // A signal test that failed before its kill leaves the waiting Playwright running.
    const waiting = existsSync(box.marker) ? Number(readFileSync(box.marker, 'utf8')) : 0;
    if (waiting && isRunning(waiting)) process.kill(waiting, 'SIGKILL');
    rmSync(box.root, { recursive: true, force: true });
  });

  it.each([
    ['passes', 'pass', 0],
    ['fails', 'fail', 1],
  ])('leaves no folder behind when Playwright %s', async (_, outcome, code) => {
    const result = await runScript(box, { FAKE_PLAYWRIGHT: outcome }).exit;

    expect(result.code).toBe(code);
    expect(result.stderr.includes('E2E_KEEP=1 keeps them')).toBe(code !== 0);
    const [where, data] = readFileSync(`${box.marker}.where`, 'utf8').trim().split(' ');
    expect(where?.startsWith(join(box.temp, 'tracker-e2e-'))).toBe(true);
    expect(data).toBe(join(where ?? '', 'e2e-data'));
    expect(readdirSync(box.temp)).toEqual([]);
  });

  it.each([
    ['SIGTERM', 143, false],
    ['SIGINT', 130, true],
    ['SIGHUP', 129, false],
  ] as const)('stops Playwright and cleans up on %s', async (signal, code, toGroup) => {
    const { child, exit } = runScript(box, { FAKE_PLAYWRIGHT: 'wait' });
    await waitFor(() => existsSync(box.marker) && readFileSync(box.marker, 'utf8').trim() !== '');
    const playwright = Number(readFileSync(box.marker, 'utf8'));

    // Ctrl-C reaches the whole process group; a SIGTERM usually only the script.
    process.kill(toGroup ? -(child.pid ?? 0) : (child.pid ?? 0), signal);

    expect((await exit).code).toBe(code);
    expect(isRunning(playwright)).toBe(false);
    expect(existsSync(`${box.marker}.sigint`)).toBe(true);
    expect(readdirSync(box.temp)).toEqual([]);
  });

  it('keeps the copy with E2E_KEEP=1 and says where it is', async () => {
    const result = await runScript(box, { FAKE_PLAYWRIGHT: 'fail', E2E_KEEP: '1' }).exit;

    const kept = readdirSync(box.temp);
    expect(result.code).toBe(1);
    expect(kept).toHaveLength(1);
    expect(result.stderr).toContain(join(box.temp, kept[0] ?? ''));
  });

  it('never deletes a data folder it was given', async () => {
    const given = join(box.root, 'data');
    mkdirSync(given);

    await runScript(box, { FAKE_PLAYWRIGHT: 'pass', E2E_DATA_DIR: given }).exit;

    expect(existsSync(given)).toBe(true);
    expect(readdirSync(box.temp)).toEqual([]);
  });
});
