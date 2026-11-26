import { clamp } from '../gestures/math';

export type Platform = 'phone' | 'desktop';
export type StackAnimation = 'initial' | 'push' | 'pop' | 'swipe' | 'none';
export type LayerRole = 'top' | 'front' | 'back' | 'hidden';

export interface LayerVisual {
  visible: boolean;
  transform: string;
  opacity: number;
  dim: number;
  shadow: number;
}

export const UNDERLAY_SHIFT = 30;
export const UNDERLAY_DIM = 0.35;
export const DESKTOP_SHIFT = 28;
export const FIRST_LOAD_SHIFT = 6;

const HIDDEN: LayerVisual = { visible: false, transform: 'none', opacity: 1, dim: 0, shadow: 0 };
const AT_REST: LayerVisual = { visible: true, transform: 'none', opacity: 1, dim: 0, shadow: 0 };

const round = (value: number): number => Math.round(value * 1000) / 1000;

function phoneSlide(role: LayerRole, progress: number): LayerVisual {
  if (role === 'front') {
    const x = round((1 - progress) * 100);
    return { ...AT_REST, transform: `translate3d(${x}%, 0, 0)`, shadow: round(progress) };
  }

  if (role === 'back') {
    const x = round(-UNDERLAY_SHIFT * progress);
    return {
      ...AT_REST,
      transform: `translate3d(${x}%, 0, 0)`,
      dim: round(UNDERLAY_DIM * progress),
    };
  }

  return role === 'top' ? AT_REST : HIDDEN;
}

function fadeShift(axis: 'x' | 'y', offset: number, progress: number): LayerVisual {
  const shift = round(offset * (1 - progress));
  const transform =
    axis === 'x' ? `translate3d(${shift}px, 0, 0)` : `translate3d(0, ${shift}px, 0)`;

  return { ...AT_REST, transform, opacity: round(progress) };
}

function desktopVisual(animation: StackAnimation, role: LayerRole, progress: number): LayerVisual {
  if (animation === 'push')
    return role === 'front' ? fadeShift('x', DESKTOP_SHIFT, progress) : HIDDEN;
  if (animation === 'pop')
    return role === 'back' ? fadeShift('x', -DESKTOP_SHIFT, progress) : HIDDEN;

  return phoneSlide(role, progress);
}

export function layerVisual(
  platform: Platform,
  animation: StackAnimation,
  role: LayerRole,
  progress: number,
): LayerVisual {
  const clamped = clamp(progress, 0, 1);
  if (role === 'hidden') return HIDDEN;
  if (animation === 'none') return role === 'top' ? AT_REST : HIDDEN;
  if (animation === 'initial')
    return role === 'front' ? fadeShift('y', FIRST_LOAD_SHIFT, clamped) : HIDDEN;

  return platform === 'phone' ? phoneSlide(role, clamped) : desktopVisual(animation, role, clamped);
}

// On phones progress is how much of the screen the front layer covers, so a pop runs from 1 to 0.
export function progressRange(platform: Platform, animation: StackAnimation): [number, number] {
  if (platform === 'phone' && animation === 'pop') return [1, 0];

  return [0, 1];
}
