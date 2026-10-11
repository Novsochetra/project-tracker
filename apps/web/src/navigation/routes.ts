import { INVITE_PATH } from '@tracker/shared';

export type Route =
  | { name: 'projects' }
  | { name: 'project'; key: string }
  | { name: 'ticket'; key: string; num: number }
  | { name: 'chats'; key: string }
  // A new chat has no id until its first question is sent.
  | { name: 'chat'; key: string; chatId: string | null };

export type NavigationKind = 'POP' | 'PUSH' | 'REPLACE';

export type Transition = 'push' | 'pop' | 'replace' | 'none';

const PROJECTS: Route = { name: 'projects' };

function decodeSegment(segment: string): string | null {
  try {
    const decoded = decodeURIComponent(segment).trim();
    return decoded === '' ? null : decoded;
  } catch {
    return null;
  }
}

function parseTicketNumber(segment: string): number | null {
  if (!/^\d+$/.test(segment)) return null;
  const num = Number(segment);
  return Number.isSafeInteger(num) && num > 0 ? num : null;
}

const ASK = 'ask';
const NEW_CHAT = 'new';

function parseAskRoute(key: string, chatSegment: string | undefined): Route {
  if (chatSegment === undefined) return { name: 'chats', key };
  const chatId = decodeSegment(chatSegment);
  if (chatId === null) return { name: 'chats', key };
  return { name: 'chat', key, chatId: chatId === NEW_CHAT ? null : chatId };
}

export function parseRoute(pathname: string): Route {
  const segments = pathname.split('/').filter((segment) => segment !== '');
  if (segments[0] !== 'p' || segments.length < 2 || segments.length > 4) return PROJECTS;
  const key = decodeSegment(segments[1] ?? '');
  if (key === null) return PROJECTS;
  if (segments.length === 2) return { name: 'project', key };
  if (segments[2] === ASK) return parseAskRoute(key, segments[3]);
  if (segments.length > 3) return PROJECTS;
  const num = parseTicketNumber(segments[2] ?? '');
  return num === null ? { name: 'project', key } : { name: 'ticket', key, num };
}

export function routePath(route: Route): string {
  switch (route.name) {
    case 'projects':
      return '/';
    case 'project':
      return `/p/${encodeURIComponent(route.key)}`;
    case 'ticket':
      return `/p/${encodeURIComponent(route.key)}/${route.num}`;
    case 'chats':
      return `/p/${encodeURIComponent(route.key)}/${ASK}`;
    case 'chat':
      return `/p/${encodeURIComponent(route.key)}/${ASK}/${encodeURIComponent(route.chatId ?? NEW_CHAT)}`;
  }
}

// The one spelling of the screen a path shows, or null when the path is already it.
export function canonicalPath(pathname: string): string | null {
  // The invite page stands outside the screens, so its address stays as it is.
  if (pathname === INVITE_PATH) return null;
  const canonical = routePath(parseRoute(pathname));
  return canonical === pathname ? null : canonical;
}

export function parentRoute(route: Route): Route | null {
  switch (route.name) {
    case 'projects':
      return null;
    case 'project':
      return PROJECTS;
    case 'ticket':
    case 'chats':
      return { name: 'project', key: route.key };
    case 'chat':
      return { name: 'chats', key: route.key };
  }
}

export function routeStack(route: Route): Route[] {
  const parent = parentRoute(route);
  return parent === null ? [route] : [...routeStack(parent), route];
}

export function routeDepth(route: Route): number {
  return routeStack(route).length - 1;
}

export function sameRoute(a: Route, b: Route): boolean {
  return routePath(a) === routePath(b);
}

export function transitionFor(
  prev: Route | null,
  next: Route,
  navigationType: NavigationKind,
): Transition {
  if (prev === null || sameRoute(prev, next)) return 'none';
  const delta = routeDepth(next) - routeDepth(prev);
  if (delta > 0) return 'push';
  if (delta < 0) return 'pop';
  if (navigationType === 'PUSH') return 'push';
  if (navigationType === 'POP') return 'pop';
  return 'replace';
}
