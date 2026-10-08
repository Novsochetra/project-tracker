const SPARE_PREFIX = 'spare-';

// A list entry's id is its React key. The tracker can send an entry without one, or the same id
// twice, so those get a spare key instead, numbered only among themselves and never one of the
// list's ids: every other entry keeps its id as its key while they come and go.
export function uniqueKeys(ids: readonly unknown[]): string[] {
  const taken = new Set(ids.filter((id) => typeof id === 'string'));
  const keyed = new Set<string>();
  let count = 0;
  const spare = (): string => {
    const key = `${SPARE_PREFIX}${count++}`;
    return taken.has(key) ? spare() : key;
  };
  return ids.map((id) => {
    if (typeof id !== 'string' || keyed.has(id)) return spare();
    keyed.add(id);
    return id;
  });
}
