import { clamp } from '../gestures/math';

export const EDGE_ZONE = 20;
export const COMPLETE_RATIO = 0.35;
export const FLICK_VELOCITY = 500;

export const isInEdgeZone = (offsetFromEdge: number, zone = EDGE_ZONE): boolean =>
  offsetFromEdge >= 0 && offsetFromEdge <= zone;

export const swipeBackProgress = (dx: number, width: number): number =>
  width <= 0 ? 1 : 1 - clamp(dx / width, 0, 1);

export interface SwipeRelease {
  distance: number;
  width: number;
  velocity: number;
}

export function shouldCompleteBack({ distance, width, velocity }: SwipeRelease): boolean {
  if (distance <= 0) return false;
  if (velocity >= FLICK_VELOCITY) return true;
  if (velocity <= -FLICK_VELOCITY) return false;
  return distance >= width * COMPLETE_RATIO;
}

export const releaseProgressVelocity = (velocityX: number, width: number): number =>
  width <= 0 ? 0 : -velocityX / width;
