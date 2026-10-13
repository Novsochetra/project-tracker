import { appPathOf } from './openMessage';

export interface ShownNotification {
  title: string;
  options: NotificationOptions;
}

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

// A push the tracker sent holds { title, body, url, tag } (PushMessage in @tracker/shared). A push
// must always show something on iOS, or it stops delivering them, so anything else shows a plain one.
export function notificationOf(read: () => unknown): ShownNotification {
  let data: Record<string, unknown> = {};
  try {
    const value = read();
    if (typeof value === 'object' && value !== null) data = value as Record<string, unknown>;
  } catch {
    // Not JSON: the plain notification below.
  }
  const tag = text(data.tag);
  return {
    title: text(data.title) || 'Tracker',
    options: {
      body: text(data.body),
      icon: '/icon-192.png',
      data: { path: appPathOf(data.url) ?? '/' },
      ...(tag ? { tag } : {}),
    },
  };
}

export const pathOfNotification = (data: unknown): string =>
  appPathOf((data as { path?: unknown } | null)?.path) ?? '/';
