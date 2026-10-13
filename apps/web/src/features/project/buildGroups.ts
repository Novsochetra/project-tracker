import {
  byRank,
  GROUP_LIMIT,
  hasLabel,
  matchesSearch,
  sortStatuses,
  visibleStatuses,
  type Status,
  type TicketFilter,
  type TicketListItem,
} from '@tracker/shared';

export interface TicketGroupData {
  status: Status;
  tickets: TicketListItem[];
}

export interface ColumnsInput {
  statuses: readonly Status[];
  tickets: readonly TicketListItem[];
  filter: TicketFilter;
  query: string;
  // Resolved with pickedLabel first, so a deleted label's id never empties the list.
  label?: string | null | undefined;
}

export interface GroupsInput extends ColumnsInput {
  dragging: boolean;
}

export function buildColumns({
  statuses,
  tickets,
  filter,
  query,
  label,
}: ColumnsInput): TicketGroupData[] {
  const matching = tickets.filter(
    (ticket) => matchesSearch(ticket, query) && (!label || hasLabel(ticket, label)),
  );
  return visibleStatuses(statuses, filter).map((status) => ({
    status,
    tickets: matching.filter((ticket) => ticket.statusId === status.id).sort(byRank),
  }));
}

export function buildGroups({ dragging, ...input }: GroupsInput): TicketGroupData[] {
  return buildColumns(input).filter((group) => dragging || group.tickets.length > 0);
}

export function nextStatus(statuses: readonly Status[], statusId: string): Status | null {
  const ordered = sortStatuses(statuses);
  const index = ordered.findIndex((status) => status.id === statusId);
  return index < 0 ? null : (ordered[index + 1] ?? null);
}

const GROUP_RISE_MS = 40;
const ROW_RISE_MS = 18;
const MAX_STAGGER = 12;

export const groupRiseDelay = (index: number): number =>
  Math.min(index, MAX_STAGGER) * GROUP_RISE_MS;

export function revealedRowDelay(index: number, groupSize: number): number | null {
  if (groupSize <= GROUP_LIMIT + 1 || index < GROUP_LIMIT) return null;
  return Math.min(index - GROUP_LIMIT, MAX_STAGGER) * ROW_RISE_MS;
}
