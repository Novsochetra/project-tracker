import { STATUS_COLORS, type Status } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { defaultTickets, STATUS, statuses } from '../../api/test/fixtures';
import {
  canDeleteStatus,
  categoryHint,
  colorChoices,
  colorName,
  createInput,
  deleteMessage,
  draftOf,
  firstUnusedColor,
  moveInOrder,
  moveTargets,
  nameIssue,
  nameIssueMessage,
  newDraft,
  sameMembers,
  sameOrder,
  ticketCounts,
  ticketsLabel,
  updateInput,
} from './statusForm';

const status = (id: string): Status => statuses.find((item) => item.id === id)!;

describe('names', () => {
  it('needs a name', () => {
    expect(nameIssue('   ', statuses)).toEqual({ kind: 'blank' });
    expect(nameIssueMessage({ kind: 'blank' })).toBe('Add a name to save the status.');
  });

  it('rejects a name another status has, ignoring case and spaces', () => {
    expect(nameIssue(' to DO ', statuses)).toEqual({ kind: 'taken', name: 'To do' });
    expect(nameIssueMessage({ kind: 'taken', name: 'To do' })).toBe(
      'A status named “To do” already exists.',
    );
  });

  it('lets a status keep or recase its own name', () => {
    expect(nameIssue('TO DO', statuses, STATUS.todo)).toBeNull();
    expect(nameIssue('Blocked', statuses)).toBeNull();
  });
});

describe('drafts', () => {
  it('starts a new status as In progress in the first unused color', () => {
    expect(newDraft(statuses)).toEqual({ name: '', category: 'in_progress', color: '#6E56CF' });
  });

  it('cycles through the palette once every color is used', () => {
    const all = STATUS_COLORS.map((color) => ({ color }));
    expect(firstUnusedColor(all)).toBe(STATUS_COLORS[0]);
    expect(firstUnusedColor([{ color: '#8e8e99' }])).toBe(STATUS_COLORS[1]);
  });

  it('creates with a trimmed name', () => {
    expect(createInput({ name: ' Blocked ', category: 'todo', color: '#B42318' })).toEqual({
      name: 'Blocked',
      category: 'todo',
      color: '#B42318',
    });
  });

  it('updates only what changed', () => {
    const todo = status(STATUS.todo);
    expect(updateInput(todo, draftOf(todo))).toEqual({});
    expect(updateInput(todo, { ...draftOf(todo), color: todo.color.toLowerCase() })).toEqual({});
    expect(updateInput(todo, { name: 'Backlog ', category: 'todo', color: '#B42318' })).toEqual({
      name: 'Backlog',
      color: '#B42318',
    });
    expect(updateInput(todo, { ...draftOf(todo), category: 'in_progress' })).toEqual({
      category: 'in_progress',
    });
  });
});

describe('colors', () => {
  it('names every palette color', () => {
    expect(STATUS_COLORS.map(colorName)).toEqual([
      'Gray',
      'Orange',
      'Blue',
      'Green',
      'Indigo',
      'Violet',
      'Pink',
      'Red',
      'Teal',
    ]);
    expect(colorName('#5b5bd6')).toBe('Indigo');
  });

  it('keeps a color from outside the palette as a choice', () => {
    expect(colorChoices('#C26A06')).toEqual([...STATUS_COLORS]);
    expect(colorChoices('#123456')).toEqual(['#123456', ...STATUS_COLORS]);
    expect(colorName('#123456')).toBe('Current color');
  });
});

describe('rows', () => {
  it('shows the type only when the name doesn’t say it', () => {
    expect(categoryHint(status(STATUS.todo))).toBeNull();
    expect(categoryHint({ name: 'need REVIEW', category: 'in_review' })).toBeNull();
    expect(categoryHint({ name: 'Blocked', category: 'in_progress' })).toBe('In progress');
  });

  it('counts tickets per status', () => {
    const counts = ticketCounts(defaultTickets());
    expect(counts.get(STATUS.todo)).toBe(2);
    expect(counts.get(STATUS.progress)).toBe(1);
    expect(counts.get(STATUS.review)).toBeUndefined();
    expect(ticketsLabel(1)).toBe('1 ticket');
    expect(ticketsLabel(3)).toBe('3 tickets');
  });
});

describe('deleting', () => {
  it('needs another status to remain', () => {
    expect(canDeleteStatus(statuses)).toBe(true);
    expect(canDeleteStatus([status(STATUS.todo)])).toBe(false);
  });

  it('offers every other status as the target', () => {
    expect(moveTargets(statuses, STATUS.todo).map((item) => item.id)).not.toContain(STATUS.todo);
    expect(moveTargets(statuses, STATUS.todo)).toHaveLength(statuses.length - 1);
  });

  it('says where the tickets go', () => {
    expect(deleteMessage('Blocked', 0)).toBe("Delete “Blocked”? This can't be undone.");
    expect(deleteMessage('Blocked', 1, { name: 'To do' })).toBe(
      'Delete “Blocked” and move its 1 ticket to To do?',
    );
    expect(deleteMessage('Blocked', 3, { name: 'To do' })).toBe(
      'Delete “Blocked” and move its 3 tickets to To do?',
    );
  });
});

describe('ordering', () => {
  const ids = ['a', 'b', 'c'];

  it('moves an id one slot and stops at the ends', () => {
    expect(moveInOrder(ids, 'b', -1)).toEqual(['b', 'a', 'c']);
    expect(moveInOrder(ids, 'b', 1)).toEqual(['a', 'c', 'b']);
    expect(moveInOrder(ids, 'a', -1)).toBeNull();
    expect(moveInOrder(ids, 'c', 1)).toBeNull();
    expect(moveInOrder(ids, 'x', 1)).toBeNull();
  });

  it('compares orders and members', () => {
    expect(sameOrder(ids, ['a', 'b', 'c'])).toBe(true);
    expect(sameOrder(ids, ['b', 'a', 'c'])).toBe(false);
    expect(sameMembers(ids, ['c', 'a', 'b'])).toBe(true);
    expect(sameMembers(ids, ['a', 'b'])).toBe(false);
  });
});
