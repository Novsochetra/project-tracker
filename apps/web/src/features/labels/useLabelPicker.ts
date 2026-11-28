import type { Label } from '@tracker/shared';
import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { haptic } from '../../gestures/haptics';
import { playSound } from '../../sound';
import { toggled } from './labelMenuKeys';
import { canAdd, creatableName, enterChoice, isFull, matchingLabels } from './pickerLogic';
import {
  enterKey,
  movedActive,
  pickerItems,
  pointedActive,
  shownActive,
  type ActiveItem,
  type PickerItem,
} from './pickerItems';
import { useNewLabel } from './useNewLabel';

export interface LabelPickerInput {
  projectKey: string;
  labels: readonly Label[];
  value: readonly string[];
  onChange: (labelIds: string[]) => void;
}

// A label put on or taken off is a change of state, like a switch flipping (docs/ui-guidelines.md).
function changed(onChange: (labelIds: string[]) => void, next: string[]) {
  onChange(next);
  playSound('tick');
  haptic('selection');
}

function useLabelChanges({ projectKey, labels, value, onChange }: LabelPickerInput) {
  // A label made while a pick saves joins the ticket's newest list, not the one it started from.
  const valueRef = useRef(value);
  useLayoutEffect(() => {
    valueRef.current = value;
  });
  const { create, creating } = useNewLabel(projectKey, labels);

  const toggle = (id: string) => {
    if (canAdd(valueRef.current, id)) changed(onChange, toggled(valueRef.current, id));
  };

  // Set before the request, as `creating` turns true only a render later, so a quick double
  // Enter or tap sends one create, not a second one the server refuses as a duplicate.
  const inFlightRef = useRef(false);
  const addNew = async (name: string): Promise<boolean> => {
    if (inFlightRef.current || isFull(valueRef.current)) return false;

    inFlightRef.current = true;
    const label = await create(name).finally(() => {
      inFlightRef.current = false;
    });
    if (!label) return false;

    changed(onChange, [...valueRef.current, label.id]);

    return true;
  };

  return { toggle, addNew, creating };
}

export function useLabelPicker(input: LabelPickerInput, onManage: (() => void) | undefined) {
  const { labels, value } = input;
  const [query, setTypedQuery] = useState('');
  const [picked, setPicked] = useState<ActiveItem | null>(null);
  const { toggle, addNew, creating } = useLabelChanges(input);

  const full = isFull(value);
  const newName = full ? null : creatableName(labels, query);
  // Edit labels only once there is a label to edit; before, the empty state says what to do.
  const manageable = onManage !== undefined && labels.length > 0;
  const items = pickerItems(matchingLabels(labels, query), newName, manageable);
  const active = shownActive(items, picked, enterKey(labels, query, items));

  const setQuery = (next: string) => {
    setTypedQuery(next);
    setPicked(null);
  };

  const create = async (name: string) => {
    // Text typed while the label was made stays, so a second name is not lost.
    if (await addNew(name)) setTypedQuery((current) => (current.trim() === name ? '' : current));
  };

  const activate = (item: PickerItem) => {
    if (item.kind === 'label') toggle(item.label.id);
    else if (item.kind === 'create') void create(item.name);
    else onManage?.();
  };

  // Enter picks the label named exactly, or makes the typed one, unless a row was picked.
  const onEnter = () => {
    const choice = enterChoice(labels, query);
    if (!choice) return;

    if (choice.kind === 'create') {
      void create(choice.name);
      return;
    }

    toggle(choice.id);
    setQuery('');
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      const chosen = active?.by === 'enter' ? null : items.find((item) => item.key === active?.key);
      if (chosen) activate(chosen);
      else onEnter();

      return;
    }

    // Home and End move the caret in the field, so only the arrows move between the rows.
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;

    event.preventDefault();
    const key = movedActive(event.key, items, active);
    setPicked(key === null ? null : { key, by: 'keyboard' });
  };

  const point = (key: string | null) => setPicked((current) => pointedActive(current, key));

  return { query, setQuery, items, active, full, creating, activate, point, onKeyDown };
}
