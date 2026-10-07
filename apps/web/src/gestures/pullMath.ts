import { clamp, rubberBand } from './math';

export const PULL_THRESHOLD = 70;
export const PULL_HOLD = 56;
const PULL_DIMENSION = 600;

export const pullDistance = (fingerTravel: number): number =>
  fingerTravel <= 0 ? 0 : rubberBand(fingerTravel, PULL_DIMENSION);

export const pullProgress = (distance: number): number => clamp(distance / PULL_THRESHOLD, 0, 1);

export const shouldRefresh = (distance: number): boolean => distance >= PULL_THRESHOLD;

export const crossedThreshold = (previous: number, next: number): boolean =>
  shouldRefresh(previous) !== shouldRefresh(next);
