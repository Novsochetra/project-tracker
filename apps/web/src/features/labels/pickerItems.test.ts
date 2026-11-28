import type { Label } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import {
  enterKey,
  labelKey,
  movedActive,
  pickerItems,
  pointedActive,
  shownActive,
} from './pickerItems';

const label = (id: string, name: string, position: number): Label => ({
  id,
  projectId: 'p1',
  name,
  color: '#B42318',
  template: '',
  instructions: '',
  position,
  createdAt: 1,
});

const BUG = label('l-bug', 'Bug', 0);
const UI = label('l-ui', 'UI', 1);
const keys = (items: ReturnType<typeof pickerItems>) => items.map((item) => item.key);

describe('pickerItems', () => {
  it('lists the labels, then Create, then Edit labels', () => {
    const items = pickerItems([BUG, UI], 'v1.4', true);
    expect(keys(items)).toEqual(['label-l-bug', 'label-l-ui', 'create', 'manage']);
    expect(items[2]).toEqual({ kind: 'create', key: 'create', name: 'v1.4' });
  });

  it('leaves out Create without a new name, and Edit labels where there is no Labels sheet', () => {
    expect(keys(pickerItems([BUG], null, false))).toEqual(['label-l-bug']);
    expect(pickerItems([], null, false)).toEqual([]);
  });
});

describe('enterKey', () => {
  const items = pickerItems([BUG, UI], 'v1.4', true);

  it('marks the label named exactly, in any case', () => {
    expect(enterKey([BUG, UI], ' bug ', items)).toBe(labelKey('l-bug'));
  });

  it('marks Create for a name no label has', () => {
    expect(enterKey([BUG, UI], 'v1.4', items)).toBe('create');
  });

  it('marks nothing for an empty field, or a Create the picker doesn’t offer', () => {
    expect(enterKey([BUG, UI], '  ', items)).toBeNull();
    expect(enterKey([BUG, UI], 'v1.4', pickerItems([], null, true))).toBeNull();
  });
});

describe('shownActive', () => {
  const items = pickerItems([BUG, UI], 'v1', false);

  it('shows the row the arrows or the pointer picked', () => {
    const picked = { key: labelKey('l-ui'), by: 'keyboard' as const };
    expect(shownActive(items, picked, 'create')).toBe(picked);
  });

  it('falls back to Enter’s row once the picked row is no longer listed', () => {
    const gone = { key: 'manage', by: 'pointer' as const };
    expect(shownActive(items, gone, 'create')).toEqual({ key: 'create', by: 'enter' });
    expect(shownActive(items, null, null)).toBeNull();
  });
});

describe('movedActive', () => {
  const items = pickerItems([BUG, UI], 'v1', true);
  const at = (key: string) => ({ key, by: 'keyboard' as const });

  it('starts at the first row, or the last going up', () => {
    expect(movedActive('ArrowDown', items, null)).toBe(labelKey('l-bug'));
    expect(movedActive('ArrowUp', items, null)).toBe('manage');
  });

  it('moves from the row shown, Enter’s too, and wraps at the ends', () => {
    expect(movedActive('ArrowDown', items, { key: 'create', by: 'enter' })).toBe('manage');
    expect(movedActive('ArrowDown', items, at('manage'))).toBe(labelKey('l-bug'));
    expect(movedActive('ArrowUp', items, at(labelKey('l-bug')))).toBe('manage');
  });

  it('has nowhere to go without rows', () => {
    expect(movedActive('ArrowDown', [], null)).toBeNull();
  });
});

describe('pointedActive', () => {
  it('moves the highlight to the row under the pointer', () => {
    const keyboard = { key: 'create', by: 'keyboard' as const };
    expect(pointedActive(keyboard, 'manage')).toEqual({ key: 'manage', by: 'pointer' });
  });

  it('keeps the same object while the pointer stays on its row, so nothing renders again', () => {
    const pointer = { key: 'manage', by: 'pointer' as const };
    expect(pointedActive(pointer, 'manage')).toBe(pointer);
  });

  it('clears the pointer’s highlight as it leaves, but not the arrows’', () => {
    expect(pointedActive({ key: 'manage', by: 'pointer' }, null)).toBeNull();
    const keyboard = { key: 'create', by: 'keyboard' as const };
    expect(pointedActive(keyboard, null)).toBe(keyboard);
  });
});
