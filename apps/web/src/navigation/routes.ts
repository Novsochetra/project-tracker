import { INVITE_PATH, RESET_PATH } from '@tracker/shared';

export type Route =
  | { name: 'projects' }
  | { name: 'activity' }
  | { name: 'project'; key: string }
  | { name: 'ticket'; key: string; num: number }
  | { name: 'chats'; key: string }
  // A new chat has no id until its first question is sent. One opened from a ticket screen keeps
  // the ticket's number, so Back returns to that ticket (PT-184).
  | { name: 'chat'; key: string; chatId: string | null; ticketNum?: number };

export type NavigationKind = 'POP' | 'PUSH' | 'REPLACE';

export type Transition = 'push' | 'pop' | 'replace' | 'none';

const PROJECTS: Route = { name: 'projects' };
const ACTIVITY_SEGMENT = 'activity';

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

function parseAskRoute(key: string, chatSegment: string | undefined, ticketNum: number | null) {
  const above: Route =
    ticketNum === null ? { name: 'chats', key } : { name: 'ticket', key, num: ticketNum };
  const decoded = chatSegment === undefined ? null : decodeSegment(chatSegment);
  if (decoded === null) return above;
  const chatId = decoded === NEW_CHAT ? null : decoded;
  const chat: Route = { name: 'chat', key, chatId };
  return ticketNum === null ? chat : { ...chat, ticketNum };
}

function parseTicketPath(key: string, segments: string[]): Route {
  const num = parseTicketNumber(segments[2] ?? '');
  if (segments.length === 3)
    return num === null ? { name: 'project', key } : { name: 'ticket', key, num };
  return num !== null && segments[3] === ASK ? parseAskRoute(key, segments[4], num) : PROJECTS;
}

export function parseRoute(pathname: string): Route {
  const segments = pathname.split('/').filter((segment) => segment !== '');
  if (segments.length === 1 && segments[0] === ACTIVITY_SEGMENT) return { name: 'activity' };
  if (segments[0] !== 'p' || segments.length < 2 || segments.length > 5) return PROJECTS;
  const key = decodeSegment(segments[1] ?? '');
  if (key === null) return PROJECTS;
  if (segments.length === 2) return { name: 'project', key };
  if (segments[2] !== ASK) return parseTicketPath(key, segments);
  return segments.length > 4 ? PROJECTS : parseAskRoute(key, segments[3], null);
}

function chatPath(route: Extract<Route, { name: 'chat' }>): string {
  const above = route.ticketNum === undefined ? '' : `/${route.ticketNum}`;
  const chat = encodeURIComponent(route.chatId ?? NEW_CHAT);
  return `/p/${encodeURIComponent(route.key)}${above}/${ASK}/${chat}`;
}

export function routePath(route: Route): string {
  switch (route.name) {
    case 'projects':
      return '/';
    case 'activity':
      return `/${ACTIVITY_SEGMENT}`;
    case 'project':
      return `/p/${encodeURIComponent(route.key)}`;
    case 'ticket':
      return `/p/${encodeURIComponent(route.key)}/${route.num}`;
    case 'chats':
      return `/p/${encodeURIComponent(route.key)}/${ASK}`;
    case 'chat':
      return chatPath(route);
  }
}

// The one spelling of the screen a path shows, or null when the path is already it.
export function canonicalPath(pathname: string): string | null {
  // The link pages stand outside the screens, so their addresses stay as they are.
  if (pathname === INVITE_PATH || pathname === RESET_PATH) return null;
  const canonical = routePath(parseRoute(pathname));
  return canonical === pathname ? null : canonical;
}

export function parentRoute(route: Route): Route | null {
  switch (route.name) {
    case 'projects':
    case 'activity':
      return null;
    case 'project':
      return PROJECTS;
    case 'ticket':
    case 'chats':
      return { name: 'project', key: route.key };
    case 'chat':
      return route.ticketNum === undefined
        ? { name: 'chats', key: route.key }
        : { name: 'ticket', key: route.key, num: route.ticketNum };
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
