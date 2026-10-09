import { chmodSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fileStore } from '../../src/configFile';

const mode = (path: string): number => statSync(path).mode & 0o777;

// mkdir's mode only applies to a folder it makes, so a project-tracker folder made earlier (by
// hand, or by a dotfiles script) that others could open stayed that way when a token was saved.
describe('saving a token into a config folder others can open', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'tracker-config-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('tightens the folder to 0700 and the file to 0600', () => {
    const folder = join(dir, 'project-tracker');
    const path = join(folder, 'config.json');
    mkdirSync(folder);
    chmodSync(folder, 0o755);
    writeFileSync(path, '{"tokens": {}}');
    chmodSync(path, 0o644);

    fileStore(path).write({ tokens: { 'https://t.example': 'trk_x' } });
    expect(mode(folder)).toBe(0o700);
    expect(mode(path)).toBe(0o600);
  });

  it('leaves a folder TRACKER_CONFIG shares with other files as it is', () => {
    const shared = join(dir, 'dotfiles');
    mkdirSync(shared);
    chmodSync(shared, 0o755);

    fileStore(join(shared, 'tracker.json')).write({ tokens: {} });
    expect(mode(shared)).toBe(0o755);
    expect(mode(join(shared, 'tracker.json'))).toBe(0o600);
  });
});
