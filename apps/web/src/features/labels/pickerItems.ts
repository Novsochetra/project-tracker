import type { Label } from '@tracker/shared';
import { nextOptionIndex } from './labelMenuKeys';
import { enterChoice } from './pickerLogic';

export type PickerItem =
  | { kind: 'label'; key: string; label: Label }
  | { kind: 'create'; key: 'create'; name: string }
  | { kind: 'manage'; key: 'manage' };

export const labelKey = (id: string): string => `label-${id}`;

export const optionId = (listId: string, key: string): string => `${listId}-${key}`;

export function pickerItems(
  matches: readonly Label[],
  newName: string | null,
  manageable: boolean,
): PickerItem[] {
  const labels = matches.map((label): PickerItem => ({
    kind: 'label',
    key: labelKey(label.id),
    label,
  }));
  const create: PickerItem[] = newName ? [{ kind: 'create', key: 'create', name: newName }] : [];
  const manage: PickerItem[] = manageable ? [{ kind: 'manage', key: 'manage' }] : [];

  return [...labels, ...create, ...manage];
}

// The row Enter acts on before the arrows or the pointer pick one: the label named exactly, or
// Create, so the picker shows what Enter will do.
export function enterKey(
  labels: readonly Label[],
  query: string,
  items: readonly PickerItem[],
): string | null {
  const choice = enterChoice(labels, query);
  if (!choice) return null;

  const key = choice.kind === 'toggle' ? labelKey(choice.id) : 'create';

  return items.some((item) => item.key === key) ? key : null;
}

export type ActiveSource = 'keyboard' | 'pointer' | 'enter';

export interface ActiveItem {
  key: string;
  by: ActiveSource;
}

// A row picked by the arrows or the pointer stays active while it is listed; otherwise Enter's.
export function shownActive(
  items: readonly PickerItem[],
  picked: ActiveItem | null,
  enter: string | null,
): ActiveItem | null {
  if (picked && items.some((item) => item.key === picked.key)) return picked;

  return enter === null ? null : { key: enter, by: 'enter' };
}

export function movedActive(
  arrow: string,
  items: readonly PickerItem[],
  current: ActiveItem | null,
): string | null {
  const index = current ? items.findIndex((item) => item.key === current.key) : -1;
  const next = nextOptionIndex(arrow, index, items.length);

  return next === null ? null : (items[next]?.key ?? null);
}

// The pointer takes the highlight as it moves over a row, and gives it back as it leaves the rows;
// a row the arrows picked keeps it then.
export function pointedActive(current: ActiveItem | null, key: string | null): ActiveItem | null {
  if (key === null) return current?.by === 'pointer' ? null : current;

  if (current?.key === key && current.by === 'pointer') return current;

  return { key, by: 'pointer' };
}
