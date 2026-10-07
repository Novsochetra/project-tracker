import { clamp, rubberBand } from '../gestures/math';

export const DISMISS_RATIO = 0.25;
export const DISMISS_VELOCITY = 800;
const KEEP_VELOCITY = -400;
const STRETCH_DIMENSION = 80;

export const sheetOffset = (fingerTravel: number): number =>
  fingerTravel >= 0 ? fingerTravel : rubberBand(fingerTravel, STRETCH_DIMENSION);

export interface SheetRelease {
  offset: number;
  height: number;
  velocity: number;
}

export function shouldDismissSheet({ offset, height, velocity }: SheetRelease): boolean {
  if (offset <= 0) return false;
  if (velocity >= DISMISS_VELOCITY) return true;
  if (velocity <= KEEP_VELOCITY) return false;
  return offset >= height * DISMISS_RATIO;
}

export const scrimOpacity = (offset: number, height: number): number =>
  height <= 0 ? 1 : 1 - clamp(offset / height, 0, 1);
