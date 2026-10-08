export type StoredMap<T> = Readonly<Record<string, T>>;

export interface StoredMapAccess<T> {
  read: () => StoredMap<T>;
  // False when storage refuses the write (full, or turned off). An empty map removes the key.
  write: (map: StoredMap<T>) => boolean;
}

export function parseMap<T>(
  raw: string | null,
  isEntry: (value: unknown) => value is T,
): StoredMap<T> {
  try {
    const parsed: unknown = JSON.parse(raw ?? '{}');
    if (typeof parsed !== 'object' || parsed === null) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, T] => isEntry(entry[1])),
    );
  } catch {
    return {};
  }
}

// Read often (each keystroke that keeps a field, each check before an update), so the map is
// parsed again only when the stored text changed, which is also how another tab's writes show up.
// Without storage it reads as empty.
export function storedMap<T>(
  key: string,
  isEntry: (value: unknown) => value is T,
): StoredMapAccess<T> {
  let cached: { raw: string | null; map: StoredMap<T> } = { raw: null, map: {} };
  return {
    read: () => {
      try {
        const raw = window.localStorage.getItem(key);
        if (raw !== cached.raw) cached = { raw, map: parseMap(raw, isEntry) };
        return cached.map;
      } catch {
        return {};
      }
    },
    write: (map) => {
      try {
        if (Object.keys(map).length === 0) window.localStorage.removeItem(key);
        else window.localStorage.setItem(key, JSON.stringify(map));
        return true;
      } catch {
        return false;
      }
    },
  };
}
