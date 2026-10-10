import type { TrackerClient } from '@tracker/client';

export type WatchApi = Pick<
  TrackerClient,
  | 'listProjects'
  | 'registerRunner'
  | 'takeNextRun'
  | 'finishRun'
  | 'addRunSteps'
  | 'getRun'
  | 'getTicket'
  | 'applyReport'
  | 'eventsUrl'
>;
