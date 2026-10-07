import { clamp, rubberBand, rubberBandClamp, type Point } from './math';

export interface Size {
  width: number;
  height: number;
}

/** Scale and pan of a centred image; x and y are measured from the viewport centre. */
export interface ZoomState {
  scale: number;
  x: number;
  y: number;
}

export const MIN_SCALE = 1;
export const MAX_SCALE = 4;
export const DOUBLE_TAP_SCALE = 2.5;
export const IDENTITY: ZoomState = { scale: 1, x: 0, y: 0 };

export function fitSize(natural: Size, viewport: Size): Size {
  if (natural.width <= 0 || natural.height <= 0) return { width: 0, height: 0 };
  const ratio = Math.min(viewport.width / natural.width, viewport.height / natural.height);
  return { width: natural.width * ratio, height: natural.height * ratio };
}

export function panLimits(base: Size, viewport: Size, scale: number): Point {
  return {
    x: Math.max(0, (base.width * scale - viewport.width) / 2),
    y: Math.max(0, (base.height * scale - viewport.height) / 2),
  };
}

export function clampPan(state: ZoomState, base: Size, viewport: Size): ZoomState {
  const limits = panLimits(base, viewport, state.scale);
  return {
    scale: state.scale,
    x: clamp(state.x, -limits.x, limits.x),
    y: clamp(state.y, -limits.y, limits.y),
  };
}

export function rubberPan(state: ZoomState, base: Size, viewport: Size): ZoomState {
  const limits = panLimits(base, viewport, state.scale);
  return {
    scale: state.scale,
    x: rubberBandClamp(state.x, -limits.x, limits.x, viewport.width),
    y: rubberBandClamp(state.y, -limits.y, limits.y, viewport.height),
  };
}

export function rubberScale(raw: number): number {
  if (raw < MIN_SCALE) return MIN_SCALE - rubberBand(MIN_SCALE - raw, MIN_SCALE);
  if (raw > MAX_SCALE) return MAX_SCALE + rubberBand(raw - MAX_SCALE, MAX_SCALE);
  return raw;
}

export function zoomAround(state: ZoomState, anchor: Point, scale: number): ZoomState {
  const ratio = scale / state.scale;
  return {
    scale,
    x: anchor.x - (anchor.x - state.x) * ratio,
    y: anchor.y - (anchor.y - state.y) * ratio,
  };
}

export function pinchState(
  start: ZoomState,
  startMid: Point,
  mid: Point,
  scale: number,
): ZoomState {
  const ratio = scale / start.scale;
  return {
    scale,
    x: mid.x - (startMid.x - start.x) * ratio,
    y: mid.y - (startMid.y - start.y) * ratio,
  };
}

export function settleZoom(state: ZoomState, anchor: Point, base: Size, viewport: Size): ZoomState {
  if (state.scale <= MIN_SCALE) return IDENTITY;
  const scaled = state.scale > MAX_SCALE ? zoomAround(state, anchor, MAX_SCALE) : state;
  return clampPan(scaled, base, viewport);
}

export function doubleTapZoom(state: ZoomState, tap: Point, base: Size, viewport: Size): ZoomState {
  if (state.scale > MIN_SCALE + 0.01) return IDENTITY;
  return clampPan(zoomAround(state, tap, DOUBLE_TAP_SCALE), base, viewport);
}

export const isZoomed = (state: ZoomState): boolean => state.scale > MIN_SCALE + 0.01;
