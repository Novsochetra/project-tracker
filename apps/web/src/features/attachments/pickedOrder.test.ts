import { describe, expect, it } from 'vitest';
import { addSlot, settleSlot, waitingValue, type PickedSlot } from './pickedOrder';

const picked = (...keys: string[]) =>
  keys.reduce<PickedSlot<string>[]>((slots, key) => addSlot(slots, key), []);

const keysOf = (slots: readonly PickedSlot<string>[]) => slots.map((slot) => slot.key);

describe('settleSlot', () => {
  it('releases a file at once when every file picked before it is released', () => {
    const { slots, released } = settleSlot(picked('a', 'b'), 'a', 'A');
    expect(released).toEqual([{ key: 'a', settled: true, value: 'A' }]);
    expect(keysOf(slots)).toEqual(['b']);
  });

  it('keeps a file that finished early until those picked before it finish, then releases all in order', () => {
    const first = settleSlot(picked('a', 'b', 'c'), 'c', 'C');
    expect(first.released).toEqual([]);
    const second = settleSlot(first.slots, 'b', 'B');
    expect(second.released).toEqual([]);
    const third = settleSlot(second.slots, 'a', 'A');
    expect(third.released.map((slot) => slot.value)).toEqual(['A', 'B', 'C']);
    expect(third.slots).toEqual([]);
  });

  it('lets the files after one that failed or was stopped go on', () => {
    const waiting = settleSlot(picked('a', 'b'), 'b', 'B');
    const { released, slots } = settleSlot(waiting.slots, 'a', null);
    expect(released.map((slot) => slot.value)).toEqual([null, 'B']);
    expect(slots).toEqual([]);
  });

  it('lets a waiting file be settled again, as when it is removed', () => {
    const waiting = settleSlot(picked('a', 'b'), 'b', 'B');
    const removed = settleSlot(waiting.slots, 'b', null);
    expect(removed.released).toEqual([]);
    expect(settleSlot(removed.slots, 'a', 'A').released.map((slot) => slot.value)).toEqual([
      'A',
      null,
    ]);
  });

  it('releases a key it does not hold at once', () => {
    const slots = picked('a');
    expect(settleSlot(slots, 'x', 'X')).toEqual({
      slots,
      released: [{ key: 'x', settled: true, value: 'X' }],
    });
  });
});

it('tells the value of a file that finished and is waiting, and only of that', () => {
  const { slots } = settleSlot(picked('a', 'b'), 'b', 'B');
  expect(waitingValue(slots, 'b')).toBe('B');
  expect(waitingValue(slots, 'a')).toBeNull();
  expect(waitingValue(slots, 'x')).toBeNull();
});
