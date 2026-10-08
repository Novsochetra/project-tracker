import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { draftStorage, onDraftsNotKept } from './draftStorage';

const KEY = 'test.drafts';
const isText = (value: unknown): value is string => typeof value === 'string';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const onDisk = () => JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, string>;

// Full storage refuses any write that would make it hold more than it does now.
function fillStorage() {
  const setItem = Storage.prototype.setItem;
  return vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
    this: Storage,
    key: string,
    value: string,
  ) {
    if (value.length > (this.getItem(key)?.length ?? 0)) {
      throw new DOMException('Full', 'QuotaExceededError');
    }
    setItem.call(this, key, value);
  });
}

describe('draft storage that refuses a write', () => {
  it('keeps only unchanged drafts in storage and the rest in memory', () => {
    const { load, store, hasUnstored } = draftStorage(KEY, isText);
    store({ a: 'one', b: 'two', gone: 'three' });
    fillStorage();
    store({ a: 'one', b: 'two, longer', c: 'new' });
    expect(load()).toEqual({ a: 'one', b: 'two, longer', c: 'new' });
    expect(onDisk()).toEqual({ a: 'one' });
    expect(hasUnstored()).toBe(true);
  });

  it('stores everything again once storage takes the write', () => {
    const { load, store, hasUnstored } = draftStorage(KEY, isText);
    const full = fillStorage();
    store({ a: 'one' });
    expect(hasUnstored()).toBe(true);
    full.mockRestore();
    store({ ...load(), b: 'two' });
    expect(onDisk()).toEqual({ a: 'one', b: 'two' });
    expect(hasUnstored()).toBe(false);
  });

  it('forgets a draft that was only in memory', () => {
    const { load, store } = draftStorage(KEY, isText);
    fillStorage();
    store({ a: 'one' });
    store({});
    expect(load()).toEqual({});
  });

  it("shows another tab's drafts next to its own in memory", () => {
    const { load, store } = draftStorage(KEY, isText);
    const full = fillStorage();
    store({ mine: 'typed here' });
    full.mockRestore();
    localStorage.setItem(KEY, JSON.stringify({ theirs: 'typed there' }));
    expect(load()).toEqual({ theirs: 'typed there', mine: 'typed here' });
  });

  it('says so once when it starts refusing, and again after it took a write', () => {
    const listener = vi.fn();
    const stop = onDraftsNotKept(listener);
    const { store } = draftStorage(KEY, isText);
    const full = fillStorage();
    store({ a: 'one' });
    store({ a: 'one, longer' });
    expect(listener).toHaveBeenCalledTimes(1);
    full.mockRestore();
    store({});
    fillStorage();
    store({ a: 'again' });
    expect(listener).toHaveBeenCalledTimes(2);
    stop();
  });

  it("keeps drafts in memory when storage can't be read at all", () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError');
    });
    const { load, store, hasUnstored } = draftStorage(KEY, isText);
    store({ a: 'one' });
    expect(load()).toEqual({ a: 'one' });
    expect(hasUnstored()).toBe(true);
  });
});
