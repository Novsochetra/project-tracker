import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { check } from '../../src/watch/autostart/check';
import { memoryStore } from '../memoryStore';

// Reviewer 143: --check in a folder with nothing installed printed plutil's "couldn't be opened
// because there is no such file" error before its own lines.
describe('regression: --check where nothing is installed', () => {
  afterEach(() => vi.restoreAllMocks());

  it('prints only its own lines', async () => {
    const stderr = vi.spyOn(process.stderr, 'write');
    const lines: string[] = [];
    await check(
      { json: false, help: false, version: false },
      {
        env: {},
        store: memoryStore(),
        cwd: mkdtempSync(join(tmpdir(), 'nothing-installed-')),
        stdout: (text) => lines.push(text),
        write: () => undefined,
        untilStopped: () => new Promise(() => undefined),
      },
    );
    expect(stderr).not.toHaveBeenCalled();
    expect(lines.join('\n')).toContain('Installed: no.');
  });
});
