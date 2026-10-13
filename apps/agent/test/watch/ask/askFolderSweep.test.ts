import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { sweepAskFolders } from '../../../src/watch/ask/askFolderSweep';

const NOW = Date.UTC(2026, 9, 13, 12);
const DAY = 24 * 60 * 60 * 1000;

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'sweep-root-'));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

function folder(name: string, ageMs: number): string {
  const path = join(root, name);
  mkdirSync(path);
  writeFileSync(join(path, 'board.jpg'), 'x');
  const at = (NOW - ageMs) / 1000;
  utimesSync(path, at, at);
  return path;
}

describe('sweepAskFolders', () => {
  it('removes the question folders older than a day that a killed helper left', async () => {
    const old = folder('tracker-ask-old', 2 * DAY);
    const fresh = folder('tracker-ask-fresh', DAY / 2);
    expect(await sweepAskFolders({ root, now: NOW })).toEqual([old]);
    expect(existsSync(old)).toBe(false);
    expect(existsSync(fresh)).toBe(true);
  });

  it('leaves anything without its prefix, a file and a link alone, whatever their age', async () => {
    const other = folder('tracker-prompt-old', 2 * DAY);
    const file = join(root, 'tracker-ask-file');
    writeFileSync(file, 'x');
    const away = folder('elsewhere', 2 * DAY);
    const link = join(root, 'tracker-ask-link');
    symlinkSync(away, link);
    const at = (NOW - 2 * DAY) / 1000;
    utimesSync(file, at, at);
    expect(await sweepAskFolders({ root, now: NOW })).toEqual([]);
    for (const path of [other, file, away, link]) expect(existsSync(path)).toBe(true);
  });

  it('does nothing when the temp folder cannot be read', async () => {
    expect(await sweepAskFolders({ root: join(root, 'missing'), now: NOW })).toEqual([]);
  });
});
