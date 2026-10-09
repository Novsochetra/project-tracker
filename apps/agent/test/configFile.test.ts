import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configPath, fileStore } from '../src/configFile';

describe('configPath', () => {
  it('lives in ~/.config/project-tracker unless XDG_CONFIG_HOME or TRACKER_CONFIG says otherwise', () => {
    expect(configPath({}, '/home/dara')).toBe('/home/dara/.config/project-tracker/config.json');
    expect(configPath({ XDG_CONFIG_HOME: '/cfg' }, '/home/dara')).toBe(
      '/cfg/project-tracker/config.json',
    );
    expect(configPath({ TRACKER_CONFIG: '/tmp/t.json', XDG_CONFIG_HOME: '/cfg' }, '/h')).toBe(
      '/tmp/t.json',
    );
    expect(configPath({ TRACKER_CONFIG: ' ', XDG_CONFIG_HOME: '' }, '/h')).toBe(
      '/h/.config/project-tracker/config.json',
    );
  });
});

describe('fileStore', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'tracker-config-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('reads nothing saved when there is no file yet', () => {
    expect(fileStore(join(dir, 'none', 'config.json')).read()).toEqual({ tokens: {} });
  });

  it('writes a file only its owner can read, in a folder only its owner can open', () => {
    const path = join(dir, 'project-tracker', 'config.json');
    const store = fileStore(path);
    const config = { url: 'https://t.example', tokens: { 'https://t.example': 'trk_x' } };
    store.write(config);
    expect(store.read()).toEqual(config);
    expect(statSync(path).mode & 0o777).toBe(0o600);
    expect(statSync(join(dir, 'project-tracker')).mode & 0o777).toBe(0o700);
    expect(readFileSync(path, 'utf8').endsWith('}\n')).toBe(true);
  });

  it('tightens a file that others could read when it writes it again', () => {
    const path = join(dir, 'config.json');
    writeFileSync(path, '{}', { mode: 0o644 });
    fileStore(path).write({ tokens: { 'https://t.example': 'trk_x' } });
    expect(statSync(path).mode & 0o777).toBe(0o600);
  });

  it('refuses a broken file with a clear message', () => {
    const path = join(dir, 'config.json');
    writeFileSync(path, 'nope');
    expect(() => fileStore(path).read()).toThrow(`${path} is not valid JSON.`);
  });
});
