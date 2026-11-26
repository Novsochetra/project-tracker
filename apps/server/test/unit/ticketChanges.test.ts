import { describe, expect, it } from 'vitest';
import type { TicketRow } from '../../src/db/schema';
import { fieldChanges, mergeChanges } from '../../src/services/ticketChanges';

const ticket: TicketRow = {
  id: 't1',
  projectId: 'p1',
  num: 1,
  statusId: 's1',
  rank: 0,
  title: 'Crash',
  description: '',
  priority: 'medium',
  assignee: 'Dara',
  due: '2026-10-09',
  createdAt: 1,
  updatedAt: 1,
  clientId: null,
};

const today = new Date('2026-10-08T12:00:00');

describe('fieldChanges', () => {
  it('returns nothing when no field changes', () => {
    expect(
      fieldChanges(
        ticket,
        { title: 'Crash', priority: 'medium', assignee: ' Dara ', due: '2026-10-09' },
        today,
      ),
    ).toEqual({
      changes: {},
      entries: [],
    });
  });

  it('changes text fields without events', () => {
    expect(fieldChanges(ticket, { title: 'New', description: 'Body' }, today)).toEqual({
      changes: { title: 'New', description: 'Body' },
      entries: [],
    });
  });

  it('words priority, assignee and due date events', () => {
    const plan = fieldChanges(
      ticket,
      { priority: 'low', assignee: ' Bo ', due: '2027-01-02' },
      today,
    );
    expect(plan.changes).toEqual({ priority: 'low', assignee: 'Bo', due: '2027-01-02' });
    expect(plan.entries.map((entry) => entry.text)).toEqual([
      'set priority to Low',
      'assigned the ticket to Bo',
      'set the due date to Jan 2, 2027',
    ]);
  });

  it('words removals', () => {
    const plan = fieldChanges(ticket, { assignee: '', due: '' }, today);
    expect(plan.entries.map((entry) => entry.text)).toEqual([
      'removed the assignee',
      'removed the due date',
    ]);
  });

  it('uses the short day without a year in the current year', () => {
    expect(fieldChanges(ticket, { due: '2026-10-07' }, today).entries[0]?.text).toBe(
      'set the due date to Oct 7',
    );
  });
});

describe('mergeChanges', () => {
  it('combines changes and keeps entry order', () => {
    const merged = mergeChanges([
      { changes: { statusId: 's2', rank: -1000 }, entries: [{ type: 'event', text: 'a' }] },
      { changes: { priority: 'high' }, entries: [{ type: 'event', text: 'b' }] },
    ]);
    expect(merged).toEqual({
      changes: { statusId: 's2', rank: -1000, priority: 'high' },
      entries: [
        { type: 'event', text: 'a' },
        { type: 'event', text: 'b' },
      ],
    });
  });
});
