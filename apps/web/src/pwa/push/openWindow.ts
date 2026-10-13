import { OPEN_MESSAGE, type OpenMessage } from './openMessage';
import type { ClientsLike } from './workerTypes';

// An open window of the app shows the page itself, keeping its screens and typed text; with none,
// the app starts on that page.
export async function openInApp(clients: ClientsLike, origin: string, path: string): Promise<void> {
  const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });
  const open = windows.find((client) => new URL(client.url).origin === origin);
  if (!open) {
    await clients.openWindow(path);
    return;
  }
  await open.focus();
  open.postMessage({ type: OPEN_MESSAGE, path } satisfies OpenMessage);
}
