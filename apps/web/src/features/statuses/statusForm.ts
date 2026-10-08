import {
  STATUS_CATEGORY_LABELS,
  STATUS_COLORS,
  findStatusByName,
  type CreateStatusInput,
  type Status,
  type StatusCategory,
  type TicketListItem,
  type UpdateStatusInput,
} from '@tracker/shared';

export interface StatusDraft {
  name: string;
  category: StatusCategory;
  color: string;
}

// Custom statuses are usually work in flight (Blocked, QA); a To do type would let agents claim them.
export const NEW_STATUS_CATEGORY: StatusCategory = 'in_progress';
export const LAST_STATUS_HINT = 'A project needs at least one status.';

const COLOR_NAMES = ['Gray', 'Orange', 'Blue', 'Green', 'Indigo', 'Violet', 'Pink', 'Red', 'Teal'];
const PALETTE: readonly string[] = STATUS_COLORS;

export const sameColor = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();

const paletteIndex = (color: string): number => PALETTE.findIndex((item) => sameColor(item, color));

export const colorName = (color: string): string =>
  COLOR_NAMES[paletteIndex(color)] ?? 'Current color';

export const colorChoices = (current: string): string[] =>
  paletteIndex(current) >= 0 ? [...PALETTE] : [current, ...PALETTE];

export function firstUnusedColor(statuses: readonly Pick<Status, 'color'>[]): string {
  const unused = PALETTE.find(
    (color) => !statuses.some((status) => sameColor(status.color, color)),
  );
  return unused ?? PALETTE[statuses.length % PALETTE.length] ?? STATUS_COLORS[0];
}

export const newDraft = (statuses: readonly Status[]): StatusDraft => ({
  name: '',
  category: NEW_STATUS_CATEGORY,
  color: firstUnusedColor(statuses),
});

export const draftOf = ({ name, category, color }: Status): StatusDraft => ({
  name,
  category,
  color,
});

export type NameIssue = { kind: 'blank' } | { kind: 'taken'; name: string };

export function nameIssue(
  name: string,
  statuses: readonly Status[],
  editingId?: string,
): NameIssue | null {
  if (!name.trim()) return { kind: 'blank' };
  const clash = findStatusByName(statuses, name);
  return clash && clash.id !== editingId ? { kind: 'taken', name: clash.name } : null;
}

export const nameIssueMessage = (issue: NameIssue): string =>
  issue.kind === 'blank'
    ? 'Add a name to save the status.'
    : `A status named “${issue.name}” already exists.`;

export const createInput = (draft: StatusDraft): CreateStatusInput => ({
  name: draft.name.trim(),
  category: draft.category,
  color: draft.color,
});

export function updateInput(status: Status, draft: StatusDraft): UpdateStatusInput {
  const input: UpdateStatusInput = {};
  const name = draft.name.trim();
  if (name !== status.name) input.name = name;
  if (draft.category !== status.category) input.category = draft.category;
  if (!sameColor(draft.color, status.color)) input.color = draft.color;
  return input;
}

// Default statuses are named after their type, so the type only shows when it adds something.
export const categoryHint = (status: Pick<Status, 'name' | 'category'>): string | null => {
  const label = STATUS_CATEGORY_LABELS[status.category];
  return label.toLowerCase() === status.name.trim().toLowerCase() ? null : label;
};

export function ticketCounts(tickets: readonly Pick<TicketListItem, 'statusId'>[]) {
  const counts = new Map<string, number>();
  for (const { statusId } of tickets) counts.set(statusId, (counts.get(statusId) ?? 0) + 1);
  return counts;
}

export const ticketsLabel = (count: number): string => `${count} ticket${count === 1 ? '' : 's'}`;

export const moveTargets = (statuses: readonly Status[], statusId: string): Status[] =>
  statuses.filter((status) => status.id !== statusId);

export const canDeleteStatus = (statuses: readonly Status[]): boolean => statuses.length > 1;

export function deleteMessage(name: string, count: number, target?: Pick<Status, 'name'>): string {
  if (count === 0 || !target) return `Delete “${name}”? This can't be undone.`;
  return `Delete “${name}” and move its ${ticketsLabel(count)} to ${target.name}?`;
}

export function moveInOrder(ids: readonly string[], id: string, delta: number): string[] | null {
  const from = ids.indexOf(id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= ids.length) return null;
  const next = ids.filter((item) => item !== id);
  next.splice(to, 0, id);
  return next;
}

export const sameOrder = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((id, index) => id === b[index]);

export const sameMembers = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((id) => b.includes(id));
