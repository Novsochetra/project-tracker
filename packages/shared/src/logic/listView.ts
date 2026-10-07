import { isDoneCategory, type Status } from '../domain/status';
import { sortStatuses } from './statuses';

export const TICKET_FILTERS = ['all', 'active', 'done'] as const;

export type TicketFilter = (typeof TICKET_FILTERS)[number];

export const GROUP_LIMIT = 5;

export function visibleStatuses<T extends Status>(
  statuses: readonly T[],
  filter: TicketFilter,
): T[] {
  const sorted = sortStatuses(statuses);
  if (filter === 'active') return sorted.filter((status) => !isDoneCategory(status.category));
  if (filter === 'done') return sorted.filter((status) => isDoneCategory(status.category));
  return sorted;
}

export function matchesSearch(ticket: { title: string; key: string }, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return ticket.title.toLowerCase().includes(q) || ticket.key.toLowerCase().includes(q);
}

export interface FilterCounts {
  all: number;
  active: number;
  done: number;
}

export function filterCounts(
  tickets: readonly { statusId: string }[],
  statuses: readonly Status[],
): FilterCounts {
  const doneIds = new Set(statuses.filter((s) => isDoneCategory(s.category)).map((s) => s.id));
  const done = tickets.filter((ticket) => doneIds.has(ticket.statusId)).length;
  return { all: tickets.length, active: tickets.length - done, done };
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
