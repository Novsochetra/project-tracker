import { describe, expect, it } from 'vitest';
import { openNotReviewed } from '../src/logic/projectCounts';

describe('openNotReviewed', () => {
  it('leaves the reviewed tickets out of the open count', () => {
    expect(openNotReviewed(180, 178)).toBe(2);
    expect(openNotReviewed(3, 0)).toBe(3);
  });

  it('never goes below 0 or above the open count while a count is behind', () => {
    expect(openNotReviewed(1, 4)).toBe(0);
    expect(openNotReviewed(2, -1)).toBe(2);
  });
});
