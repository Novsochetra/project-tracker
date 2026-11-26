import { z } from 'zod';
import type { StatusCategory } from '../domain/status';
import { TICKET_SEARCH_MAX } from '../domain/ticket';

export const SEARCH_LIMIT_MAX = 50;
export const SEARCH_LIMIT_DEFAULT = 30;

export const searchQuery = z.object({
  q: z.string().max(TICKET_SEARCH_MAX).default(''),
  limit: z.coerce.number().int().min(1).max(SEARCH_LIMIT_MAX).default(SEARCH_LIMIT_DEFAULT),
});
export type SearchQuery = z.input<typeof searchQuery>;
export type SearchParams = z.output<typeof searchQuery>;

// "recent": an empty search lists the most recently changed tickets.
export type SearchMatch = 'key' | 'title' | 'description' | 'recent';

export interface TicketSearchHit {
  key: string;
  projectId: string;
  projectKey: string;
  num: number;
  title: string;
  statusId: string;
  statusName: string;
  statusCategory: StatusCategory;
  statusColor: string;
  match: SearchMatch;
  // The part of the description around the match; null unless the description matched.
  snippet: string | null;
  updatedAt: number;
}

export interface TicketSearchResults {
  tickets: TicketSearchHit[];
}
