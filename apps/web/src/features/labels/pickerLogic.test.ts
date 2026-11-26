import { LABEL_NAME_MAX, STATUS_COLORS, type Label } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import {
  canAdd,
  creatableName,
  enterChoice,
  isFull,
  matchingLabels,
  newLabelInput,
} from './pickerLogic';

const label = (id: string, name: string, position: number, color = '#B42318'): Label => ({
  id,
  projectId: 'p1',
  name,
  color,
  template: '',
  instructions: '',
  position,
  createdAt: 1,
});

const LABELS = [label('l-ui', 'UI', 1), label('l-bug', 'Bug', 0), label('l-rel', 'v1.4', 2)];
const ids = (labels: readonly Label[]) => labels.map((item) => item.id);

describe('matchingLabels', () => {
  it('lists every label in the project’s order for an empty query', () => {
    expect(ids(matchingLabels(LABELS, '  '))).toEqual(['l-bug', 'l-ui', 'l-rel']);
  });

  it('keeps the labels whose name holds the query, in any case', () => {
    expect(ids(matchingLabels(LABELS, 'U'))).toEqual(['l-bug', 'l-ui']);
    expect(ids(matchingLabels(LABELS, ' V1. '))).toEqual(['l-rel']);
    expect(matchingLabels(LABELS, 'docs')).toEqual([]);
  });
});

describe('creatableName', () => {
  it('trims a new name and refuses a blank one', () => {
    expect(creatableName(LABELS, '  v1.5 ')).toBe('v1.5');
    expect(creatableName(LABELS, '   ')).toBeNull();
  });

  it('refuses a name a label already has, in any case', () => {
    expect(creatableName(LABELS, 'bug')).toBeNull();
    expect(creatableName(LABELS, 'V1.4')).toBeNull();
  });

  it('cuts a name to the label limit', () => {
    expect(creatableName([], 'x'.repeat(LABEL_NAME_MAX + 5))).toHaveLength(LABEL_NAME_MAX);
  });
});

describe('enterChoice', () => {
  it('picks the label named exactly rather than making a twin', () => {
    expect(enterChoice(LABELS, 'BUG')).toEqual({ kind: 'toggle', id: 'l-bug' });
  });

  it('makes a label for a new name, even when it is part of another', () => {
    expect(enterChoice(LABELS, 'v1')).toEqual({ kind: 'create', name: 'v1' });
  });

  it('does nothing for a blank field', () => {
    expect(enterChoice(LABELS, '')).toBeNull();
  });
});

describe('newLabelInput', () => {
  it('gives a project’s first label a color, not gray', () => {
    expect(newLabelInput([], 'v1.4')).toEqual({ name: 'v1.4', color: STATUS_COLORS[1] });
  });

  it('gives a new label the first color no label has yet', () => {
    const used = [label('a', 'A', 0, STATUS_COLORS[1]), label('b', 'B', 1, STATUS_COLORS[2])];
    expect(newLabelInput(used, 'v1.5').color).toBe(STATUS_COLORS[3]);
  });
});

describe('the ten-label limit', () => {
  const ten = Array.from({ length: 10 }, (_, index) => `l-${index}`);

  it('still lets a full ticket drop a label, never gain one', () => {
    expect(isFull(ten)).toBe(true);
    expect(canAdd(ten, 'l-3')).toBe(true);
    expect(canAdd(ten, 'l-new')).toBe(false);
    expect(canAdd(ten.slice(1), 'l-new')).toBe(true);
  });
});
