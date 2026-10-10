import type { TrackerClient } from '@tracker/client';

export type WatchApi = Pick<
  TrackerClient,
  | 'listProjects'
  | 'registerRunner'
  | 'takeNextRun'
  | 'finishRun'
  | 'addRunSteps'
  | 'addRunRequest'
  | 'waitForRunRequest'
  | 'getRun'
  | 'getTicket'
  | 'applyReport'
  | 'eventsUrl'
>;
