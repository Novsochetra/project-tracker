import { glide, spring } from '../gestures/animation';
import { distance, lockAxis, midpoint, rubberBand, type Point } from '../gestures/math';
import { VelocityTracker } from '../gestures/velocity';
import {
  IDENTITY,
  isZoomed,
  panLimits,
  pinchState,
  rubberPan,
  rubberScale,
  settleZoom,
  type Size,
  type ZoomState,
} from '../gestures/zoomMath';
import {
  dismissProgress,
  dismissScale,
  PAGE_GAP,
  pageTarget,
  shouldDismissViewer,
  TAP_SLOP,
  type Tap,
} from './viewerMath';
import {
  animateZoom,
  readZoom,
  resetDismiss,
  setZoom,
  stopZoom,
  type ViewerValues,
} from './viewerValues';

export interface ViewerGestureContext {
  values: ViewerValues;
  index: number;
  count: number;
  viewport: Size;
  base: Size;
  reducedMotion: boolean;
  onIndexChange: (index: number) => void;
  onDismiss: (velocityY: number) => void;
  onToggleChrome: () => void;
}

export type GestureMode = 'idle' | 'pending' | 'pan' | 'page' | 'dismiss' | 'pinch' | 'blocked';

export interface GestureState {
  mode: GestureMode;
  pointers: Map<number, Point>;
  tracker: VelocityTracker;
  start: Tap;
  startZoom: ZoomState;
  startTrack: number;
  pinch: { distance: number; mid: Point; zoom: ZoomState } | null;
  lastMid: Point;
}

export const createGestureState = (): GestureState => ({
  mode: 'idle',
  pointers: new Map(),
  tracker: new VelocityTracker(),
  start: { x: 0, y: 0, t: 0 },
  startZoom: IDENTITY,
  startTrack: 0,
  pinch: null,
  lastMid: { x: 0, y: 0 },
});

const PAGE_SPRING = { visualDuration: 0.36, restDelta: 0.5 };

export const fromCentre = (viewport: Size, point: Point): Point => ({
  x: point.x - viewport.width / 2,
  y: point.y - viewport.height / 2,
});

export const pageStride = (viewport: Size): number => viewport.width + PAGE_GAP;

export interface TrackMotion {
  reduced: boolean;
  velocity?: number;
}

export function snapTrack(values: ViewerValues, page: number, stride: number, motion: TrackMotion) {
  const to = -page * stride;
  if (motion.reduced) values.track.set(to);
  else if (motion.velocity === undefined) spring(values.track, to, PAGE_SPRING);
  else spring(values.track, to, { ...PAGE_SPRING, velocity: motion.velocity });
}

function twoPointers(state: GestureState): [Point, Point] | null {
  const [a, b] = [...state.pointers.values()];
  return a && b ? [a, b] : null;
}

export function beginPinch(state: GestureState, ctx: ViewerGestureContext): void {
  const pair = twoPointers(state);
  if (!pair) return;
  if (state.mode === 'page') {
    snapTrack(ctx.values, ctx.index, pageStride(ctx.viewport), { reduced: ctx.reducedMotion });
  }
  if (state.mode === 'dismiss') resetDismiss(ctx.values, ctx.reducedMotion);
  stopZoom(ctx.values);
  const mid = fromCentre(ctx.viewport, midpoint(...pair));
  state.pinch = { distance: Math.max(1, distance(...pair)), mid, zoom: readZoom(ctx.values) };
  state.lastMid = mid;
  state.mode = 'pinch';
}

export function movePinch(state: GestureState, ctx: ViewerGestureContext): void {
  const pair = twoPointers(state);
  if (!pair || !state.pinch) return;
  const { pinch } = state;
  const mid = fromCentre(ctx.viewport, midpoint(...pair));
  const scale = rubberScale((pinch.zoom.scale * distance(...pair)) / pinch.distance);
  setZoom(ctx.values, pinchState(pinch.zoom, pinch.mid, mid, scale));
  state.lastMid = mid;
}

export function endPinch(state: GestureState, ctx: ViewerGestureContext): void {
  const target = settleZoom(readZoom(ctx.values), state.lastMid, ctx.base, ctx.viewport);
  animateZoom(ctx.values, target, ctx.reducedMotion);
  state.pinch = null;
  // The remaining finger waits to lift; continuing would fight the settle animation.
  state.mode = state.pointers.size > 0 ? 'blocked' : 'idle';
}

function decideMode(state: GestureState, dx: number, dy: number): GestureMode {
  if (isZoomed(state.startZoom)) return Math.hypot(dx, dy) > TAP_SLOP ? 'pan' : 'pending';
  const axis = lockAxis(dx, dy, TAP_SLOP);
  if (axis === null) return 'pending';
  return axis === 'x' ? 'page' : 'dismiss';
}

function movePage(state: GestureState, ctx: ViewerGestureContext, dx: number): void {
  const atEdge = (ctx.index === 0 && dx > 0) || (ctx.index === ctx.count - 1 && dx < 0);
  const offset = atEdge ? rubberBand(dx, ctx.viewport.width) : dx;
  ctx.values.track.set(state.startTrack + offset);
}

export function moveDismiss(
  ctx: Pick<ViewerGestureContext, 'values' | 'viewport'>,
  dx: number,
  dy: number,
): void {
  const { values, viewport } = ctx;
  const progress = dismissProgress(Math.max(0, dy), viewport.height);
  values.x.set(dx * 0.8);
  values.y.set(dy >= 0 ? dy : rubberBand(dy, viewport.height / 4));
  values.scale.set(dismissScale(progress));
  values.backdrop.set(1 - progress);
}

export function moveSingle(state: GestureState, ctx: ViewerGestureContext, point: Point): void {
  const dx = point.x - state.start.x;
  const dy = point.y - state.start.y;
  if (state.mode === 'pending') state.mode = decideMode(state, dx, dy);
  if (state.mode === 'pan') {
    const moved = { ...state.startZoom, x: state.startZoom.x + dx, y: state.startZoom.y + dy };
    setZoom(ctx.values, rubberPan(moved, ctx.base, ctx.viewport));
  } else if (state.mode === 'page') {
    movePage(state, ctx, dx);
  } else if (state.mode === 'dismiss') {
    moveDismiss(ctx, dx, dy);
  }
}

function releasePan(ctx: ViewerGestureContext, velocity: Point): void {
  const { values, base, viewport } = ctx;
  const limits = panLimits(base, viewport, values.scale.get());
  if (ctx.reducedMotion) {
    animateZoom(values, settleZoom(readZoom(values), { x: 0, y: 0 }, base, viewport), true);
    return;
  }
  glide(values.x, { velocity: velocity.x, min: -limits.x, max: limits.x });
  glide(values.y, { velocity: velocity.y, min: -limits.y, max: limits.y });
}

function releasePage(ctx: ViewerGestureContext, velocityX: number): void {
  const stride = pageStride(ctx.viewport);
  const offset = ctx.values.track.get() + ctx.index * stride;
  const target = pageTarget({
    offset,
    velocity: velocityX,
    stride,
    index: ctx.index,
    count: ctx.count,
  });
  snapTrack(ctx.values, target, stride, { reduced: ctx.reducedMotion, velocity: velocityX });
  if (target !== ctx.index) ctx.onIndexChange(target);
}

export function releaseSingle(
  state: GestureState,
  ctx: ViewerGestureContext,
  point: Point,
  velocity: Point,
) {
  const dy = point.y - state.start.y;
  if (state.mode === 'pan') releasePan(ctx, velocity);
  else if (state.mode === 'page') releasePage(ctx, velocity.x);
  else if (state.mode === 'dismiss') {
    if (shouldDismissViewer(dy, velocity.y, ctx.viewport.height)) ctx.onDismiss(velocity.y);
    else resetDismiss(ctx.values, ctx.reducedMotion);
  }
}
