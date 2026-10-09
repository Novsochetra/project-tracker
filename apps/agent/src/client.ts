import { TrackerClient } from '@tracker/client';
import type { Config, TokenSource } from './config';

export type TrackerApi = Pick<
  TrackerClient,
  | 'getSession'
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
  // For error messages: which tracker refused, and which token it refused.
  readonly trackerUrl?: string;
  readonly tokenSource?: TokenSource | undefined;
};

export const createTrackerClient = (config: Config): TrackerApi =>
  Object.assign(
    new TrackerClient({
      baseUrl: config.url,
      token: config.token,
      actor: { kind: 'agent', name: config.agentName },
    }),
    {
      usesToken: config.token !== undefined,
      trackerUrl: config.url,
      tokenSource: config.tokenSource,
    },
  );
