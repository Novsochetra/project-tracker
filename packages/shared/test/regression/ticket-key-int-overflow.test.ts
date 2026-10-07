import { describe, expect, it } from 'vitest';
import { parseTicketKey } from '../../src/logic/ticketKey';

describe('regression: ticket numbers beyond a 32-bit integer', () => {
  it('returns null instead of a number the database cannot store', () => {
    expect(parseTicketKey('MOB-99999999999')).toBeNull();
    expect(parseTicketKey('MOB-2147483648')).toBeNull();
  });

  it('accepts the largest 32-bit number', () => {
    expect(parseTicketKey('MOB-2147483647')).toEqual({ projectKey: 'MOB', num: 2147483647 });
  });
});
