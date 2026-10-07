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

export interface ServerMeta {
  version: string;
  repoRoot: string;
  mcpEntry: string;
  cliEntry: string;
  authRequired: boolean;
}

export interface SessionState {
  authRequired: boolean;
  authenticated: boolean;
}
