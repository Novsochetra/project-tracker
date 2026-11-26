import {
  formatTicketKey,
  parseKeyQuery,
  searchMatchOf,
  searchSnippet,
  searchTerms,
  searchWords,
  type KeyQuery,
  type SearchParams,
  type TicketSearchHit,
  type TicketSearchResults,
} from '@tracker/shared';
import { searchTicketRows, type TicketSearchRow } from '../repositories/ticketSearch';
import type { UserContext } from './context';

const isKeyHit = (row: TicketSearchRow, key: KeyQuery | null): boolean =>
  key !== null &&
  row.num === key.num &&
  (key.projectKey === null || row.projectKey.toUpperCase() === key.projectKey);

function toHit(row: TicketSearchRow, terms: string[], key: KeyQuery | null): TicketSearchHit {
  const { id: _id, description, ...rest } = row;
  const match = searchMatchOf(row.title, terms, isKeyHit(row, key));
  return {
    ...rest,
    key: formatTicketKey(row.projectKey, row.num),
    match,
    snippet: match === 'description' ? searchSnippet(description, terms) : null,
  };
}

export async function searchTickets(
  ctx: UserContext,
  query: SearchParams,
): Promise<TicketSearchResults> {
  const terms = searchTerms(query.q);
  const key = parseKeyQuery(query.q);
  const words = searchWords(query.q);
  const rows = await searchTicketRows(ctx.db, ctx.scope, { words, key, limit: query.limit });
  return { tickets: rows.map((row) => toHit(row, terms, key)) };
}
