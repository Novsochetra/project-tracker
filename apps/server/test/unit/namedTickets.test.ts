import { describe, expect, it } from 'vitest';
import { nameTickets } from '../../src/services/namedTickets';

const byItself = (key: string) => key;

describe('nameTickets', () => {
  it('reads each key the way the tracker writes it, once, where it first came', () => {
    const { order, named } = nameTickets(['mob-3', 'WEB-1', 'MOB-03', 'MOB-3'], byItself);
    expect(order).toEqual(['MOB-3', 'WEB-1']);
    expect(named).toEqual([
      { key: 'MOB-3', projectKey: 'MOB', num: 3, value: 'mob-3' },
      { key: 'WEB-1', projectKey: 'WEB', num: 1, value: 'WEB-1' },
    ]);
  });

  it('keeps a key that names no ticket in the order as written, without naming anything', () => {
    const { order, named } = nameTickets(['MOB-0', 'MOB-1', 'not a key', 'not a key'], byItself);
    expect(order).toEqual(['MOB-0', 'MOB-1', 'not a key']);
    expect(named.map(({ key }) => key)).toEqual(['MOB-1']);
  });

  it('carries what came with each key', () => {
    const places = [
      { key: 'mob-2', rank: 0 },
      { key: 'MOB-2', rank: 1000 },
    ];
    const { named } = nameTickets(places, (place) => place.key);
    expect(named).toEqual([{ key: 'MOB-2', projectKey: 'MOB', num: 2, value: places[0] }]);
  });
});
