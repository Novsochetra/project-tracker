import { describe, expect, it } from 'vitest';
import { isPriority, PRIORITIES } from '../src/domain/priority';

describe('isPriority', () => {
  it('takes each priority and nothing else', () => {
    for (const priority of PRIORITIES) expect(isPriority(priority)).toBe(true);
    expect(isPriority('urgent')).toBe(false);
    expect(isPriority('High')).toBe(false);
    expect(isPriority(undefined)).toBe(false);
  });
});
