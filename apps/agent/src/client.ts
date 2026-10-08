import { TrackerClient } from '@tracker/client';
import type { Config } from './config';

export type TrackerApi = Pick<
  TrackerClient,
  | 'listProjects'
  | 'getProject'
  | 'listTickets'
  | 'getTicket'
  | 'createTicket'
  | 'updateTicket'
  | 'addComment'
  | 'claimNext'
  | 'claimTicket'
  | 'submitForReview'
  | 'reviewTicket'
  | 'fetchAttachment'
  | 'fetchAttachmentText'
  | 'attachmentFileUrl'
> & {
  /** Set when requests carry TRACKER_TOKEN, which download links then need too. */
  readonly usesToken?: boolean;
};

export const createTrackerClient = (config: Config): TrackerApi =>
  Object.assign(
    new TrackerClient({
      baseUrl: config.url,
      token: config.token,
      actor: { kind: 'agent', name: config.agentName },
    }),
    { usesToken: config.token !== undefined },
  );
