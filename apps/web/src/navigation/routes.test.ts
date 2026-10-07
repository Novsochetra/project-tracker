import { describe, expect, it } from 'vitest';
import {
  parentRoute,
  parseRoute,
  routeDepth,
  routePath,
  routeStack,
  transitionFor,
  type Route,
} from './routes';

const projects: Route = { name: 'projects' };
const mob: Route = { name: 'project', key: 'MOB' };
const mob3: Route = { name: 'ticket', key: 'MOB', num: 3 };
const mob4: Route = { name: 'ticket', key: 'MOB', num: 4 };
const web: Route = { name: 'project', key: 'WEB' };

describe('parseRoute', () => {
  it.each([
    ['/', projects],
    ['', projects],
    ['/p/MOB', mob],
    ['/p/MOB/', mob],
    ['/p/MOB/3', mob3],
    ['/p/MOB/3/', mob3],
    ['/p/MOB2/12', { name: 'ticket', key: 'MOB2', num: 12 }],
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

  it.each(['/x', '/p', '/p/MOB/3/extra', '/p/%E0%A4%A', '/projects/MOB'])(
    'falls back to Projects for %s',
    (path) => {
      expect(parseRoute(path)).toEqual(projects);
    },
  );
});

describe('routePath', () => {
  it('builds paths that parse back to the same route', () => {
    for (const route of [projects, mob, mob3, { name: 'project', key: 'A B' } as Route]) {
      expect(parseRoute(routePath(route))).toEqual(route);
    }
  });

  it('builds the documented URLs', () => {
    expect(routePath(projects)).toBe('/');
    expect(routePath(mob)).toBe('/p/MOB');
    expect(routePath(mob3)).toBe('/p/MOB/3');
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
