import { describe, expect, it, vi } from 'vitest';
import type { FoundTools } from '../../../src/watch/tools/readTools';
import { createToolsCache } from '../../../src/watch/tools/toolsCache';

const found = (servers: string[] | null, commands: string[] = []): FoundTools => ({
  servers,
  commands,
  skills: [],
});

function cacheWith(read: () => Promise<FoundTools>, first = found(['GitHub'])) {
  let time = 0;
  const cache = createToolsCache({ first, read, every: 1_000, now: () => time });
  return { cache, later: (ms: number) => (time += ms) };
}

describe('the tools a helper sends with each check-in', () => {
  it('reads them again only once they are old, in the background, one read at a time', async () => {
    const read = vi.fn(() => Promise.resolve(found(['Notion'], ['standup'])));
    const { cache, later } = cacheWith(read);
    expect(cache.current().servers).toEqual(['GitHub']);
    later(999);
    cache.current();
    expect(read).not.toHaveBeenCalled();
    later(1);
    expect(cache.current().servers).toEqual(['GitHub']);
    cache.current();
    expect(read).toHaveBeenCalledTimes(1);
    await vi.waitFor(() =>
      expect(cache.current()).toEqual({ servers: ['Notion'], commands: ['standup'], skills: [] }),
    );
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('keeps the last servers when the list could not be read, and sends none it never knew', async () => {
    const { cache, later } = cacheWith(() => Promise.resolve(found(null, ['standup'])));
    later(1_000);
    cache.current();
    await vi.waitFor(() =>
      expect(cache.current()).toEqual({ servers: ['GitHub'], commands: ['standup'], skills: [] }),
    );
    expect(cacheWith(vi.fn(), found(null)).cache.current().servers).toEqual([]);
  });

  it('keeps the last tools when a read fails, and tries again later', async () => {
    const read = vi.fn(() => Promise.reject(new Error('spawn EAGAIN')));
    const { cache, later } = cacheWith(read);
    later(1_000);
    cache.current();
    await new Promise(setImmediate);
    expect(read).toHaveBeenCalledTimes(1);
    expect(cache.current().servers).toEqual(['GitHub']);
    later(1_000);
    cache.current();
    expect(read).toHaveBeenCalledTimes(2);
  });
});
