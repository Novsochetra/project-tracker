import type { TrackerClient } from '@tracker/client';
import { vi } from 'vitest';

type ClientOverrides = Partial<Record<keyof TrackerClient, unknown>>;

// Every method a test doesn't stub rejects loudly, so unexpected calls fail the test.
export function fakeClient(overrides: ClientOverrides = {}): TrackerClient {
  const stubs = new Map<string, unknown>();
  const methods: Record<string, unknown> = { eventsUrl: () => '/api/events', ...overrides };
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(target, name) {
      if (typeof name !== 'string' || name === 'then') return undefined;
      if (name in target) return target[name];
      if (!stubs.has(name)) {
        stubs.set(
          name,
          vi.fn(() => Promise.reject(new Error(`${name} is not stubbed`))),
        );
      }
      return stubs.get(name);
    },
  };
  return new Proxy(methods, handler) as unknown as TrackerClient;
}
