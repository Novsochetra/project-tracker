import {
  findLabelByName,
  type CreateLabelInput,
  type Label,
  type TicketListItem,
  type UpdateLabelInput,
} from '@tracker/shared';
import { firstUnusedColor, sameColor } from '../statuses/statusForm';

export interface LabelDraft {
  name: string;
  color: string;
  template: string;
  instructions: string;
}

export const LABELS_HELP =
  'Labels sort tickets by kind. A label can start a new ticket’s description and tell Claude more.';

export const newDraft = (labels: readonly Label[]): LabelDraft => ({
  name: '',
  color: firstUnusedColor(labels),
  template: '',
  instructions: '',
});

export const draftOf = ({ name, color, template, instructions }: Label): LabelDraft => ({
  name,
  color,
  template,
  instructions,
});

export const draftChanged = (initial: LabelDraft, draft: LabelDraft): boolean =>
  draft.name.trim() !== initial.name.trim() ||
  !sameColor(draft.color, initial.color) ||
  draft.template !== initial.template ||
  draft.instructions.trim() !== initial.instructions.trim();

export type NameIssue = { kind: 'blank' } | { kind: 'taken'; name: string };

export function nameIssue(
  name: string,
  labels: readonly Label[],
  editingId?: string,
): NameIssue | null {
  if (!name.trim()) return { kind: 'blank' };
  const clash = findLabelByName(labels, name);
  return clash && clash.id !== editingId ? { kind: 'taken', name: clash.name } : null;
}

export const nameIssueMessage = (issue: NameIssue): string =>
  issue.kind === 'blank'
    ? 'Add a name to save the label.'
    : `A label named “${issue.name}” already exists.`;

export const createInput = (draft: LabelDraft): CreateLabelInput => ({
  name: draft.name.trim(),
  color: draft.color,
  template: draft.template,
  instructions: draft.instructions.trim(),
});

export function updateInput(label: Label, draft: LabelDraft): UpdateLabelInput {
  const input: UpdateLabelInput = {};
  const name = draft.name.trim();
  if (name !== label.name) input.name = name;
  if (!sameColor(draft.color, label.color)) input.color = draft.color;
  if (draft.template !== label.template) input.template = draft.template;
  const instructions = draft.instructions.trim();
  if (instructions !== label.instructions) input.instructions = instructions;
  return input;
}

export function labelCounts(tickets: readonly Pick<TicketListItem, 'labelIds'>[]) {
  const counts = new Map<string, number>();
  for (const { labelIds = [] } of tickets) {
    for (const id of labelIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

export function deleteMessage(name: string, count: number): string {
  if (count === 0) return `Delete “${name}”? This can't be undone.`;
  const tickets = `${count} ticket${count === 1 ? '' : 's'}`;
  return `Delete “${name}” and take it off ${tickets}?`;
}
