import { describe, expect, it, vi } from 'vitest';
import { createOpeningStore } from './openingStore';

describe('createOpeningStore', () => {
  it('keeps the path on its way and tells listeners when it changes', () => {
    const store = createOpeningStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    expect(store.get()).toBeNull();

    store.open('/p/MOB');
    store.open('/p/MOB');
    expect(store.get()).toBe('/p/MOB');
    expect(listener).toHaveBeenCalledTimes(1);

    store.clear();
    expect(store.get()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    store.open('/p/WEB');
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('says whether a push is still the one on its way', () => {
    const store = createOpeningStore();
    const first = store.open('/p/MOB');
    expect(first()).toBe(true);

    store.open('/p/WEB');
    const again = store.open('/p/MOB');
    expect(first()).toBe(false);
    expect(again()).toBe(true);

    store.clear();
    expect(again()).toBe(false);
  });
});
