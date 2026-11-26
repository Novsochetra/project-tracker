import { describe, expect, it } from 'vitest';
import { SessionHistory } from './sessionHistory';

function visited(): SessionHistory {
  const history = new SessionHistory();
  history.record('a', '/', 'POP');
  history.record('b', '/p/PT', 'PUSH');
  history.record('c', '/p/PT/1', 'PUSH');

  return history;
}

describe('SessionHistory', () => {
  it('knows the entries on both sides after going back', () => {
    const history = visited();
    history.record('b', '/p/PT', 'POP');
    expect(history.previousPath()).toBe('/');
    expect(history.nextPath()).toBe('/p/PT/1');
  });

  it('has no next entry at the newest one', () => {
    expect(visited().nextPath()).toBeNull();
  });

  it('drops the forward entries when a push follows a back', () => {
    const history = visited();
    history.record('b', '/p/PT', 'POP');
    history.record('d', '/p/PT/2', 'PUSH');
    expect(history.nextPath()).toBeNull();
    expect(history.previousPath()).toBe('/p/PT');
  });
});
