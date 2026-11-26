import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { SEARCH_LIMIT_DEFAULT, type TicketSearchResults } from '@tracker/shared';
import { queryKeys, useApi, type TrackerQuery } from '../../api';
import { useDebouncedValue } from '../../lib/useDebouncedValue';

export const SEARCH_DEBOUNCE_MS = 150;

// Each word typed would otherwise leave a cached answer behind for as long as the default.
const FORGET_AFTER_MS = 60_000;

export interface TicketSearch {
  query: TrackerQuery<TicketSearchResults>;
  // The text the shown results are for, which trails the field while the person types.
  searched: string;
}

export function useTicketSearch(text: string): TicketSearch {
  const client = useApi();
  const searched = useDebouncedValue(text.trim(), SEARCH_DEBOUNCE_MS);
  const query = useQuery({
    queryKey: queryKeys.search(searched),
    queryFn: ({ signal }) =>
      client.searchTickets({ q: searched, limit: SEARCH_LIMIT_DEFAULT, signal }),
    // Recent tickets aren't results, so they never stand in for a search's.
    placeholderData: (previous, previousQuery) =>
      searched !== '' && previousQuery?.queryKey[1] !== '' ? keepPreviousData(previous) : undefined,
    staleTime: 0,
    gcTime: FORGET_AFTER_MS,
  });
  return { query, searched };
}
