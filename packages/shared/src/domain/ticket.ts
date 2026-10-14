import type { Review } from './activity';
import type { Priority } from './priority';

// Plain numbers as well as in the API's schemas, so the web app reads them without loading zod.
export const TICKET_TITLE_MAX = 300;
export const TICKET_DESCRIPTION_MAX = 50_000;
export const TICKET_ASSIGNEE_MAX = 80;
// One limit for list_tickets' query and the API's `q`, so the tool never sends what the API refuses.
export const TICKET_SEARCH_MAX = 200;

export interface Ticket {
  id: string;
  projectId: string;
  num: number;
  key: string;
  statusId: string;
  rank: number;
  title: string;
  description: string;
  priority: Priority;
  assignee: string;
  due: string;
  // Work only a person at a real phone or device can do, so Run all skips it.
  needsDevice: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface TicketListItem extends Ticket {
  commentCount: number;
  attachmentCount: number;
  lastReview: Review | null;
  // A time, not a flag: a helper that is gone sends no event when its request runs out.
  waitingUntil: number | null;
}

// The answer to a create. A repeat of an earlier create's client id names the files it left out
// because they are gone (an upload that expired, or a file removed from the ticket since).
export interface CreatedTicket extends Ticket {
  leftOutAttachmentIds?: string[];
}
