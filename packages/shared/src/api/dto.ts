import type { Activity } from '../domain/activity';
import type { Attachment } from '../domain/attachment';
import type { Project } from '../domain/project';
import type { Status } from '../domain/status';
import type { Ticket, TicketListItem } from '../domain/ticket';

export interface ProjectDetail {
  project: Project;
  statuses: Status[];
}

export interface ProjectBoard extends ProjectDetail {
  tickets: TicketListItem[];
}

// Each project has its own statuses, so a list across projects brings those of its tickets.
export interface TicketsAcrossProjects {
  tickets: TicketListItem[];
  statuses: Status[];
}

export interface TicketDetail {
  ticket: Ticket;
  project: Project;
  status: Status;
  statuses: Status[];
  activity: Activity[];
  attachments: Attachment[];
}

export interface PromptResult {
  text: string;
  ticketCount: number;
}

export interface ReportPreviewItem {
  key: string | null;
  matched: boolean;
  ticketKey: string | null;
  ticketTitle: string | null;
  fromStatusName: string | null;
  toStatusName: string | null;
}

export interface ReportPreview {
  items: ReportPreviewItem[];
  matchedCount: number;
}

export interface ReportResult {
  updatedTicketKeys: string[];
}

export interface ErrorBody {
  error: { code: string; message: string };
}

// Every tracker has answered an address it has no route for with this 404, and a run or request
// that is gone with another message, so a client newer than its tracker can tell the two apart.
export const UNKNOWN_ROUTE_MESSAGE = 'Nothing was found at this address.';

export interface ServerMeta {
  version: string;
  serverUrl: string;
  repoRoot: string;
  mcpEntry: string;
  cliEntry: string;
  authRequired: boolean;
}

export interface SessionState {
  authRequired: boolean;
  authenticated: boolean;
  // The owner's email, while signed in with the session cookie.
  email?: string;
  // Sign-in is required but nobody has set up the owner account yet (npm run owner:set).
  setupRequired?: boolean;
}
