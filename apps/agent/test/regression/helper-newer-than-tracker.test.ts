import { ApiError } from '@tracker/client';
import { UNKNOWN_ROUTE_MESSAGE } from '@tracker/shared';
import { describe, expect, it, vi } from 'vitest';
import { createAskPerson, type AskPersonDeps } from '../../src/watch/permissionTool/askPerson';
import { RUN_GONE, TRACKER_OUTDATED } from '../../src/watch/permissionTool/trackerRefusal';
import { job, RUNNER } from '../watch/fakeTracker';
import { permissionRequest } from '../watch/permissionTool/requests';

const run = job('r-1', 'MOB-1').run;
const bash = { toolName: 'Bash', input: { command: 'npm test' } };

// What every tracker answers for an address it has no route for (`handleNotFound`), and for a run
// that is gone (`requireRun`).
const noRoute = () => new ApiError(404, 'not_found', UNKNOWN_ROUTE_MESSAGE);
const runGone = () => new ApiError(404, 'not_found', 'That run was not found.');

function askWith(api: Partial<AskPersonDeps['api']>) {
  return createAskPerson({
    api: {
      addRunRequest: () => Promise.resolve(permissionRequest()),
      waitForRunRequest: () => Promise.resolve(permissionRequest({ status: 'cancelled' })),
      cancelRunRequest: () => Promise.resolve(permissionRequest({ status: 'cancelled' })),
      ...api,
    },
    runnerId: RUNNER,
    folder: '/Users/dara/app',
    log: () => undefined,
    describe: (error) => String(error),
    retryDelay: () => 1,
  });
}

const signal = () => new AbortController().signal;

// PT-170: a helper newer than its tracker got 404 for POST /runs/:id/requests, read as "This run
// is gone from the tracker", so every Edit permission was denied with a reason that misled.
describe('regression: a helper newer than its tracker', () => {
  it('says to update the tracker when it has no route for asking', async () => {
    const ask = askWith({ addRunRequest: () => Promise.reject(noRoute()) });
    expect(await ask(run, bash, signal())).toEqual({ behavior: 'deny', message: TRACKER_OUTDATED });
  });

  it('says to update the tracker when it has no route for waiting', async () => {
    const waitForRunRequest = vi.fn(() => Promise.reject(noRoute()));
    const ask = askWith({ waitForRunRequest });
    expect(await ask(run, bash, signal())).toEqual({ behavior: 'deny', message: TRACKER_OUTDATED });
    expect(waitForRunRequest).toHaveBeenCalledTimes(1);
  });

  it('still says a run is gone when the tracker says so', async () => {
    const ask = askWith({ addRunRequest: () => Promise.reject(runGone()) });
    expect(await ask(run, bash, signal())).toEqual({ behavior: 'deny', message: RUN_GONE });
  });
});
