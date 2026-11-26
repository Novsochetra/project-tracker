import { describe, expect, it } from 'vitest';
import { FOLLOW_SLACK_PX, isAtEnd } from './followEnd';

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
