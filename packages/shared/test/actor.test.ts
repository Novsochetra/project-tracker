import { describe, expect, it } from 'vitest';
import { isPersonWord } from '../src/domain/actor';

describe('isPersonWord', () => {
  it.each(['You', 'user', ' USER ', 'yOu'])('knows %j names the person', (name) => {
    expect(isPersonWord(name)).toBe(true);
  });

  it.each(['Claude', 'Agent', 'Users', 'Youssef', 'Claude user', ''])('lets %j be', (name) => {
    expect(isPersonWord(name)).toBe(false);
  });
});
