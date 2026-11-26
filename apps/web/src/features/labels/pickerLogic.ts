import {
  findLabelByName,
  LABEL_NAME_MAX,
  sortLabels,
  STATUS_COLORS,
  TICKET_LABELS_MAX,
  type CreateLabelInput,
  type Label,
} from '@tracker/shared';
import { firstUnusedColor } from '../statuses/statusForm';

export const LIMIT_MESSAGE = `A ticket can have up to ${TICKET_LABELS_MAX} labels.`;

export function matchingLabels(labels: readonly Label[], query: string): Label[] {
  const wanted = query.trim().toLowerCase();
  const sorted = sortLabels(labels);

  return wanted ? sorted.filter((label) => label.name.toLowerCase().includes(wanted)) : sorted;
}

// The name a typed query would create, or null when it is blank or already a label.
export function creatableName(labels: readonly Label[], query: string): string | null {
  const name = query.trim().slice(0, LABEL_NAME_MAX);
  if (!name || findLabelByName(labels, name)) return null;

  return name;
}

export type EnterChoice = { kind: 'toggle'; id: string } | { kind: 'create'; name: string };

// Enter picks the label named exactly, so typing "bug" never makes a second "Bug".
export function enterChoice(labels: readonly Label[], query: string): EnterChoice | null {
  const exact = findLabelByName(labels, query);
  if (exact) return { kind: 'toggle', id: exact.id };
  const name = creatableName(labels, query);

  return name ? { kind: 'create', name } : null;
}

// Gray counts as taken: a label made in passing has no one to pick its color, and a gray chip
// would read as no color at all.
export const newLabelInput = (labels: readonly Label[], name: string): CreateLabelInput => ({
  name,
  color: firstUnusedColor([{ color: STATUS_COLORS[0] }, ...labels]),
});

export const canAdd = (value: readonly string[], id: string): boolean =>
  value.includes(id) || value.length < TICKET_LABELS_MAX;

export const isFull = (value: readonly string[]): boolean => value.length >= TICKET_LABELS_MAX;
