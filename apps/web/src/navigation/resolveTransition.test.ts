import { describe, expect, it } from 'vitest';
import { resolveTransition, type TransitionInput } from './resolveTransition';
import type { Route } from './routes';
import { SessionHistory } from './sessionHistory';

const mob: Route = { name: 'project', key: 'MOB' };
const mob3: Route = { name: 'ticket', key: 'MOB', num: 3 };

const input = (overrides: Partial<TransitionInput>): TransitionInput => ({
  prev: mob3,
  prevKey: 'k3',
  next: mob,
  kind: 'POP',
  intent: null,
  reducedMotion: false,
  browserAnimatesPop: false,
  ...overrides,
});

describe('resolveTransition', () => {
  it('animates by depth by default', () => {
    expect(resolveTransition(input({}))).toBe('pop');
    expect(resolveTransition(input({ prev: mob, next: mob3, kind: 'PUSH' }))).toBe('push');
  });

  it('skips the animation for a finished swipe back', () => {
    const intent = { fromKey: 'k3', toPath: '/p/MOB', animate: false };
    expect(resolveTransition(input({ intent }))).toBe('none');
  });

  it('ignores an intent left over from another navigation', () => {
    const intent = { fromKey: 'old', toPath: '/p/MOB', animate: false };
    expect(resolveTransition(input({ intent }))).toBe('pop');
  });

  it('does not animate browser back when the browser animated it', () => {
    expect(resolveTransition(input({ browserAnimatesPop: true }))).toBe('none');
  });

  it('still animates our own back button there', () => {
    const intent = { fromKey: 'k3', toPath: '/p/MOB', animate: true };
    expect(resolveTransition(input({ browserAnimatesPop: true, intent }))).toBe('pop');
  });

  it('never animates with reduced motion', () => {
    expect(resolveTransition(input({ reducedMotion: true }))).toBe('none');
  });
});

describe('SessionHistory', () => {
  it('knows the entry before the current one', () => {
    const history = new SessionHistory();
    history.record('a', '/', 'POP');
    expect(history.previousPath()).toBeNull();
    history.record('b', '/p/MOB', 'PUSH');
    history.record('c', '/p/MOB/3', 'PUSH');
    expect(history.previousPath()).toBe('/p/MOB');
  });

  it('follows back and forward', () => {
    const history = new SessionHistory();
    history.record('a', '/', 'POP');
    history.record('b', '/p/MOB', 'PUSH');
    history.record('a', '/', 'POP');
    expect(history.previousPath()).toBeNull();
    history.record('b', '/p/MOB', 'POP');
    expect(history.previousPath()).toBe('/');
  });

  it('drops forward entries on push and rewrites on replace', () => {
    const history = new SessionHistory();
    history.record('a', '/', 'POP');
    history.record('b', '/p/MOB', 'PUSH');
    history.record('a', '/', 'POP');
    history.record('c', '/p/WEB', 'PUSH');
    history.record('d', '/p/WEB/2', 'PUSH');
    expect(history.previousPath()).toBe('/p/WEB');
    history.record('e', '/p/APP', 'REPLACE');
    expect(history.previousPath()).toBe('/p/WEB');
  });

  it('starts over on an unknown entry, like after a reload', () => {
    const history = new SessionHistory();
    history.record('a', '/', 'POP');
    history.record('b', '/p/MOB', 'PUSH');
    history.record('zz', '/p/MOB/3', 'POP');
    expect(history.previousPath()).toBeNull();
  });

  it('ignores repeated records of the same entry', () => {
    const history = new SessionHistory();
    history.record('a', '/', 'POP');
    history.record('b', '/p/MOB', 'PUSH');
    history.record('b', '/p/MOB', 'PUSH');
    expect(history.previousPath()).toBe('/');
  });
});
