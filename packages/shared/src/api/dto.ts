import type { Activity } from '../domain/activity';
import type { Attachment } from '../domain/attachment';
import type { Label } from '../domain/label';
import type { Project } from '../domain/project';
import type { Status } from '../domain/status';
import type { Ticket, TicketListItem } from '../domain/ticket';
import type { UserRole } from '../domain/invite';

export interface ProjectDetail {
  project: Project;
  statuses: Status[];
  // Optional, like Ticket.labelIds: trackers from before PT-190 don't send them.
  labels?: Label[];
}

export interface ProjectBoard extends ProjectDetail {
  tickets: TicketListItem[];
}

// Each project has its own statuses, so a list across projects brings those of its tickets.
export interface TicketsAcrossProjects {
  tickets: TicketListItem[];
  statuses: Status[];
  labels?: Label[];
}

export interface TicketDetail {
  ticket: Ticket;
  project: Project;
  status: Status;
  statuses: Status[];
  // The project's labels; the ticket's own are ticket.labelIds.
  labels?: Label[];
  activity: Activity[];
  attachments: Attachment[];
}

export interface ErrorBody {
  error: { code: string; message: string };
}

// Every tracker has answered an address it has no route for with this 404, so a client newer than
// its tracker can tell a route the tracker lacks from a thing that is gone.
export const UNKNOWN_ROUTE_MESSAGE = 'Nothing was found at this address.';

export interface ServerMeta {
  version: string;
  commit: string | null;
  serverUrl: string;
  repoRoot: string;
  mcpEntry: string;
  cliEntry: string;
  authRequired: boolean;
}

export interface SessionState {
  authRequired: boolean;
  authenticated: boolean;
  // The account's, while signed in with the session cookie.
  email?: string;
  name?: string;
  role?: UserRole;
  // Sign-in is required but nobody has set up the owner account yet (npm run owner:set).
  setupRequired?: boolean;
}
