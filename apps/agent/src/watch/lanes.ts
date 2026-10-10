import { RUN_KINDS } from '@tracker/shared';
import { createRunLoop, type RunLoopDeps, type RunLoopSettings } from './runLoop';

// One run of each kind at a time, so a question is answered while a ticket run works.
export function createLanes(deps: RunLoopDeps, settings: Omit<RunLoopSettings, 'kind'>) {
  const lanes = RUN_KINDS.map((kind) => createRunLoop(deps, { ...settings, kind }));
  return {
    lookForWork: async () => {
      await Promise.all(lanes.map((lane) => lane.lookForWork()));
    },
    cancel: (runId: string) => {
      for (const lane of lanes) lane.cancel(runId);
    },
    stop: async () => {
      await Promise.all(lanes.map((lane) => lane.stop()));
    },
    currentRunIds: () => lanes.flatMap((lane) => lane.currentRunId() ?? []),
  };
}
