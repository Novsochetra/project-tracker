// A page holds a lock named after it while it is open. The browser lets it go when the page goes,
// however it goes: closed, killed, or closing with its last writes to storage lost, as WebKit
// loses them under load (PT-135). Without Web Locks (an older browser, a page served over plain
// http) nothing is told, and other tabs wait for the page's marks to run out.
const lockOf = (page: string): string => `tracker.page:${page}`;

const lockManager = (): LockManager | undefined =>
  'locks' in navigator ? navigator.locks : undefined;

// From the page's start rather than its first save: asked for only then, the lock could go first
// to a tab that heard of that save, which would take this page for gone.
export function holdPageLock(page: string): void {
  lockManager()
    ?.request(lockOf(page), () => new Promise<never>(() => undefined))
    .catch(() => undefined);
}

const asked = new Set<string>();

// Once per page: the lock comes free only once.
export function whenPageGone(page: string, gone: () => void): void {
  const locks = lockManager();
  if (!locks || asked.has(page)) return;
  asked.add(page);
  locks.request(lockOf(page), gone).catch(() => undefined);
}
