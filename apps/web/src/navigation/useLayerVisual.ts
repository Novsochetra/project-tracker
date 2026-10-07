import type { MotionValue } from 'motion/react';
import { useLayoutEffect, type RefObject } from 'react';
import {
  layerVisual,
  type LayerRole,
  type LayerVisual,
  type Platform,
  type StackAnimation,
} from './stackMotion';

export interface LayerRefs {
  layer: RefObject<HTMLDivElement | null>;
  dim: RefObject<HTMLDivElement | null>;
  shadow: RefObject<HTMLDivElement | null>;
}

export interface LayerMotion {
  platform: Platform;
  animation: StackAnimation;
  role: LayerRole;
  progress: MotionValue<number>;
}

function applyVisual(refs: LayerRefs, visual: LayerVisual, moving: boolean): void {
  const layer = refs.layer.current;
  if (!layer) return;
  layer.style.visibility = visual.visible ? '' : 'hidden';
  layer.style.transform = visual.transform === 'none' ? '' : visual.transform;
  layer.style.opacity = visual.opacity === 1 ? '' : String(visual.opacity);
  layer.style.willChange = moving ? 'transform, opacity' : '';
  if (refs.dim.current) refs.dim.current.style.opacity = String(visual.dim);
  if (refs.shadow.current) refs.shadow.current.style.opacity = String(visual.shadow);
}

// Styles are written straight to the DOM from the progress value: a synchronous subscription
// keeps the first frame of a transition correct and avoids a React render per frame.
export function useLayerVisual(refs: LayerRefs, motion: LayerMotion): void {
  const { platform, animation, role, progress } = motion;
  useLayoutEffect(() => {
    const moving = animation !== 'none' && role !== 'hidden' && role !== 'top';
    const apply = (value: number) =>
      applyVisual(refs, layerVisual(platform, animation, role, value), moving);
    apply(progress.get());
    return progress.on('change', apply);
  }, [refs, platform, animation, role, progress]);
}
