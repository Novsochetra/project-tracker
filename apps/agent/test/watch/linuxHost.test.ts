import type * as Os from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const childProcess = vi.hoisted(() => ({ spawn: vi.fn(), execFileSync: vi.fn() }));
vi.mock('node:child_process', () => childProcess);
vi.mock('node:os', async (original) => ({
  ...(await original<typeof Os>()),
  hostname: () => 'home-server.local',
}));

const { keepMacAwake } = await import('../../src/watch/keepAwake');
const { computerName } = await import('../../src/watch/identity');

// The helper also runs on Linux (a server, Docker), where caffeinate and scutil don't exist.
describe('the helper on Linux', () => {
  const platform = process.platform;
  beforeEach(() => Object.defineProperty(process, 'platform', { value: 'linux' }));
  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: platform });
    vi.clearAllMocks();
  });

  it('starts no caffeinate', () => {
    keepMacAwake(42);
    expect(childProcess.spawn).not.toHaveBeenCalled();
  });

  it('is named after the host, without asking scutil', () => {
    expect(computerName()).toBe('home-server');
    expect(childProcess.execFileSync).not.toHaveBeenCalled();
  });
});
