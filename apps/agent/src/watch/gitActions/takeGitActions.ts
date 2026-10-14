import { ApiError } from '@tracker/client';
import { UNKNOWN_ROUTE_MESSAGE } from '@tracker/shared';
import type { WatchApi } from '../watchApi';
import { runGitAction, type GitActionDeps } from './runGitAction';

export interface TakeGitActionsDeps extends GitActionDeps {
  api: Pick<WatchApi, 'takeGitAction' | 'finishGitAction'>;
  describe: (error: unknown) => string;
}

// A tracker from before chat commits has nothing to hand out, now or later.
const isOlderTracker = (error: unknown) =>
  error instanceof ApiError && error.status === 404 && error.message === UNKNOWN_ROUTE_MESSAGE;

// Between the ticket lane's runs, so no Claude changes the folder while git commits in it.
export function createGitActions(deps: TakeGitActionsDeps) {
  let older = false;
  return async function takeGitActions(): Promise<void> {
    if (older) return;
    try {
      for (;;) {
        const job = await deps.api.takeGitAction(deps.runnerId);
        if (!job) return;
        await runGitAction(deps, job);
      }
    } catch (error) {
      older = isOlderTracker(error);
      if (older) return;
      deps.log(`Couldn't finish a commit or pull request: ${deps.describe(error)}`);
    }
  };
}
