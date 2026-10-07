export type Route =
  | { name: 'projects' }
  | { name: 'project'; key: string }
  | { name: 'ticket'; key: string; num: number };

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

export function parseRoute(pathname: string): Route {
  const segments = pathname.split('/').filter((segment) => segment !== '');
  if (segments[0] !== 'p' || segments.length < 2 || segments.length > 3) return PROJECTS;
  const key = decodeSegment(segments[1] ?? '');
  if (key === null) return PROJECTS;
  if (segments.length === 2) return { name: 'project', key };
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
  }
}

export function parentRoute(route: Route): Route | null {
  switch (route.name) {
    case 'projects':
      return null;
    case 'project':
      return PROJECTS;
    case 'ticket':
      return { name: 'project', key: route.key };
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
