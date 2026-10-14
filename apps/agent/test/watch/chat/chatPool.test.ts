import { describe, expect, it, vi } from 'vitest';
import { CHAT_BUSY, createChatPool, type ChatWant } from '../../../src/watch/chat/chatPool';

function fakeChat() {
  return { sessionId: () => undefined, close: vi.fn() };
}

type Chat = ReturnType<typeof fakeChat>;

const later = <T>() => {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((done) => (resolve = done));
  return { promise, resolve };
};

const want = (chatId: string, start: () => Promise<Chat>): ChatWant<Chat> => ({
  chatId,
  key: 'k',
  resume: null,
  start,
});

describe('createChatPool', () => {
  it('starts one process for two messages that come while it starts, and closes it', async () => {
    const pool = createChatPool<Chat>();
    const starting = later<Chat>();
    const start = vi.fn(() => starting.promise);
    const work = vi.fn(() => Promise.resolve('answer'));
    const first = pool.use(want('a', start), work);
    await expect(pool.use(want('a', start), work)).rejects.toThrow(CHAT_BUSY);
    const chat = fakeChat();
    starting.resolve(chat);
    expect(await first).toBe('answer');
    expect(start).toHaveBeenCalledOnce();
    pool.closeAll();
    await vi.waitFor(() => expect(chat.close).toHaveBeenCalledOnce());
    expect(pool.openCount()).toBe(0);
  });

  it('counts a process still starting toward the cap, going over it until one is idle', async () => {
    const pool = createChatPool<Chat>({ max: 1 });
    const starting = later<Chat>();
    const b = pool.use(
      want('b', () => starting.promise),
      () => Promise.resolve(),
    );
    expect(pool.openCount()).toBe(1);
    const c = pool.use(
      want('c', () => Promise.resolve(fakeChat())),
      () => Promise.resolve(),
    );
    expect(pool.openCount()).toBe(2);
    starting.resolve(fakeChat());
    await Promise.all([b, c]);
    await pool.use(
      want('d', () => Promise.resolve(fakeChat())),
      () => Promise.resolve(),
    );
    expect(pool.openCount()).toBe(1);
  });

  it('forgets a process that failed to start', async () => {
    const pool = createChatPool<Chat>();
    const failing = pool.use(
      want('a', () => Promise.reject(new Error('no socket'))),
      () => Promise.resolve(),
    );
    await expect(failing).rejects.toThrow('no socket');
    expect(pool.openCount()).toBe(0);
  });
});
