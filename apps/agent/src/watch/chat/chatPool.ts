export interface PooledChat {
  sessionId: () => string | undefined;
  close: () => void;
}

export interface ChatWant<T> {
  chatId: string;
  // What the process was started with that the person can change: model, mode and effort.
  key: string;
  resume: string | null;
  start: (onClose: () => void) => Promise<T>;
}

export interface ChatPoolOptions {
  idleMs?: number;
  max?: number;
  now?: () => number;
}

interface Entry<T> {
  chat: T;
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
  entry.key === want.key && entry.chat.sessionId() === want.resume;

export function createChatPool<T extends PooledChat>(options: ChatPoolOptions = {}) {
  const { idleMs = CHAT_IDLE_MS, max = OPEN_CHATS_MAX, now = Date.now } = options;
  const open = new Map<string, Entry<T>>();

  function close(chatId: string) {
    const entry = open.get(chatId);
    if (!entry) return;
    clearTimeout(entry.idle);
    open.delete(chatId);
    entry.chat.close();
  }

  function makeRoom() {
    while (open.size >= max) {
      const idle = [...open].filter(([, entry]) => !entry.using);
      const oldest = idle.sort(([, a], [, b]) => a.usedAt - b.usedAt)[0];
      if (!oldest) return;
      close(oldest[0]);
    }
  }

  async function take(want: ChatWant<T>): Promise<Entry<T>> {
    const found = open.get(want.chatId);
    if (found?.using) throw new Error(CHAT_BUSY);
    if (found && fits(found, want)) {
      found.using = true;
      clearTimeout(found.idle);
      return found;
    }
    close(want.chatId);
    makeRoom();
    const made: { entry?: Entry<T> } = {};
    const gone = () => {
      const { entry } = made;
      if (!entry || open.get(want.chatId) !== entry) return;
      clearTimeout(entry.idle);
      open.delete(want.chatId);
    };
    const entry: Entry<T> = { chat: await want.start(gone), key: want.key, using: true, usedAt: 0 };
    made.entry = entry;
    open.set(want.chatId, entry);
    return entry;
  }

  function release(chatId: string, entry: Entry<T>) {
    entry.using = false;
    entry.usedAt = now();
    if (open.get(chatId) !== entry) return;
    entry.idle = setTimeout(() => close(chatId), idleMs);
    entry.idle.unref();
  }

  // The work's promise settling is the turn's end; the process then waits for the next message.
  async function use<R>(want: ChatWant<T>, work: (chat: T) => Promise<R>): Promise<R> {
    const entry = await take(want);
    try {
      return await work(entry.chat);
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
