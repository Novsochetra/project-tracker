import { afterEach, describe, expect, it, vi } from 'vitest';

const execFileSync = vi.hoisted(() => vi.fn());
vi.mock('node:child_process', () => ({ execFileSync }));

const { uninstallAgent } = await import('../../../src/watch/autostart/launchd');

const LABEL = 'com.project-tracker.watch.test-not-there';
const calls = () => execFileSync.mock.calls.map(([, args]) => (args as string[])[0]);

// launchctl's code for "not loaded" differs between macOS versions (3 or 113), so bootout is only
// asked for a job that print finds.
describe('launchd', () => {
  afterEach(() => execFileSync.mockReset());

  it('leaves out bootout when launchctl does not know the job', () => {
    execFileSync.mockImplementation(() => {
      throw Object.assign(new Error('exit 113'), { status: 113 });
    });
    expect(uninstallAgent(LABEL)).toBe(false);
    expect(calls()).toEqual(['print']);
  });

  it('boots out a loaded job, and says so when that fails', () => {
    execFileSync.mockReturnValueOnce('state = running\n\tpid = 42\n');
    expect(uninstallAgent(LABEL)).toBe(false);
    expect(calls()).toEqual(['print', 'bootout']);

    execFileSync.mockReturnValueOnce('pid = 42').mockImplementationOnce(() => {
      throw Object.assign(new Error('x'), { stderr: 'Boot-out failed: 5: Input/output error' });
    });
    expect(() => uninstallAgent(LABEL)).toThrow(
      "launchctl couldn't stop it: Boot-out failed: 5: Input/output error",
    );
  });
});
