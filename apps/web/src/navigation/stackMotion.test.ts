import { describe, expect, it } from 'vitest';
import {
  COMPLETE_RATIO,
  FLICK_VELOCITY,
  isInEdgeZone,
  releaseProgressVelocity,
  shouldCompleteBack,
  swipeBackProgress,
} from './edgeSwipe';
import { layerVisual, progressRange } from './stackMotion';

describe('layerVisual on phones', () => {
  it('slides the front screen in from the right edge with a shadow', () => {
    expect(layerVisual('phone', 'push', 'front', 0)).toMatchObject({
      visible: true,
      transform: 'translate3d(100%, 0, 0)',
      shadow: 0,
    });
    expect(layerVisual('phone', 'push', 'front', 0.5).transform).toBe('translate3d(50%, 0, 0)');
    expect(layerVisual('phone', 'push', 'front', 1)).toMatchObject({
      transform: 'translate3d(0%, 0, 0)',
      shadow: 1,
    });
  });

  it('parallaxes and dims the screen underneath', () => {
    expect(layerVisual('phone', 'swipe', 'back', 1)).toMatchObject({
      transform: 'translate3d(-30%, 0, 0)',
      dim: 0.35,
    });
    expect(layerVisual('phone', 'swipe', 'back', 0)).toMatchObject({ dim: 0 });
    expect(layerVisual('phone', 'pop', 'back', 0.5).transform).toBe('translate3d(-15%, 0, 0)');
  });

  it('clamps progress', () => {
    expect(layerVisual('phone', 'swipe', 'front', 1.4).transform).toBe('translate3d(0%, 0, 0)');
    expect(layerVisual('phone', 'swipe', 'front', -1).transform).toBe('translate3d(100%, 0, 0)');
  });

  it('shows only the top screen at rest', () => {
    expect(layerVisual('phone', 'none', 'top', 0)).toMatchObject({
      visible: true,
      transform: 'none',
    });
    expect(layerVisual('phone', 'none', 'back', 1).visible).toBe(false);
    expect(layerVisual('phone', 'push', 'hidden', 1).visible).toBe(false);
  });

  it('runs pops backwards', () => {
    expect(progressRange('phone', 'pop')).toEqual([1, 0]);
    expect(progressRange('phone', 'push')).toEqual([0, 1]);
  });
});

describe('layerVisual on desktop', () => {
  it('fades a pushed screen in from +28px and hides the old one', () => {
    expect(layerVisual('desktop', 'push', 'front', 0)).toMatchObject({
      transform: 'translate3d(28px, 0, 0)',
      opacity: 0,
    });
    expect(layerVisual('desktop', 'push', 'back', 0.5).visible).toBe(false);
  });

  it('fades the revealed screen in from -28px on pop and hides the leaving one', () => {
    expect(layerVisual('desktop', 'pop', 'back', 0)).toMatchObject({
      transform: 'translate3d(-28px, 0, 0)',
      opacity: 0,
    });
    expect(layerVisual('desktop', 'pop', 'front', 0).visible).toBe(false);
    expect(progressRange('desktop', 'pop')).toEqual([0, 1]);
  });

  it('fades the first screen up 6px', () => {
    expect(layerVisual('desktop', 'initial', 'front', 0)).toMatchObject({
      transform: 'translate3d(0, 6px, 0)',
      opacity: 0,
    });
    expect(layerVisual('phone', 'initial', 'front', 1)).toMatchObject({ opacity: 1 });
  });
});

describe('edge swipe decisions', () => {
  it('only starts near the left edge', () => {
    expect(isInEdgeZone(0)).toBe(true);
    expect(isInEdgeZone(20)).toBe(true);
    expect(isInEdgeZone(21)).toBe(false);
    expect(isInEdgeZone(-1)).toBe(false);
  });

  it('maps finger travel to coverage', () => {
    expect(swipeBackProgress(0, 375)).toBe(1);
    expect(swipeBackProgress(150, 375)).toBeCloseTo(0.6);
    expect(swipeBackProgress(-20, 375)).toBe(1);
    expect(swipeBackProgress(500, 375)).toBe(0);
  });

  it('completes past 35% of the width', () => {
    const width = 400;
    const past = width * COMPLETE_RATIO;
    expect(shouldCompleteBack({ distance: past, width, velocity: 0 })).toBe(true);
    expect(shouldCompleteBack({ distance: past - 1, width, velocity: 0 })).toBe(false);
  });

  it('follows a flick in either direction', () => {
    const width = 400;
    expect(shouldCompleteBack({ distance: 40, width, velocity: FLICK_VELOCITY })).toBe(true);
    expect(shouldCompleteBack({ distance: 300, width, velocity: -FLICK_VELOCITY })).toBe(false);
    expect(shouldCompleteBack({ distance: 0, width, velocity: 2000 })).toBe(false);
  });

  it('turns finger velocity into progress velocity', () => {
    expect(releaseProgressVelocity(800, 400)).toBe(-2);
    expect(releaseProgressVelocity(800, 0)).toBe(0);
  });
});
