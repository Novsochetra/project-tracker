import { describe, expect, it } from 'vitest';
import { lastExitFrom, pidFrom } from '../../../src/watch/autostart/jobState';

const running =
  'gui/501/com.x = {\n\tstate = running\n\tpid = 904\n\tlast exit code = (never exited)\n}';
const stopped = 'gui/501/com.x = {\n\tstate = not running\n\tlast exit code = 1\n}';

describe("launchctl print's answer", () => {
  it('gives the process id of a running job, and the last exit code', () => {
    expect(pidFrom(running)).toBe(904);
    expect(pidFrom(stopped)).toBeUndefined();
    expect(pidFrom(undefined)).toBeUndefined();
    expect(lastExitFrom(stopped)).toBe('1');
    expect(lastExitFrom(undefined)).toBeUndefined();
  });
});
