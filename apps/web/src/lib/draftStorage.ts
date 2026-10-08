export type DraftMap<T> = Readonly<Record<string, T>>;

export interface DraftStorage<T> {
  load: () => DraftMap<T>;
  store: (drafts: DraftMap<T>) => void;
  // Storage refused some of them (full, or turned off), so they last only while the page does.
  hasUnstored: () => boolean;
}

export function readDrafts<T>(
  raw: string | null,
  isDraft: (value: unknown) => value is T,
): DraftMap<T> {
  try {
    const parsed: unknown = JSON.parse(raw ?? '{}');
    if (typeof parsed !== 'object' || parsed === null) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, T] => isDraft(entry[1])),
    );
  } catch {
    return {};
  }
}

function persist(key: string, drafts: DraftMap<unknown>): boolean {
  try {
    if (Object.keys(drafts).length === 0) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(drafts));
    return true;
  } catch {
    return false;
  }
}

const notKeptListeners = new Set<() => void>();

// Called when storage starts refusing drafts a store holds, so the user can be told.
export function onDraftsNotKept(listener: () => void): () => void {
  notKeptListeners.add(listener);
  return () => notKeptListeners.delete(listener);
}

const sameDraft = (stored: unknown, draft: unknown): boolean =>
  stored !== undefined && JSON.stringify(stored) === JSON.stringify(draft);

function pick<T>(drafts: DraftMap<T>, keep: (id: string, draft: T) => boolean): DraftMap<T> {
  return Object.fromEntries(Object.entries(drafts).filter(([id, draft]) => keep(id, draft)));
}

// Storage that refuses the drafts keeps only those it already holds unchanged, which is less than
// it holds now, so it fits. The copy left there is never older than the page's, which a reload
// would bring back. Returns what storage holds now.
function persistWhatFits<T>(key: string, drafts: DraftMap<T>, stored: DraftMap<T>): DraftMap<T> {
  if (persist(key, drafts)) return drafts;
  const unchanged = pick(drafts, (id, draft) => sameDraft(stored[id], draft));
  if (persist(key, unchanged)) return unchanged;
  persist(key, {});
  return {};
}

// Drafts are read often (each keystroke that keeps a field, each check before an update), so
// they are parsed again only when the stored text changed, which is also how another tab's
// writes show up.
export function draftStorage<T>(
  key: string,
  isDraft: (value: unknown) => value is T,
): DraftStorage<T> {
  let cached: { raw: string | null; drafts: DraftMap<T> } = { raw: null, drafts: {} };
  // The drafts storage refused, kept in memory so they still outlive the screen.
  let unstored: DraftMap<T> = {};
  const hasUnstored = () => Object.keys(unstored).length > 0;
  const read = (): DraftMap<T> => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== cached.raw) cached = { raw, drafts: readDrafts(raw, isDraft) };
      return cached.drafts;
    } catch {
      return {};
    }
  };
  const load = (): DraftMap<T> => (hasUnstored() ? { ...read(), ...unstored } : read());
  const store = (drafts: DraftMap<T>): void => {
    const allKept = !hasUnstored();
    const stored = persistWhatFits(key, drafts, read());
    unstored = pick(drafts, (id) => !(id in stored));
    if (allKept && hasUnstored()) notKeptListeners.forEach((listener) => listener());
  };
  return { load, store, hasUnstored };
}
