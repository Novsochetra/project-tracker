import { describe, expect, it } from 'vitest';
import { byRank, evenRanks, RANK_STEP, topRank, topRanks, type Rankable } from '../src/logic/rank';

const item = (num: number, rank: number): Rankable => ({ id: `t${num}`, num, rank });

const sortedIds = (items: Rankable[]): string[] =>
  [...items].sort(byRank).map((ticket) => ticket.id);

describe('byRank', () => {
  it('sorts by rank ascending', () => {
    expect(sortedIds([item(1, 2000), item(2, 0), item(3, 1000)])).toEqual(['t2', 't3', 't1']);
  });

  it('puts the higher number first when ranks tie', () => {
    expect(sortedIds([item(1, 0), item(3, 0), item(2, 0)])).toEqual(['t3', 't2', 't1']);
  });

  it('lets rank win over number', () => {
    expect(sortedIds([item(9, 1000), item(1, 0)])).toEqual(['t1', 't9']);
  });

  it('sorts negative ranks before zero', () => {
    expect(sortedIds([item(1, 0), item(2, -1000), item(3, -2000)])).toEqual(['t3', 't2', 't1']);
  });

  it('returns 0 only for the same rank and number', () => {
    expect(byRank(item(1, 5), item(1, 5))).toBe(0);
  });
});

describe('topRank', () => {
  it('returns 0 for an empty group', () => {
    expect(topRank([])).toBe(0);
  });

  it('returns 1000 less than the smallest rank in the group', () => {
    expect(RANK_STEP).toBe(1000);
    expect(topRank([item(1, 2000), item(2, 0), item(3, 1000)])).toBe(-1000);
  });

  it('keeps going below zero', () => {
    expect(topRank([item(1, -3000), item(2, 500)])).toBe(-4000);
  });

  it('puts a new ticket above every ticket in the group', () => {
    const group = [item(1, 0), item(2, 1000)];
    const created = item(3, topRank(group));

    expect(sortedIds([...group, created])[0]).toBe('t3');
  });
});

describe('topRanks', () => {
  it('ends at 0 in an empty group, with the tickets before the last one above it', () => {
    expect(topRanks([], ['c', 'a', 'b'])).toEqual(
      new Map([
        ['c', -2000],
        ['a', -1000],
        ['b', 0],
      ]),
    );
  });

  it('gives one ticket the rank topRank would', () => {
    const group = [item(1, 2000), item(2, 0)];
    expect(topRanks(group, ['t9'])).toEqual(new Map([['t9', topRank(group)]]));
  });

  it('puts every ticket above the group, in the order given', () => {
    const group = [item(1, 0), item(2, 1000)];
    const ranks = topRanks(group, ['t7', 't9', 't8']);
    const entering = [7, 8, 9].map((num) => item(num, ranks.get(`t${num}`) ?? 0));
    expect(sortedIds([...group, ...entering])).toEqual(['t7', 't9', 't8', 't1', 't2']);
  });

  it('returns nothing for no tickets', () => {
    expect(topRanks([item(1, 0)], []).size).toBe(0);
  });
});

describe('evenRanks', () => {
  it('numbers ids 0, 1000, 2000 in the given order', () => {
    expect(evenRanks(['c', 'a', 'b'])).toEqual(
      new Map([
        ['c', 0],
        ['a', 1000],
        ['b', 2000],
      ]),
    );
  });

  it('returns an empty map for no ids', () => {
    expect(evenRanks([]).size).toBe(0);
  });
});
