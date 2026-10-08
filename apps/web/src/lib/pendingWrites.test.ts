import { describe, expect, it } from 'vitest';
import { hasPendingWrites, setPendingWrites } from './pendingWrites';

describe('pending writes', () => {
  it('has none at first', () => {
    expect(hasPendingWrites()).toBe(false);
  });

  it('has pending writes until the writer reports it is done', () => {
    const writer = {};
    setPendingWrites(writer, true);
    expect(hasPendingWrites()).toBe(true);
    setPendingWrites(writer, false);
    expect(hasPendingWrites()).toBe(false);
  });

  it('tracks each writer on its own', () => {
    const first = {};
    const second = {};
    setPendingWrites(first, true);
    setPendingWrites(second, true);
    setPendingWrites(first, false);
    expect(hasPendingWrites()).toBe(true);
    setPendingWrites(second, false);
    expect(hasPendingWrites()).toBe(false);
  });

  it('ignores a writer that reports done without having started', () => {
    setPendingWrites({}, false);
    expect(hasPendingWrites()).toBe(false);
  });
});
