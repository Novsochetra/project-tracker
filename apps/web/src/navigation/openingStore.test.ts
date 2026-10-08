import { describe, expect, it, vi } from 'vitest';
import { createOpeningStore } from './openingStore';

describe('createOpeningStore', () => {
  it('keeps the path on its way and tells listeners when it changes', () => {
    const store = createOpeningStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    expect(store.get()).toBeNull();

    store.set('/p/MOB');
    store.set('/p/MOB');
    expect(store.get()).toBe('/p/MOB');
    expect(listener).toHaveBeenCalledTimes(1);

    store.set(null);
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    store.set('/p/WEB');
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
