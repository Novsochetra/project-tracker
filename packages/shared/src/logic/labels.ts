import type { Label } from '../domain/label';
import { sortStatuses } from './statuses';

export const sortLabels = <T extends Pick<Label, 'position' | 'createdAt'>>(labels: readonly T[]) =>
  sortStatuses(labels);

export function findLabelByName<T extends Pick<Label, 'name'>>(
  labels: readonly T[],
  name: string,
): T | undefined {
  const wanted = name.trim().toLowerCase();
  return labels.find((label) => label.name.toLowerCase() === wanted);
}

export function labelsOf<T extends Label>(labels: readonly T[], ids: readonly string[] = []): T[] {
  const wanted = new Set(ids);
  return sortLabels(labels.filter((label) => wanted.has(label.id)));
}

export const hasLabel = (ticket: { labelIds?: readonly string[] }, labelId: string): boolean =>
  ticket.labelIds?.includes(labelId) ?? false;

export const labelNames = (labels: readonly Pick<Label, 'name'>[]): string =>
  labels.map((label) => label.name).join(', ');
