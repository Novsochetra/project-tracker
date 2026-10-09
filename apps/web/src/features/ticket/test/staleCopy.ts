import { vi } from 'vitest';

// What a tab's copy of localStorage held when it last heard from the other tabs. A browser gives
// each tab such a copy, which hears of other tabs' writes a moment later: a tab that acts in that
// moment can't see what another tab wrote since.
export type StorageCopy = ReadonlyMap<string, string>;

export const copyOfStorage = (): StorageCopy =>
  new Map(Object.keys(localStorage).map((key) => [key, localStorage.getItem(key) ?? '']));

// Runs `act` as a tab that reads from `copy`; what it writes and removes reaches storage.
export function actFromCopy(copy: StorageCopy, act: () => void): void {
  const keys = [...copy.keys()];
  const spies = [
    vi.spyOn(Storage.prototype, 'length', 'get').mockReturnValue(keys.length),
    vi.spyOn(Storage.prototype, 'key').mockImplementation((index: number) => keys[index] ?? null),
    vi
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation((key: string) => copy.get(key) ?? null),
  ];
  try {
    act();
  } finally {
    spies.forEach((spy) => spy.mockRestore());
  }
}
