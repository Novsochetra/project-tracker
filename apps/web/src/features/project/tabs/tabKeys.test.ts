import { describe, expect, it } from 'vitest';
import { tabIndexForKey } from './tabKeys';

describe('tabIndexForKey', () => {
  it('moves to the next and previous tab with → and ←, wrapping at the ends', () => {
    expect(tabIndexForKey('ArrowRight', 0, 6)).toBe(1);
    expect(tabIndexForKey('ArrowRight', 5, 6)).toBe(0);
    expect(tabIndexForKey('ArrowLeft', 3, 6)).toBe(2);
    expect(tabIndexForKey('ArrowLeft', 0, 6)).toBe(5);
  });

  it('jumps to the first and last tab with Home and End', () => {
    expect(tabIndexForKey('Home', 4, 6)).toBe(0);
    expect(tabIndexForKey('End', 1, 6)).toBe(5);
  });

  it('leaves other keys to the page, ↑ and ↓ included', () => {
    expect(tabIndexForKey('ArrowUp', 2, 6)).toBeNull();
    expect(tabIndexForKey('ArrowDown', 2, 6)).toBeNull();
    expect(tabIndexForKey('Enter', 2, 6)).toBeNull();
    expect(tabIndexForKey('a', 2, 6)).toBeNull();
  });

  it('has nowhere to go without tabs', () => {
    expect(tabIndexForKey('ArrowRight', 0, 0)).toBeNull();
  });
});
