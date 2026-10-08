import { storedMap, type StoredMap, type StoredMapAccess } from './storedMap';

export interface DraftStorage<T> {
  load: () => StoredMap<T>;
  store: (drafts: StoredMap<T>) => void;
  // Storage refused some of them (full, or turned off), so they last only while the page does.
  hasUnstored: () => boolean;
}

const notKeptListeners = new Set<() => void>();

// Called when storage starts refusing drafts a store holds, so the user can be told.
export function onDraftsNotKept(listener: () => void): () => void {
  notKeptListeners.add(listener);
  return () => notKeptListeners.delete(listener);
}

const sameDraft = (stored: unknown, draft: unknown): boolean =>
  stored !== undefined && JSON.stringify(stored) === JSON.stringify(draft);

function pick<T>(drafts: StoredMap<T>, keep: (id: string, draft: T) => boolean): StoredMap<T> {
  return Object.fromEntries(Object.entries(drafts).filter(([id, draft]) => keep(id, draft)));
}

// Storage that refuses the drafts keeps only those it already holds unchanged, which is less than
// it holds now, so it fits. The copy left there is never older than the page's, which a reload
// would bring back. Returns what storage holds now.
function writeWhatFits<T>(stored: StoredMapAccess<T>, drafts: StoredMap<T>): StoredMap<T> {
  const before = stored.read();
  if (stored.write(drafts)) return drafts;
  const unchanged = pick(drafts, (id, draft) => sameDraft(before[id], draft));
  if (stored.write(unchanged)) return unchanged;
  stored.write({});
  return {};
}

export function draftStorage<T>(
  key: string,
  isDraft: (value: unknown) => value is T,
): DraftStorage<T> {
  const stored = storedMap(key, isDraft);
  // The drafts storage refused, kept in memory so they still outlive the screen.
  let unstored: StoredMap<T> = {};
  const hasUnstored = () => Object.keys(unstored).length > 0;
  const load = (): StoredMap<T> =>
    hasUnstored() ? { ...stored.read(), ...unstored } : stored.read();
  const store = (drafts: StoredMap<T>): void => {
    const allKept = !hasUnstored();
    const kept = writeWhatFits(stored, drafts);
    unstored = pick(drafts, (id) => !(id in kept));
    if (allKept && hasUnstored()) notKeptListeners.forEach((listener) => listener());
  };
  return { load, store, hasUnstored };
}
