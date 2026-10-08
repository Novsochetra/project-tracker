export type DraftMap<T> = Readonly<Record<string, T>>;

export interface DraftStorage<T> {
  load: () => DraftMap<T>;
  store: (drafts: DraftMap<T>) => void;
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

// Drafts by id as one JSON object in localStorage, read again whenever another tab changed it.
export function draftStorage<T>(
  key: string,
  isDraft: (value: unknown) => value is T,
): DraftStorage<T> {
  let cached: { raw: string | null; drafts: DraftMap<T> } = { raw: null, drafts: {} };
  // Takes over once storage fails (private mode, full), so drafts still outlive the screen.
  let memory: DraftMap<T> | null = null;
  const load = (): DraftMap<T> => {
    if (memory) return memory;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== cached.raw) cached = { raw, drafts: readDrafts(raw, isDraft) };
      return cached.drafts;
    } catch {
      memory = {};
      return memory;
    }
  };
  const store = (drafts: DraftMap<T>): void => {
    if (!memory && persist(key, drafts)) return;
    memory = drafts;
  };
  return { load, store };
}
