import { API_CACHE, ATTACHMENT_CACHE } from './cacheNames';

const SESSION_PATH = '/api/session';

// The service worker answers reads from these while the tracker can't be reached. Once signed out,
// nothing the owner read may come back from them, to whoever holds the phone next. The one answer
// put back is the signed-out session, so a start without the network shows the sign-in screen
// rather than an empty app: written here, it costs no request.
export async function forgetSavedAnswers(
  signedOut: unknown,
  storage: CacheStorage | undefined = globalThis.caches,
): Promise<void> {
  if (!storage) return;
  try {
    await Promise.all([storage.delete(API_CACHE), storage.delete(ATTACHMENT_CACHE)]);
    const cache = await storage.open(API_CACHE);
    await cache.put(new Request(new URL(SESSION_PATH, location.origin)), Response.json(signedOut));
  } catch {
    // Storage turned off or full: there is nothing saved to forget, or nothing more to do.
  }
}
