import type { Status } from '../domain/status';
import { sortStatuses } from './statuses';

// The All tab, or the id of the one status a status tab shows.
export type TicketFilter = string;

export const ALL_TICKETS: TicketFilter = 'all';

export const GROUP_LIMIT = 5;

// A status deleted while its tab was picked leaves its id behind; the list then shows All.
export function resolveFilter(
  statuses: readonly Pick<Status, 'id'>[],
  filter: TicketFilter,
): TicketFilter {
  return statuses.some((status) => status.id === filter) ? filter : ALL_TICKETS;
}

export function visibleStatuses<T extends Status>(
  statuses: readonly T[],
  filter: TicketFilter,
): T[] {
  const sorted = sortStatuses(statuses);
  const picked = sorted.filter((status) => status.id === filter);
  return picked.length > 0 ? picked : sorted;
}

export function matchesSearch(ticket: { title: string; key: string }, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return ticket.title.toLowerCase().includes(q) || ticket.key.toLowerCase().includes(q);
}

export interface FilterTab<T extends Status = Status> {
  value: TicketFilter;
  status: T | null;
  count: number;
}

export function filterTabs<T extends Status>(
  statuses: readonly T[],
  tickets: readonly { statusId: string }[],
): FilterTab<T>[] {
  const counts = new Map<string, number>();
  for (const { statusId } of tickets) counts.set(statusId, (counts.get(statusId) ?? 0) + 1);
  return [
    { value: ALL_TICKETS, status: null, count: tickets.length },
    ...sortStatuses(statuses).map((status) => ({
      value: status.id,
      status,
      count: counts.get(status.id) ?? 0,
    })),
  ];
}

export interface CollapsedGroup<T> {
  shown: T[];
  hiddenCount: number;
  hasToggle: boolean;
}

export function collapseGroup<T>(
  items: readonly T[],
  options: { expanded: boolean; searching: boolean },
): CollapsedGroup<T> {
  const long = items.length > GROUP_LIMIT + 1;
  if (!long || options.searching) return { shown: [...items], hiddenCount: 0, hasToggle: false };
  if (options.expanded) return { shown: [...items], hiddenCount: 0, hasToggle: true };
  return {
    shown: items.slice(0, GROUP_LIMIT),
    hiddenCount: items.length - GROUP_LIMIT,
    hasToggle: true,
  };
}
