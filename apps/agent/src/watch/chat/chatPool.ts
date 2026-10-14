export interface PooledChat {
  sessionId: () => string | undefined;
  close: () => void;
  reusable?: () => boolean;
}

export interface ChatWant<T> {
  chatId: string;
  key: string;
  resume: string | null;
  start: (onClose: () => void) => Promise<T>;
}

export interface ChatPoolOptions {
  idleMs?: number;
  max?: number;
  now?: () => number;
}

// In the map from before its process starts, so a second message for the chat waits as busy and
// the cap counts it.
interface Entry<T> {
  ready: Promise<T>;
  chat: T | undefined;
  key: string;
  using: boolean;
  usedAt: number;
  idle?: NodeJS.Timeout | undefined;
}

export const CHAT_IDLE_MS = 10 * 60_000;
export const OPEN_CHATS_MAX = 3;
export const CHAT_BUSY = 'Claude is still answering in this chat.';

// The open process carries on only the session the tracker asks for: a question with no session
// to resume has the chat so far in its prompt, so it gets a fresh process.
const fits = <T extends PooledChat>(entry: Entry<T>, want: ChatWant<T>) =>
  entry.key === want.key && entry.chat?.sessionId() === want.resume;

export function createChatPool<T extends PooledChat>(options: ChatPoolOptions = {}) {
  const { idleMs = CHAT_IDLE_MS, max = OPEN_CHATS_MAX, now = Date.now } = options;
  const open = new Map<string, Entry<T>>();

  function forget(chatId: string, entry: Entry<T>) {
    if (open.get(chatId) !== entry) return;
    clearTimeout(entry.idle);
    open.delete(chatId);
  }

  function close(chatId: string) {
    const entry = open.get(chatId);
    if (!entry) return;
    forget(chatId, entry);
    entry.ready.then(
      (chat) => chat.close(),
      () => undefined,
    );
  }

  // Only an idle process is closed: with every one answering, the pool stays over the cap until
  // a later message finds one idle.
  function makeRoom() {
    while (open.size >= max) {
      const idle = [...open].filter(([, entry]) => !entry.using);
      const oldest = idle.sort(([, a], [, b]) => a.usedAt - b.usedAt)[0];
      if (!oldest) return;
      close(oldest[0]);
    }
  }

  async function startFor(want: ChatWant<T>): Promise<Entry<T>> {
    const made: { entry?: Entry<T> } = {};
    const ready = want.start(() => {
      if (made.entry) forget(want.chatId, made.entry);
    });
    const entry: Entry<T> = { ready, chat: undefined, key: want.key, using: true, usedAt: 0 };
    made.entry = entry;
    open.set(want.chatId, entry);
    try {
      entry.chat = await ready;
    } catch (error) {
      forget(want.chatId, entry);
      throw error;
    }
    return entry;
  }

  function take(want: ChatWant<T>): Promise<Entry<T>> {
    const found = open.get(want.chatId);
    if (found?.using) return Promise.reject(new Error(CHAT_BUSY));
    if (found && fits(found, want)) {
      found.using = true;
      clearTimeout(found.idle);
      return Promise.resolve(found);
    }
    close(want.chatId);
    makeRoom();
    return startFor(want);
  }

  function release(chatId: string, entry: Entry<T>) {
    entry.using = false;
    entry.usedAt = now();
    if (open.get(chatId) !== entry) return;
    if (entry.chat?.reusable?.() === false) return close(chatId);
    entry.idle = setTimeout(() => close(chatId), idleMs);
    entry.idle.unref();
  }

  // The work's promise settling is the turn's end; the process then waits for the next message.
  async function use<R>(want: ChatWant<T>, work: (chat: T) => Promise<R>): Promise<R> {
    const entry = await take(want);
    try {
      return await work(await entry.ready);
    } finally {
      release(want.chatId, entry);
    }
  }

  return {
    use,
    closeAll: () => [...open.keys()].forEach(close),
    openCount: () => open.size,
  };
}

export type ChatPool<T extends PooledChat> = ReturnType<typeof createChatPool<T>>;
