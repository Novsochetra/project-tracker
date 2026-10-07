import type { Status, StatusCategory } from '../domain/status';

export const sortStatuses = <T extends Pick<Status, 'position' | 'createdAt'>>(
  statuses: readonly T[],
): T[] => [...statuses].sort((a, b) => a.position - b.position || a.createdAt - b.createdAt);

const FALLBACKS: Record<StatusCategory, readonly StatusCategory[]> = {
  todo: ['todo'],
  in_progress: ['in_progress', 'todo'],
  in_review: ['in_review', 'reviewed', 'in_progress'],
  reviewed: ['reviewed', 'in_review', 'done'],
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
  const first = sortStatuses(statuses)[0];
  if (!first) throw new Error('A project always has at least one status.');
  return first;
}

export function findStatusByName<T extends Status>(
  statuses: readonly T[],
  name: string,
): T | undefined {
  const wanted = name.trim().toLowerCase();
  return statuses.find((status) => status.name.toLowerCase() === wanted);
}
