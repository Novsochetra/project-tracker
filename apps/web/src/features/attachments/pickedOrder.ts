export interface PickedSlot<T> {
  key: string;
  settled: boolean;
  value: T | null;
}

export const addSlot = <T>(slots: readonly PickedSlot<T>[], key: string): PickedSlot<T>[] => [
  ...slots,
  { key, settled: false, value: null },
];

export interface Settled<T> {
  slots: PickedSlot<T>[];
  released: PickedSlot<T>[];
}

// Uploads finish in any order. One that finishes ahead of those picked before it waits, so they
// are released in the order they were picked. A key that isn't held is released at once.
export function settleSlot<T>(
  slots: readonly PickedSlot<T>[],
  key: string,
  value: T | null,
): Settled<T> {
  if (!slots.some((slot) => slot.key === key)) {
    return { slots: [...slots], released: [{ key, settled: true, value }] };
  }
  const marked = slots.map((slot) => (slot.key === key ? { key, settled: true, value } : slot));
  const blocked = marked.findIndex((slot) => !slot.settled);
  const cut = blocked === -1 ? marked.length : blocked;
  return { slots: marked.slice(cut), released: marked.slice(0, cut) };
}

export const waitingValue = <T>(slots: readonly PickedSlot<T>[], key: string): T | null =>
  slots.find((slot) => slot.key === key && slot.settled)?.value ?? null;
