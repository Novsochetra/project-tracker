import { afterEach, describe, expect, it } from 'vitest';
import { FOLLOW_SLACK_PX, isAtEnd, scrollParent } from './followEnd';

describe('isAtEnd', () => {
  const box = { scrollHeight: 2_000, clientHeight: 800 };

  it('is at the end within a little slack', () => {
    expect(isAtEnd({ ...box, scrollTop: 1_200 })).toBe(true);
    expect(isAtEnd({ ...box, scrollTop: 1_200 - FOLLOW_SLACK_PX })).toBe(true);
  });

  it('is not once the person scrolled up past it', () => {
    expect(isAtEnd({ ...box, scrollTop: 1_200 - FOLLOW_SLACK_PX - 1 })).toBe(false);
    expect(isAtEnd({ ...box, scrollTop: 0 })).toBe(false);
  });

  it('is for content shorter than the scroller', () => {
    expect(isAtEnd({ scrollHeight: 300, clientHeight: 800, scrollTop: 0 })).toBe(true);
  });
});

describe('scrollParent', () => {
  afterEach(() => document.body.replaceChildren());

  it('finds the nearest box that scrolls up the tree', () => {
    const outer = document.createElement('div');
    outer.style.overflowY = 'auto';
    const inner = document.createElement('div');
    inner.style.overflowY = 'scroll';
    const plain = document.createElement('div');
    const list = document.createElement('ol');
    outer.append(inner);
    inner.append(plain);
    plain.append(list);
    document.body.append(outer);
    expect(scrollParent(list)).toBe(inner);
    expect(scrollParent(inner)).toBe(outer);
  });

  it('finds none outside a scroller', () => {
    const list = document.createElement('ol');
    document.body.append(list);
    expect(scrollParent(list)).toBeNull();
    expect(scrollParent(null)).toBeNull();
  });
});
