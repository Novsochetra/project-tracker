import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { REDUCED_MOTION_QUERY } from '../lib/media';
import { crossFade } from './crossFade';
import { fakeMedia } from './test/fakeMedia';

let media: ReturnType<typeof fakeMedia>;

beforeEach(() => {
  media = fakeMedia(window);
});

afterEach(() => {
  media.restore();
  Reflect.deleteProperty(document, 'startViewTransition');
});

const withViewTransitions = () => {
  const start = vi.fn((update: () => void) => update());
  Object.defineProperty(document, 'startViewTransition', { configurable: true, value: start });

  return start;
};

describe('crossFade', () => {
  it('fades the whole screen from the old colors to the new ones', () => {
    const start = withViewTransitions();
    const update = vi.fn();
    crossFade(document, update);
    expect(start).toHaveBeenCalledWith(update);
    expect(update).toHaveBeenCalledOnce();
  });

  it('changes at once for reduced motion', () => {
    const start = withViewTransitions();
    media.set(REDUCED_MOTION_QUERY, true);
    const update = vi.fn();
    crossFade(document, update);
    expect(start).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledOnce();
  });

  it('changes at once where the browser has no view transitions', () => {
    const update = vi.fn();
    crossFade(document, update);
    expect(update).toHaveBeenCalledOnce();
  });
});
