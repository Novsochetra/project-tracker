import type { Label } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import {
  createInput,
  deleteMessage,
  draftChanged,
  draftOf,
  labelCounts,
  nameIssue,
  nameIssueMessage,
  newDraft,
  updateInput,
} from './labelForm';

const bug: Label = {
  id: 'l-bug',
  projectId: 'p1',
  name: 'Bug',
  color: '#8E8E99',
  template: '## Steps\n',
  instructions: 'Reproduce it first.',
  position: 0,
  createdAt: 1,
};

describe('the label form', () => {
  it('starts a new label empty, in the first color no label has', () => {
    expect(newDraft([bug])).toEqual({
      name: '',
      color: '#C26A06',
      template: '',
      instructions: '',
    });
  });

  it('finds a blank or taken name, ignoring case and the label being edited', () => {
    expect(nameIssue('  ', [bug])).toEqual({ kind: 'blank' });
    expect(nameIssue('bug', [bug])).toEqual({ kind: 'taken', name: 'Bug' });
    expect(nameIssue('BUG', [bug], bug.id)).toBeNull();
    expect(nameIssueMessage({ kind: 'taken', name: 'Bug' })).toBe(
      'A label named “Bug” already exists.',
    );
  });

  it('sends only what changed, trimmed', () => {
    const draft = { ...draftOf(bug), name: ' Defect ', instructions: 'Reproduce it first.\n' };
    expect(updateInput(bug, draft)).toEqual({ name: 'Defect' });
    expect(updateInput(bug, { ...draftOf(bug), template: '' })).toEqual({ template: '' });
    expect(createInput({ ...draft, color: '#B42318' })).toEqual({
      name: 'Defect',
      color: '#B42318',
      template: '## Steps\n',
      instructions: 'Reproduce it first.',
    });
  });

  it('counts a change of any field, but not of spaces around the name', () => {
    const initial = draftOf(bug);
    expect(draftChanged(initial, { ...initial, name: ' Bug ' })).toBe(false);
    expect(draftChanged(initial, { ...initial, color: '#8e8e99' })).toBe(false);
    expect(draftChanged(initial, { ...initial, template: '' })).toBe(true);
    expect(draftChanged(initial, { ...initial, instructions: 'More.' })).toBe(true);
  });

  it('counts the tickets of each label, and says what deleting does to them', () => {
    const counts = labelCounts([{ labelIds: ['a', 'b'] }, { labelIds: ['a'] }, {}]);
    expect([...counts]).toEqual([
      ['a', 2],
      ['b', 1],
    ]);
    expect(deleteMessage('Bug', 0)).toBe("Delete “Bug”? This can't be undone.");
    expect(deleteMessage('Bug', 2)).toBe('Delete “Bug” and take it off 2 tickets?');
  });
});
