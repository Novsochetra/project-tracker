import { describe, expect, it } from 'vitest';
import { armClickGuard, consumeClickGuard } from './clickGuard';

describe('click guard', () => {
  it('lets clicks through when no drag ended', () => {
    expect(consumeClickGuard(1_000)).toBe(false);
  });

  it('swallows the click that follows a drag within 400ms', () => {
    armClickGuard(1_000);
    expect(consumeClickGuard(1_050)).toBe(true);
  });

  it('swallows only one click', () => {
    armClickGuard(1_000);
    expect(consumeClickGuard(1_010)).toBe(true);
    expect(consumeClickGuard(1_020)).toBe(false);
  });

  it('expires after 400ms', () => {
    armClickGuard(1_000);
    expect(consumeClickGuard(1_400)).toBe(false);
  });
});
