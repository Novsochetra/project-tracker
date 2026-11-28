// window.matchMedia for tests: queries match while set, and a change tells their listeners.
export function fakeMedia(window: Window) {
  const matching = new Set<string>();
  const listeners = new Map<string, Set<() => void>>();
  const previous = Object.getOwnPropertyDescriptor(window, 'matchMedia');
  const listOf = (query: string) =>
    listeners.get(query) ?? listeners.set(query, new Set()).get(query)!;

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      get matches() {
        return matching.has(query);
      },
      media: query,
      addEventListener: (_type: string, listener: () => void) => listOf(query).add(listener),
      removeEventListener: (_type: string, listener: () => void) => listOf(query).delete(listener),
    }),
  });

  return {
    set(query: string, matches: boolean) {
      if (matches) matching.add(query);
      else matching.delete(query);
      listOf(query).forEach((listener) => listener());
    },

    restore() {
      if (previous) Object.defineProperty(window, 'matchMedia', previous);
      else Reflect.deleteProperty(window, 'matchMedia');
    },
  };
}
