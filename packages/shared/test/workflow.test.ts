import { describe, expect, it } from 'vitest';
import type { Priority } from '../src/domain/priority';
import { DEFAULT_STATUSES, type Status } from '../src/domain/status';
import { isSentBack, pickNextTicket, workableTickets } from '../src/logic/workflow';

const statuses: Status[] = [
  ...DEFAULT_STATUSES.map((template, position) => ({
    ...template,
    id: template.category,
    projectId: 'p1',
    position,
    createdAt: 0,
  })),
  {
    id: 'backlog',
    projectId: 'p1',
    name: 'Backlog',
    category: 'todo',
    color: '#8E8E99',
    position: 5,
    createdAt: 0,
  },
];

const item = (num: number, statusId: string, priority: Priority, rank = 0) => ({
  id: `MOB-${num}`,
  num,
  statusId,
  priority,
  rank,
});

const keys = (tickets: { id: string }[]) => tickets.map((t) => t.id);

describe('pickNextTicket', () => {
  it('only picks tickets in a todo-category status', () => {
    const tickets = [
      item(1, 'in_progress', 'high'),
      item(2, 'in_review', 'high'),
      item(3, 'reviewed', 'high'),
      item(4, 'done', 'high'),
      item(5, 'todo', 'low'),
    ];

    expect(pickNextTicket(tickets, statuses)?.id).toBe('MOB-5');
  });

  it('picks from every todo-category status', () => {
    expect(pickNextTicket([item(1, 'backlog', 'medium')], statuses)?.id).toBe('MOB-1');
  });

  it('picks the highest priority first', () => {
    const tickets = [item(1, 'todo', 'low'), item(2, 'todo', 'medium'), item(3, 'todo', 'high')];

    expect(pickNextTicket(tickets, statuses)?.id).toBe('MOB-3');
  });

  it('breaks priority ties by rank', () => {
    const tickets = [item(1, 'todo', 'high', 1000), item(2, 'todo', 'high', -1000)];

    expect(pickNextTicket(tickets, statuses)?.id).toBe('MOB-2');
  });

  it('breaks rank ties by the lower number', () => {
    const tickets = [item(7, 'todo', 'high', 0), item(3, 'todo', 'high', 0)];

    expect(pickNextTicket(tickets, statuses)?.id).toBe('MOB-3');
  });

  it('puts priority before rank', () => {
    const tickets = [item(1, 'todo', 'medium', -5000), item(2, 'todo', 'high', 5000)];

    expect(pickNextTicket(tickets, statuses)?.id).toBe('MOB-2');
  });

  it('returns null when nothing is ready', () => {
    expect(pickNextTicket([], statuses)).toBeNull();
    expect(pickNextTicket([item(1, 'in_progress', 'high')], statuses)).toBeNull();
    expect(pickNextTicket([item(1, 'unknown-status', 'high')], statuses)).toBeNull();
  });
});

describe('workableTickets', () => {
  it('keeps only todo and in-progress tickets', () => {
    const tickets = [
      item(1, 'todo', 'medium'),
      item(2, 'in_progress', 'medium'),
      item(3, 'in_review', 'medium'),
      item(4, 'reviewed', 'medium'),
      item(5, 'done', 'medium'),
      item(6, 'backlog', 'medium'),
    ];

    expect(keys(workableTickets(tickets, statuses))).toEqual(['MOB-2', 'MOB-1', 'MOB-6']);
  });

  it('orders in-progress tickets first, then by priority, then by number', () => {
    const tickets = [
      item(1, 'todo', 'low'),
      item(2, 'todo', 'high'),
      item(3, 'in_progress', 'low'),
      item(4, 'todo', 'high'),
      item(5, 'in_progress', 'high'),
      item(6, 'todo', 'medium'),
    ];

    expect(keys(workableTickets(tickets, statuses))).toEqual([
      'MOB-5',
      'MOB-3',
      'MOB-2',
      'MOB-4',
      'MOB-6',
      'MOB-1',
    ]);
  });

  it('ignores rank', () => {
    const tickets = [item(2, 'todo', 'high', -9000), item(1, 'todo', 'high', 9000)];

    expect(keys(workableTickets(tickets, statuses))).toEqual(['MOB-1', 'MOB-2']);
  });

  it('leaves the input array unchanged', () => {
    const tickets = [item(2, 'todo', 'low'), item(1, 'in_progress', 'high')];

    workableTickets(tickets, statuses);

    expect(keys(tickets)).toEqual(['MOB-2', 'MOB-1']);
  });

  it('returns an empty list when nothing is open', () => {
    expect(workableTickets([item(1, 'done', 'high')], statuses)).toEqual([]);
  });
});

describe('isSentBack', () => {
  const changes = { verdict: 'changes_requested', rating: 2 } as const;

  it('is true while a ticket whose latest review asked for changes waits in To do or In progress', () => {
    expect(isSentBack(changes, 'todo')).toBe(true);
    expect(isSentBack(changes, 'in_progress')).toBe(true);
  });

  it('ends once the ticket is submitted again, reviewed or done', () => {
    expect(isSentBack(changes, 'in_review')).toBe(false);
    expect(isSentBack(changes, 'reviewed')).toBe(false);
    expect(isSentBack(changes, 'done')).toBe(false);
  });

  it('is false for an approval or a ticket nobody reviewed', () => {
    expect(isSentBack({ verdict: 'approved', rating: 4 }, 'todo')).toBe(false);
    expect(isSentBack(null, 'todo')).toBe(false);
  });
});
