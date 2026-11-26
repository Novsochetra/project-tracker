import type { Label } from '@tracker/shared';
import { useLayoutEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { canAdd, creatableName, enterChoice, isFull, matchingLabels } from './pickerLogic';
import { nextOptionIndex, toggled } from './labelMenuKeys';
import { useNewLabel } from './useNewLabel';

export interface LabelPickerInput {
  projectKey: string;
  labels: readonly Label[];
  value: readonly string[];
  onChange: (labelIds: string[]) => void;
}

const itemsOf = (root: HTMLElement | null): HTMLElement[] =>
  root ? Array.from(root.querySelectorAll<HTMLElement>('[data-picker-item]')) : [];

// Home and End move the caret while typing, so only the arrows leave the field.
const fieldKeys = new Set(['ArrowDown', 'ArrowUp']);

export function useLabelPicker(
  { projectKey, labels, value, onChange }: LabelPickerInput,
  rootRef: RefObject<HTMLElement | null>,
) {
  const [query, setQuery] = useState('');
  // A label made while a pick saves joins the ticket's newest list, not the one it started from.
  const valueRef = useRef(value);
  useLayoutEffect(() => {
    valueRef.current = value;
  });
  const { create, creating } = useNewLabel(projectKey, labels);
  const full = isFull(value);

  const toggle = (id: string) => {
    if (canAdd(valueRef.current, id)) onChange(toggled(valueRef.current, id));
  };

  // Set before the request, as `creating` turns true only a render later, so a quick double
  // Enter or tap sends one create, not a second one the server refuses as a duplicate.
  const inFlightRef = useRef(false);
  const addNew = async (name: string) => {
    if (inFlightRef.current || isFull(valueRef.current)) return;
    inFlightRef.current = true;
    const label = await create(name).finally(() => {
      inFlightRef.current = false;
    });
    if (!label) return;
    // Text typed while the label was made stays, so a second name is not lost.
    setQuery((current) => (current.trim() === name ? '' : current));
    onChange([...valueRef.current, label.id]);
  };

  const onEnter = () => {
    const choice = enterChoice(labels, query);
    if (!choice) return;
    if (choice.kind === 'create') {
      void addNew(choice.name);
      return;
    }

    toggle(choice.id);
    setQuery('');
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const inField = event.target instanceof HTMLInputElement;
    if (inField && event.key === 'Enter') {
      event.preventDefault();
      onEnter();
      return;
    }

    if (inField && !fieldKeys.has(event.key)) return;
    const items = itemsOf(rootRef.current);
    const index = items.findIndex((item) => item === document.activeElement);
    const next = nextOptionIndex(event.key, index, items.length);
    if (next === null) return;
    event.preventDefault();
    items[next]?.focus();
  };

  return {
    query,
    setQuery,
    matches: matchingLabels(labels, query),
    newName: full ? null : creatableName(labels, query),
    full,
    creating,
    toggle,
    addNew,
    onKeyDown,
  };
}
