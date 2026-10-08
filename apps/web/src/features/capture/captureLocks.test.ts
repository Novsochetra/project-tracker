import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCaptureLocks, type LockPlatform, type Release } from './captureLocks';
import { fakeLockManager } from './test/fakeLockManager';

function memoryStorage() {
  const values = new Map<string, string>();
  let refuse = false;
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (refuse) throw new DOMException('Full', 'QuotaExceededError');
      values.set(key, value);
    },
    removeItem: (key: string) => void values.delete(key),
  } as Storage;
  return { storage, values, refuseWrites: () => void (refuse = true) };
}

let releases: Release[] = [];

// Two tabs share the browser's locks and storage, but each has its own memory. Every lock they
// take is let go after the test, which also stops lease renewals.
function twoTabs(platform: Partial<LockPlatform>) {
  const shared: LockPlatform = {
    locks: () => undefined,
    storage: () => undefined,
    now: () => Date.now(),
    ...platform,
  };
  const tab = () => {
    const locks = createCaptureLocks(shared);
    return {
      hold: (id: string) => {
        const release = locks.hold(id);
        releases.push(release);
        return release;
      },
      claim: async (id: string) => {
        const release = await locks.claim(id);
        if (release) releases.push(release);
        return release;
      },
    };
  };
  return [tab(), tab()] as const;
}

const settled = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => {
  releases.forEach((release) => release());
  releases = [];
  vi.useRealTimers();
});

describe('capture locks with Web Locks', () => {
  const withLocks = () => {
    const locks = fakeLockManager();
    return twoTabs({ locks: () => locks });
  };

  it('leaves a capture to the tab whose request is out, until that tab lets go', async () => {
    const [tabA, tabB] = withLocks();
    const release = tabA.hold('x');
    await settled();
    await expect(tabB.claim('x')).resolves.toBeNull();

    release();
    await settled();
    await expect(tabB.claim('x')).resolves.toBeTypeOf('function');
  });

  it('gives a capture to one sync at a time', async () => {
    const [tabA, tabB] = withLocks();
    const first = await tabA.claim('x');
    expect(first).toBeTypeOf('function');
    await expect(tabB.claim('x')).resolves.toBeNull();
    first?.();
    await settled();
    await expect(tabB.claim('x')).resolves.toBeTypeOf('function');
  });

  it('knows of its own request at once, before the browser grants the lock', async () => {
    const [tab] = withLocks();
    const release = tab.hold('x');
    await expect(tab.claim('x')).resolves.toBeNull();
    release();
    release();
    await settled();
    await expect(tab.claim('x')).resolves.toBeTypeOf('function');
  });

  it('still sends when the browser refuses to lock, rather than waiting forever', async () => {
    const broken = { request: () => Promise.reject(new DOMException('No', 'SecurityError')) };
    const [tab] = twoTabs({ locks: () => broken as unknown as LockManager });
    await expect(tab.claim('x')).resolves.toBeTypeOf('function');
  });
});

describe('capture locks with a localStorage lease, where Web Locks are missing', () => {
  it('leaves a capture to the tab whose request is out, until that tab lets go', async () => {
    const { storage } = memoryStorage();
    const [tabA, tabB] = twoTabs({ storage: () => storage });
    const release = tabA.hold('x');
    await expect(tabB.claim('x')).resolves.toBeNull();

    release();
    await expect(tabB.claim('x')).resolves.toBeTypeOf('function');
  });

  it('gives a capture to one sync at a time', async () => {
    const { storage } = memoryStorage();
    const [tabA, tabB] = twoTabs({ storage: () => storage });
    const first = await tabA.claim('x');
    await expect(tabB.claim('x')).resolves.toBeNull();
    first?.();
    await expect(tabB.claim('x')).resolves.toBeTypeOf('function');
  });

  it('renews the lease while the request is out', async () => {
    vi.useFakeTimers();
    const { storage } = memoryStorage();
    const [tabA, tabB] = twoTabs({ storage: () => storage });
    tabA.hold('x');

    await vi.advanceTimersByTimeAsync(5 * 60_000);
    await expect(tabB.claim('x')).resolves.toBeNull();
  });

  it('stops blocking a minute after a tab closed without letting go', async () => {
    let now = 0;
    const { storage } = memoryStorage();
    const [tabA, tabB] = twoTabs({ storage: () => storage, now: () => now });
    tabA.hold('x');

    now = 59_000;
    await expect(tabB.claim('x')).resolves.toBeNull();
    now = 61_000;
    await expect(tabB.claim('x')).resolves.toBeTypeOf('function');
  });

  it('removes the lease when done', () => {
    const { storage, values } = memoryStorage();
    const [tab] = twoTabs({ storage: () => storage });
    tab.hold('x')();
    expect(values.size).toBe(0);
  });

  it('still keeps this tab from sending twice when storage refuses the lease', async () => {
    const { storage, refuseWrites } = memoryStorage();
    refuseWrites();
    const [tabA, tabB] = twoTabs({ storage: () => storage });
    tabA.hold('x');
    await expect(tabA.claim('x')).resolves.toBeNull();
    await expect(tabB.claim('x')).resolves.toBeTypeOf('function');
  });
});
