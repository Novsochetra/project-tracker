import { afterEach, describe, expect, it } from 'vitest';
import { scrollParent } from './scrollParent';

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
