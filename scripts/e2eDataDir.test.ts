import { describe, expect, it } from 'vitest';
import { e2eDataDir, type DataDirHost } from './e2eDataDir';

function fakeHost(env: Record<string, string | undefined> = {}) {
  const exits: (() => void)[] = [];
  const removed: string[] = [];
  const lines: string[] = [];
  const host: DataDirHost = {
    env,
    make: () => '/tmp/tracker-e2e-abc',
    onExit: (listener) => exits.push(listener),
    remove: (dir) => removed.push(dir),
    log: (line) => lines.push(line),
  };
  const exit = () => {
    for (const listener of exits) listener();
  };

  return { host, exit, removed, lines };
}

describe('e2eDataDir', () => {
  it('makes a folder, hands it to the workers and removes it when the run exits', () => {
    const { host, exit, removed } = fakeHost();

    expect(e2eDataDir(host)).toBe('/tmp/tracker-e2e-abc');
    expect(host.env.E2E_DATA_DIR).toBe('/tmp/tracker-e2e-abc');
    expect(removed).toEqual([]);

    exit();
    expect(removed).toEqual(['/tmp/tracker-e2e-abc']);
  });

  it('never removes a folder it was given, and a worker removes nothing', () => {
    const { host, exit, removed } = fakeHost({ E2E_DATA_DIR: '/work/data' });

    expect(e2eDataDir(host)).toBe('/work/data');
    exit();

    expect(removed).toEqual([]);
  });

  it('takes an empty E2E_DATA_DIR as none given, like the clean-run script', () => {
    const { host, exit, removed } = fakeHost({ E2E_DATA_DIR: '' });

    expect(e2eDataDir(host)).toBe('/tmp/tracker-e2e-abc');
    exit();

    expect(removed).toEqual(['/tmp/tracker-e2e-abc']);
  });

  it('keeps the folder with E2E_KEEP=1 and says where it is', () => {
    const { host, exit, removed, lines } = fakeHost({ E2E_KEEP: '1' });

    e2eDataDir(host);
    exit();

    expect(removed).toEqual([]);
    expect(lines).toEqual(['E2E_KEEP=1: kept the data folder at /tmp/tracker-e2e-abc']);
  });

  it('says so instead of throwing when the folder cannot be removed', () => {
    const { host, exit, lines } = fakeHost();
    host.remove = () => {
      throw new Error('EBUSY');
    };

    e2eDataDir(host);

    expect(exit).not.toThrow();
    expect(lines[0]).toContain("Couldn't remove the data folder /tmp/tracker-e2e-abc");
  });
});
