import type { TrackerClient } from '@tracker/client';

export type WatchApi = Pick<
  TrackerClient,
  | 'listProjects'
  | 'registerRunner'
  | 'takeNextRun'
  | 'finishRun'
  | 'addRunSteps'
  | 'addRunChanges'
  | 'addRunRequest'
  | 'waitForRunRequest'
  | 'cancelRunRequest'
  | 'getRun'
  | 'getTicket'
  | 'applyReport'
  | 'eventsUrl'
  | 'fetchAttachment'
>;
