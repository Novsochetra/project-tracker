import { describe, expect, it } from 'vitest';
import { listItem, STATUS } from '../test/fixtures';
import { withoutMovedTicket } from './ready';

const ready = () => [listItem(3, STATUS.reviewed, 0), listItem(5, STATUS.reviewed, 1000)];
const keysOf = (list: { key: string }[]) => list.map((ticket) => ticket.key);

describe('withoutMovedTicket', () => {
  it('drops a ticket that moves to another status', () => {
    expect(keysOf(withoutMovedTicket(ready(), 'mob-3', STATUS.done))).toEqual(['MOB-5']);
  });

  it('keeps the list when the status stays or is not part of the change', () => {
    const list = ready();
    expect(withoutMovedTicket(list, 'MOB-3', STATUS.reviewed)).toEqual(list);
    expect(withoutMovedTicket(list, 'MOB-3', undefined)).toBe(list);
    expect(withoutMovedTicket(list, 'MOB-9', STATUS.done)).toEqual(list);
  });
});
