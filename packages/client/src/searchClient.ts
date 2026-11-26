import type { TicketSearchResults } from '@tracker/shared';
import { LabelingClient } from './labeling';

export interface SearchOptions {
  q?: string;
  limit?: number;
  signal?: AbortSignal;
}

// The quick switcher's search (PT-259): ticket keys, titles and descriptions across projects.
export class SearchClient extends LabelingClient {
  searchTickets = ({ q, limit, signal }: SearchOptions = {}) =>
    this.http.request<TicketSearchResults>('GET', '/api/search', {
      query: { q, limit: limit === undefined ? undefined : String(limit) },
      signal,
    });
}
