import { changesFolder, type ChatChangedFile, type RunJob } from '@tracker/shared';
import { runName } from '../runName';
import type { WatchApi } from '../watchApi';
import { changedPaths } from './changedPaths';
import { mergeChatFiles } from './chatFiles';
import { readChatChanges, type GhCheck } from './readChatChanges';
import { headTree } from './repoState';
import type { SendChanges } from './runChanges';
import { snapshotTree } from './snapshot';
import { gitDeadline, startSnapshot, trackingOff, type SnapshotDeps } from './startSnapshot';

export interface ChatChangesDeps extends SnapshotDeps {
  api: Pick<WatchApi, 'addChatChanges'>;
  runnerId: string;
  describe: (error: unknown) => string;
  // Tests only: gh checks its sign-in on GitHub.
  ghCheck?: GhCheck | undefined;
}

interface TurnStart {
  tree: string;
  dirty: ReadonlySet<string>;
}

const NOTHING: SendChanges = () => Promise.resolve();
const SEND_TIMEOUT_MS = 30_000;

// An older tracker sends no files with the question and keeps no chat changes.
const previousOf = ({ run, chatFiles }: RunJob): ChatChangedFile[] | null =>
  run.kind === 'ask' && run.chatId !== null && changesFolder(run.askOptions?.mode)
    ? (chatFiles ?? null)
    : null;

async function startTurn(deps: ChatChangesDeps, job: RunJob): Promise<TurnStart | null> {
  const tree = await startSnapshot(deps, job.run);
  if (!tree) return null;
  const deadline = gitDeadline(deps);
  try {
    const from = await headTree(deps.cwd, deadline);
    const { paths } = await changedPaths(deps.cwd, { from, to: tree }, deadline);
    return { tree, dirty: new Set(paths) };
  } catch {
    deps.log(`${runName(job.run)}: Changes aren't tracked in this run: ${trackingOff(deadline)}.`);
    return null;
  }
}

async function readTurn(deps: ChatChangesDeps, previous: ChatChangedFile[], start: TurnStart) {
  const deadline = gitDeadline(deps);
  try {
    const to = await snapshotTree(deps.cwd, deadline);
    if (!to) throw new Error('No repository.');
    const turn = await changedPaths(deps.cwd, { from: start.tree, to }, deadline);
    const merged = mergeChatFiles(previous, turn.paths, start.dirty);
    if (merged.files.length === 0) return null;
    const input = { ...merged, to, cut: merged.cut || turn.cut };
    return await readChatChanges(deps.cwd, input, deadline, deps.ghCheck);
  } catch {
    throw new Error(trackingOff(deadline));
  }
}

// A snapshot before the message goes to Claude and one after its turn ends: the files the turn
// changed join the chat's, and their diff against the last commit goes to the tracker.
export async function trackChatChanges(deps: ChatChangesDeps, job: RunJob): Promise<SendChanges> {
  const previous = previousOf(job);
  if (!previous) return NOTHING;
  const start = await startTurn(deps, job);
  if (!start) return NOTHING;
  return async (outcome) => {
    if (outcome.status === 'cancelled') return;
    try {
      const body = await readTurn(deps, previous, start);
      if (!body) return;
      await deps.api.addChatChanges(
        job.run.id,
        { runnerId: deps.runnerId, ...body },
        { signal: AbortSignal.timeout(SEND_TIMEOUT_MS) },
      );
    } catch (error) {
      deps.log(`${runName(job.run)}: Couldn't send the changes: ${deps.describe(error)}`);
    }
  };
}
