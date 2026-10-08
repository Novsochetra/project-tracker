import type { Review } from './activity';
import type { Priority } from './priority';

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
