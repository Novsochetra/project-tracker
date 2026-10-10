import { describe, expect, it } from 'vitest';
import { shrinkFrames } from './gentleShrink';

describe('shrinkFrames', () => {
  it('eases a list that got shorter from its old height to its new one', () => {
    expect(shrinkFrames(584, 182)).toEqual([{ height: '584px' }, { height: '182px' }]);
  });

  it('leaves a first measure, the same height and growth alone', () => {
    expect(shrinkFrames(null, 182)).toBeNull();
    expect(shrinkFrames(182, 182)).toBeNull();
    expect(shrinkFrames(182, 240)).toBeNull();
  });
});
