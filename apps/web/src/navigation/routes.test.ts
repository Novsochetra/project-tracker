import { describe, expect, it } from 'vitest';
import {
  canonicalPath,
  parentRoute,
  parseRoute,
  routeDepth,
  routePath,
  routeStack,
  transitionFor,
  type Route,
} from './routes';

const projects: Route = { name: 'projects' };
const activity: Route = { name: 'activity' };
const mob: Route = { name: 'project', key: 'MOB' };
const mob3: Route = { name: 'ticket', key: 'MOB', num: 3 };
const mob4: Route = { name: 'ticket', key: 'MOB', num: 4 };
const web: Route = { name: 'project', key: 'WEB' };
const ask: Route = { name: 'chats', key: 'MOB' };
const chat: Route = { name: 'chat', key: 'MOB', chatId: 'c-1' };
const newChat: Route = { name: 'chat', key: 'MOB', chatId: null };
const ticketChat: Route = { name: 'chat', key: 'MOB', chatId: 'c-1', ticketNum: 3 };
const newTicketChat: Route = { name: 'chat', key: 'MOB', chatId: null, ticketNum: 3 };

describe('parseRoute', () => {
  it.each([
    ['/', projects],
    ['', projects],
    ['/p/MOB', mob],
    ['/p/MOB/', mob],
    ['/p/MOB/3', mob3],
    ['/p/MOB/3/', mob3],
    ['/p/MOB2/12', { name: 'ticket', key: 'MOB2', num: 12 }],
    ['/activity', activity],
    ['/activity/', activity],
    ['/p/MOB/ask', ask],
    ['/p/MOB/ask/', ask],
    ['/p/MOB/ask/c-1', chat],
    ['/p/MOB/ask/new', newChat],
    ['/p/MOB/3/ask/c-1', ticketChat],
    ['/p/MOB/3/ask/new/', newTicketChat],
    ['/p/MOB/3/ask', mob3],
  ])('parses %s', (path, route) => {
    expect(parseRoute(path)).toEqual(route);
  });

  it('decodes the project key', () => {
    expect(parseRoute('/p/A%20B')).toEqual({ name: 'project', key: 'A B' });
  });

  it.each(['/p/MOB/0', '/p/MOB/abc', '/p/MOB/-1', '/p/MOB/1.5'])(
    'falls back to the project for a bad ticket number in %s',
    (path) => {
      expect(parseRoute(path)).toEqual(mob);
    },
  );

  it.each([
    '/x',
    '/p',
    '/p/MOB/3/extra',
    '/p/%E0%A4%A',
    '/projects/MOB',
    '/p/MOB/ask/c-1/x',
    '/p/MOB/0/ask/c-1',
    '/p/MOB/3/ask/c-1/x',
  ])('falls back to Projects for %s', (path) => {
    expect(parseRoute(path)).toEqual(projects);
  });
});

describe('routePath', () => {
  it('builds paths that parse back to the same route', () => {
    for (const route of [
      projects,
      activity,
      mob,
      mob3,
      ask,
      chat,
      newChat,
      ticketChat,
      newTicketChat,
    ]) {
      expect(parseRoute(routePath(route))).toEqual(route);
    }
    for (const route of [{ name: 'project', key: 'A B' } as Route]) {
      expect(parseRoute(routePath(route))).toEqual(route);
    }
  });

  it('builds the documented URLs', () => {
    expect(routePath(projects)).toBe('/');
    expect(routePath(mob)).toBe('/p/MOB');
    expect(routePath(mob3)).toBe('/p/MOB/3');
    expect(routePath(ask)).toBe('/p/MOB/ask');
    expect(routePath(chat)).toBe('/p/MOB/ask/c-1');
    expect(routePath(newChat)).toBe('/p/MOB/ask/new');
    expect(routePath(ticketChat)).toBe('/p/MOB/3/ask/c-1');
    expect(routePath(newTicketChat)).toBe('/p/MOB/3/ask/new');
  });
});

describe('stack helpers', () => {
  it('finds the parent of each level', () => {
    expect(parentRoute(projects)).toBeNull();
    expect(parentRoute(mob)).toEqual(projects);
    expect(parentRoute(mob3)).toEqual(mob);
  });

  it('builds the stack from Projects down', () => {
    expect(routeStack(projects)).toEqual([projects]);
    expect(routeStack(mob3)).toEqual([projects, mob, mob3]);
    expect(routeStack(chat)).toEqual([projects, mob, ask, chat]);
    expect(routeStack(ticketChat)).toEqual([projects, mob, mob3, ticketChat]);
  });

  it('measures depth', () => {
    expect(routeDepth(projects)).toBe(0);
    expect(routeDepth(mob)).toBe(1);
    expect(routeDepth(mob3)).toBe(2);
  });
});

describe('transitionFor', () => {
  it('does not animate the first screen or the same route', () => {
    expect(transitionFor(null, mob, 'POP')).toBe('none');
    expect(transitionFor(mob, mob, 'PUSH')).toBe('none');
  });

  it('pushes when going deeper, whatever the history action', () => {
    expect(transitionFor(projects, mob, 'PUSH')).toBe('push');
    expect(transitionFor(mob, mob3, 'POP')).toBe('push');
    expect(transitionFor(projects, mob3, 'REPLACE')).toBe('push');
  });

  it('pops when going up, whatever the history action', () => {
    expect(transitionFor(mob3, mob, 'POP')).toBe('pop');
    expect(transitionFor(mob3, mob, 'REPLACE')).toBe('pop');
    expect(transitionFor(mob, projects, 'PUSH')).toBe('pop');
  });

  it('uses the history action between screens at the same depth', () => {
    expect(transitionFor(mob3, mob4, 'PUSH')).toBe('push');
    expect(transitionFor(mob4, mob3, 'POP')).toBe('pop');
    expect(transitionFor(mob, web, 'REPLACE')).toBe('replace');
  });
});

describe('canonicalPath', () => {
  it('keeps the paths of real routes', () => {
    for (const path of ['/', '/p/MOB', '/p/mob', '/p/MOB/3', '/p/A%20B', '/p/caf%C3%A9']) {
      expect(canonicalPath(path)).toBeNull();
    }
  });

  it('keeps the invite page, which stands outside the screens', () => {
    expect(canonicalPath('/invite')).toBeNull();
    expect(canonicalPath('/reset-password')).toBeNull();
  });

  it('replaces paths that are not a route with the screen they show', () => {
    expect(canonicalPath('/x/y/z')).toBe('/');
    expect(canonicalPath('/p/MOB/3/extra')).toBe('/');
    expect(canonicalPath('/p/%E0%A4%A')).toBe('/');
    expect(canonicalPath('/p/MOB/abc')).toBe('/p/MOB');
    expect(canonicalPath('/p/MOB/3/')).toBe('/p/MOB/3');
    expect(canonicalPath('/p/MOB/03')).toBe('/p/MOB/3');
  });

  it('settles on one path, so replacing never loops', () => {
    for (const path of ['/x', '/p/MOB/', '/p/MOB%2D1', '/p/A@B', '/p/%20MOB']) {
      const target = canonicalPath(path);
      expect(target).not.toBeNull();
      expect(canonicalPath(target ?? '')).toBeNull();
    }
  });
});
