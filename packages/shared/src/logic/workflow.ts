import type { Review } from '../domain/activity';
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

const byPriorityThenRank = (left: WorkItem, right: WorkItem): number =>
  PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority] ||
  left.rank - right.rank ||
  left.num - right.num;

export function pickNextTicket<T extends WorkItem>(
  tickets: readonly T[],
  statuses: readonly Status[],
): T | null {
  const category = categoryOf(statuses);
  const ready = tickets.filter((ticket) => category(ticket.statusId) === 'todo');

  return [...ready].sort(byPriorityThenRank)[0] ?? null;
}

const SENT_BACK_TO: readonly StatusCategory[] = ['todo', 'in_progress'];

// A submit keeps the latest review (changes requested) but moves the ticket to review, which
// ends "sent back".
export const isSentBack = (review: Review | null, category: StatusCategory): boolean =>
  review?.verdict === 'changes_requested' && SENT_BACK_TO.includes(category);
