import type { DropTarget } from '@tracker/shared';
import { AUTO_SCROLL_INTERVAL_MS } from './autoScroll';
import type { Point } from './dropTarget';

export const DRAG_START_DISTANCE = 6;

export interface DragPress {
  /** The pressed element; it captures the pointer. */
  element: HTMLElement;
  pointerId: number;
  x: number;
  y: number;
  /** Touch and pen drags start at once from the handle; a mouse waits for 6px of movement. */
  immediate: boolean;
}

/** What the list or the board under the drag provides: targets and scrolling. */
export interface DragEnvironment {
  /** Where the ticket would land with the pointer at `point`, measured now. */
  targetAt: (point: Point) => DropTarget | null;
  /** Runs every tick while dragging; scrolls whatever the pointer is near and says if it did. */
  autoScroll: (point: Point, now: number) => boolean;
}

export interface DragStart {
  left: number;
  top: number;
  width: number;
}

export interface DragFrame {
  dx: number;
  dy: number;
  target: DropTarget | null;
}

export interface DragListener {
  onStart: (start: DragStart) => void;
  onFrame: (frame: DragFrame) => void;
  /** Always called once; `started` is false for a plain click or tap. */
  onEnd: (end: { started: boolean; target: DropTarget | null }) => void;
}

// The pointer may already be gone (a very quick tap); the window listeners still finish.
function capture(element: HTMLElement, pointerId: number): void {
  try {
    element.setPointerCapture(pointerId);
  } catch {
    return;
  }
}

function release(element: HTMLElement, pointerId: number): void {
  try {
    if (element.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId);
  } catch {
    return;
  }
}

// Scroll events don't bubble; a capturing listener on the document hears every scroller.
const SCROLL_LISTENER = { capture: true, passive: true } as const;

/** One press on a row, card or handle, from pointerdown until release or cancel. */
export class DragSession {
  private started = false;
  private finished = false;
  private pointer: Point;
  private origin: Point;
  private frameId = 0;
  private scrollTimer = 0;

  constructor(
    private readonly press: DragPress,
    private readonly env: DragEnvironment,
    private readonly listener: DragListener,
  ) {
    this.pointer = { x: press.x, y: press.y };
    this.origin = this.pointer;
    window.addEventListener('pointermove', this.onMove, { passive: false });
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onCancel);
    capture(press.element, press.pointerId);
    if (press.immediate) this.start();
  }

  /** Ends the session without dropping, for example when the list unmounts mid-drag. */
  cancel(): void {
    this.finish(false);
  }

  private readonly onMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.press.pointerId) return;
    this.pointer = { x: event.clientX, y: event.clientY };
    if (!this.started) {
      const moved =
        Math.abs(this.pointer.x - this.press.x) + Math.abs(this.pointer.y - this.press.y);
      if (moved < DRAG_START_DISTANCE) return;
      this.start();
    }
    event.preventDefault();
    this.schedule();
  };

  private readonly onUp = (event: PointerEvent): void => {
    if (event.pointerId === this.press.pointerId) this.finish(true);
  };

  private readonly onCancel = (event: PointerEvent): void => {
    if (event.pointerId === this.press.pointerId) this.finish(false);
  };

  private start(): void {
    this.started = true;
    this.origin = this.pointer;
    const row = this.press.element.closest<HTMLElement>('[data-drop-row]') ?? this.press.element;
    const rect = row.getBoundingClientRect();
    window.getSelection()?.removeAllRanges();
    document.addEventListener('scroll', this.schedule, SCROLL_LISTENER);
    this.scrollTimer = window.setInterval(this.autoScroll, AUTO_SCROLL_INTERVAL_MS);
    this.listener.onStart({ left: rect.left, top: rect.top, width: rect.width });
  }

  // One measurement and update per animation frame, however many pointer events arrive.
  private readonly schedule = (): void => {
    if (this.frameId || !this.started) return;
    this.frameId = requestAnimationFrame(this.frame);
  };

  private readonly frame = (): void => {
    this.frameId = 0;
    if (!this.started) return;
    this.listener.onFrame({
      dx: this.pointer.x - this.origin.x,
      dy: this.pointer.y - this.origin.y,
      target: this.env.targetAt(this.pointer),
    });
  };

  private readonly autoScroll = (): void => {
    if (this.env.autoScroll(this.pointer, performance.now())) this.schedule();
  };

  private finish(drop: boolean): void {
    if (this.finished) return;
    this.finished = true;
    const { started } = this;
    const target = started && drop ? this.env.targetAt(this.pointer) : null;
    this.started = false;
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onCancel);
    document.removeEventListener('scroll', this.schedule, SCROLL_LISTENER);
    cancelAnimationFrame(this.frameId);
    window.clearInterval(this.scrollTimer);
    release(this.press.element, this.press.pointerId);
    this.listener.onEnd({ started, target });
  }
}
