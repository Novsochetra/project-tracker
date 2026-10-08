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
  // Download links need the token too, so replies note it when requests carry one.
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
