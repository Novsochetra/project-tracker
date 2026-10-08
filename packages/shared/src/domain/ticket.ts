import type { Review } from './activity';
import type { Priority } from './priority';

// Plain numbers as well as in the API's schemas, so the web app reads them without loading zod.
export const TICKET_TITLE_MAX = 300;
export const TICKET_DESCRIPTION_MAX = 50_000;
export const TICKET_ASSIGNEE_MAX = 80;

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
  createdAt: number;
  updatedAt: number;
}

export interface TicketListItem extends Ticket {
  commentCount: number;
  attachmentCount: number;
  lastReview: Review | null;
}
