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
>;

export const createTrackerClient = (config: Config): TrackerApi =>
  new TrackerClient({
    baseUrl: config.url,
    token: config.token,
    actor: { kind: 'agent', name: config.agentName },
  });
