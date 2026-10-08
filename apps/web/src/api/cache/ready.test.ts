import { describe, expect, it } from 'vitest';
import { listItem, STATUS, statuses } from '../test/fixtures';
import { readyStatuses, withoutMovedTicket, withStatuses } from './ready';

const ready = () => ({
  tickets: [listItem(3, STATUS.reviewed, 0), listItem(5, STATUS.reviewed, 1000)],
  statuses,
});
const keysOf = (list: { tickets: { key: string }[] }) => list.tickets.map((ticket) => ticket.key);

describe('withoutMovedTicket', () => {
  it('drops a ticket that moves to another status and keeps the statuses', () => {
    const left = withoutMovedTicket(ready(), 'mob-3', STATUS.done);
    expect(keysOf(left)).toEqual(['MOB-5']);
    expect(left.statuses).toBe(statuses);
  });

  it('keeps the list when the status stays or is not part of the change', () => {
    const list = ready();
    expect(withoutMovedTicket(list, 'MOB-3', STATUS.reviewed)).toBe(list);
    expect(withoutMovedTicket(list, 'MOB-3', undefined)).toBe(list);
    expect(withoutMovedTicket(list, 'MOB-9', STATUS.done)).toBe(list);
  });
});

describe('readyStatuses', () => {
  it('gives the statuses it can read, and none for a list it cannot', () => {
    expect(readyStatuses(ready())).toEqual(statuses);
    const odd = { tickets: [], statuses: [null, statuses[0], [1]] } as never;
    expect(readyStatuses(odd)).toEqual([statuses[0]]);
    expect(readyStatuses({ tickets: [], statuses: null } as never)).toEqual([]);
    expect(readyStatuses(null as never)).toEqual([]);
    expect(readyStatuses(undefined)).toEqual([]);
  });
});

describe('withStatuses', () => {
  it('keeps an answer that brings the statuses', () => {
    const answer = ready();
    expect(withStatuses(answer)).toBe(answer);
  });

  it('keeps the tickets of a list saved before the statuses came with it', () => {
    const saved = ready().tickets;
    expect(withStatuses(saved)).toEqual({ tickets: saved, statuses: [] });
  });
});
