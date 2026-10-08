// The tracker can send a list entry this app can't read, such as null. Code that runs outside the
// error boundaries passes over it, so one such entry doesn't take the others down with it.
export const isEntry = (entry: unknown): entry is object =>
  typeof entry === 'object' && entry !== null;

export const readableEntries = <T>(entries: readonly T[]): T[] => entries.filter(isEntry);
