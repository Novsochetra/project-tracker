import { useRef } from 'react';
import { addSlot, settleSlot, waitingValue, type PickedSlot } from './pickedOrder';

export interface PickedOrder<T> {
  pick: (key: string) => void;
  settle: (key: string, value: T) => void;
  waiting: (key: string) => T | null;
  // Forgets every file, and gives back those that had finished and were waiting.
  clear: () => T[];
}

// With inOrder, each finished file is released once those picked before it are; without, at once.
export function usePickedOrder<T>(inOrder: boolean, release: (value: T) => void): PickedOrder<T> {
  const slots = useRef<PickedSlot<T>[]>([]);
  return {
    pick: (key) => {
      if (inOrder) slots.current = addSlot(slots.current, key);
    },
    settle: (key, value) => {
      const settled = settleSlot(slots.current, key, value);
      slots.current = settled.slots;
      settled.released.forEach((slot) => {
        if (slot.value !== null) release(slot.value);
      });
    },
    waiting: (key) => waitingValue(slots.current, key),
    clear: () => {
      const held = slots.current.flatMap((slot) => (slot.value === null ? [] : [slot.value]));
      slots.current = [];
      return held;
    },
  };
}
