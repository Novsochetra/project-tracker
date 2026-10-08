// jsdom has no Web Locks, so this one stands in for the browser's, shared by the "tabs" of a test.
export function fakeLockManager(): LockManager {
  const held = new Set<string>();
  const waiting = new Map<string, (() => void)[]>();

  const acquire = (name: string): Promise<void> => {
    if (!held.has(name)) {
      held.add(name);
      return Promise.resolve();
    }
    return new Promise((resolve) => waiting.set(name, [...(waiting.get(name) ?? []), resolve]));
  };
  // The next request in line gets the lock directly, so no one can take it in between.
  const handOver = (name: string) => {
    const [next, ...rest] = waiting.get(name) ?? [];
    waiting.set(name, rest);
    if (next) next();
    else held.delete(name);
  };

  async function request<T>(
    name: string,
    ...args: [LockGrantedCallback<T>] | [LockOptions, LockGrantedCallback<T>]
  ): Promise<Awaited<T>> {
    const [options, callback] = args.length === 1 ? [{}, args[0]] : args;
    if (options.ifAvailable && held.has(name)) return await callback(null);
    await acquire(name);
    try {
      return await callback({ name, mode: 'exclusive' });
    } finally {
      handOver(name);
    }
  }

  const query = () =>
    Promise.resolve({
      held: [...held].map((name) => ({ name, mode: 'exclusive' as const, clientId: 'test' })),
      pending: [],
    });

  return { request, query };
}

export function installLockManager(locks: LockManager): () => void {
  Object.defineProperty(navigator, 'locks', { configurable: true, value: locks });
  return () => {
    Reflect.deleteProperty(navigator, 'locks');
  };
}
