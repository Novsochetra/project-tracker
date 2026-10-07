import { PRIORITY_ORDER, type Priority } from '../domain/priority';
import type { Status, StatusCategory } from '../domain/status';

interface WorkItem {
  statusId: string;
  priority: Priority;
  rank: number;
  num: number;
}

const categoryOf = (statuses: readonly Status[]) => {
  const byId = new Map(statuses.map((status) => [status.id, status.category]));
  return (statusId: string): StatusCategory | undefined => byId.get(statusId);
};

const byPriorityThenRank = (a: WorkItem, b: WorkItem): number =>
  PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.rank - b.rank || a.num - b.num;

export function pickNextTicket<T extends WorkItem>(
  tickets: readonly T[],
  statuses: readonly Status[],
): T | null {
  const category = categoryOf(statuses);
  const ready = tickets.filter((ticket) => category(ticket.statusId) === 'todo');
  return [...ready].sort(byPriorityThenRank)[0] ?? null;
}

export function workableTickets<T extends WorkItem>(
  tickets: readonly T[],
  statuses: readonly Status[],
): T[] {
  const category = categoryOf(statuses);
  const stage = (ticket: T): number => (category(ticket.statusId) === 'in_progress' ? 0 : 1);
  return tickets
    .filter((ticket) => {
      const value = category(ticket.statusId);
      return value === 'todo' || value === 'in_progress';
    })
    .sort(
      (a, b) =>
        stage(a) - stage(b) ||
        PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
        a.num - b.num,
    );
}
