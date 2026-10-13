import { describe, expect, it } from 'vitest';
import { createLabelInput, listTicketsQuery, updateTicketInput } from '../src/api/schemas';
import type { Label } from '../src/domain/label';
import { findLabelByName, hasLabel, labelNames, labelsOf, sortLabels } from '../src/logic/labels';

const label = (id: string, name: string, position: number, createdAt = 1): Label => ({
  id,
  projectId: 'p1',
  name,
  color: '#8E8E99',
  template: '',
  instructions: '',
  position,
  createdAt,
});

const bug = label('l-bug', 'Bug', 1);
const idea = label('l-idea', 'Idea', 0);
const ui = label('l-ui', 'UI', 1, 2);

describe('labels', () => {
  it('sort by position, then by when they were made', () => {
    expect(sortLabels([ui, bug, idea]).map((item) => item.name)).toEqual(['Idea', 'Bug', 'UI']);
  });

  it('are found by name, ignoring case and spaces around it', () => {
    expect(findLabelByName([bug, idea], ' bug ')).toBe(bug);
    expect(findLabelByName([bug, idea], 'Bugs')).toBeUndefined();
  });

  it('of a ticket come in the project’s order, without ids of labels gone since', () => {
    expect(labelsOf([bug, idea, ui], ['l-ui', 'gone', 'l-idea'])).toEqual([idea, ui]);
    expect(labelsOf([bug], undefined)).toEqual([]);
    expect(labelNames([idea, ui])).toBe('Idea, UI');
  });

  it('a ticket from an older tracker, without labelIds, has none', () => {
    expect(hasLabel({}, 'l-bug')).toBe(false);
    expect(hasLabel({ labelIds: ['l-bug'] }, 'l-bug')).toBe(true);
  });
});

describe('label schemas', () => {
  it('trim the name and instructions, keep the template as typed', () => {
    expect(
      createLabelInput.parse({ name: ' Bug ', template: '## Steps\n', instructions: ' Test it. ' }),
    ).toEqual({ name: 'Bug', template: '## Steps\n', instructions: 'Test it.' });
    expect(createLabelInput.safeParse({ name: '' }).success).toBe(false);
    expect(createLabelInput.safeParse({ name: 'x'.repeat(41) }).success).toBe(false);
  });

  it('take a ticket’s whole set of labels and a list filter by name', () => {
    expect(updateTicketInput.parse({ labelIds: [] })).toEqual({ labelIds: [] });
    expect(listTicketsQuery.parse({ label: 'Bug' })).toEqual({ label: 'Bug' });
  });
});
