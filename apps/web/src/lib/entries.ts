// The tracker can send a list entry this app can't read, such as null, a number or an array. Code
// that runs outside the error boundaries passes over it, so one such entry doesn't take the others
// down with it.
export const isEntry = (entry: unknown): entry is object =>
  typeof entry === 'object' && entry !== null && !Array.isArray(entry);

export const readableEntries = <T>(entries: readonly T[]): T[] => entries.filter(isEntry);

export const isList = <T>(list: readonly T[] | null | undefined): list is readonly T[] =>
  Array.isArray(list);

// A list field the tracker sent as something else, such as { tickets: null }, has no entries.
export const entriesOf = <T>(list: readonly T[] | null | undefined): T[] =>
  isList(list) ? readableEntries(list) : [];
