import {
  isDoneCategory,
  STATUS_CATEGORIES,
  type Status,
  type StatusCategory,
} from '../domain/status';

export const sortStatuses = <T extends Pick<Status, 'position' | 'createdAt'>>(
  statuses: readonly T[],
): T[] => [...statuses].sort((a, b) => a.position - b.position || a.createdAt - b.createdAt);

const FALLBACKS: Record<StatusCategory, readonly StatusCategory[]> = {
  todo: ['todo'],
  in_progress: ['in_progress', 'todo'],
  in_review: ['in_review', 'reviewed', 'in_progress'],
  reviewed: ['reviewed', 'in_review', 'in_progress'],
  done: ['done'],
};

export function findStatusByCategory<T extends Status>(
  statuses: readonly T[],
  category: StatusCategory,
): T | undefined {
  return sortStatuses(statuses).find((status) => status.category === category);
}

export function resolveStatus<T extends Status>(
  statuses: readonly T[],
  category: StatusCategory,
): T {
  for (const candidate of FALLBACKS[category]) {
    const found = findStatusByCategory(statuses, candidate);
    if (found) return found;
  }
  const sorted = sortStatuses(statuses);
  // Reports and agents must never move a ticket to Done, so the last resort skips done statuses.
  const fallback = sorted.find((status) => !isDoneCategory(status.category)) ?? sorted[0];
  if (!fallback) throw new Error('A project always has at least one status.');
  return fallback;
}

export function findStatusByName<T extends Status>(
  statuses: readonly T[],
  name: string,
): T | undefined {
  const wanted = name.trim().toLowerCase();
  return statuses.find((status) => status.name.toLowerCase() === wanted);
}

const categoryRank = (category: StatusCategory): number => STATUS_CATEGORIES.indexOf(category);

// Once a ticket is reviewed only a person moves it back, so a late report cannot undo an approval.
export const reportMayMove = (from: StatusCategory, to: StatusCategory): boolean =>
  categoryRank(from) < categoryRank('reviewed') || categoryRank(to) > categoryRank(from);
