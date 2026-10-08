import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GroupBox } from './dropTarget';
import { DragSession, type DragListener } from './DragSession';

const groups: GroupBox[] = [
  {
    statusId: 'todo',
    top: 100,
    bottom: 189,
    rows: [
      { id: 't-1', top: 101, height: 44 },
      { id: 't-2', top: 145, height: 44 },
    ],
  },
  { statusId: 'done', top: 205, bottom: 270, rows: [] },
];

interface FakeScroller {
  scrollTop: number;
  addEventListener: () => void;
  removeEventListener: () => void;
}

function rowWithButton() {
  const row = document.createElement('div');
  row.dataset.dropRow = 't-1';
  row.getBoundingClientRect = () => ({ left: 10, top: 101, width: 300, height: 44 }) as DOMRect;
  const button = document.createElement('button');
  row.append(button);
  document.body.append(row);
  return button;
}

function startSession(immediate = false) {
  const scroller: FakeScroller = {
    scrollTop: 0,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  };
  const listener = {
    onStart: vi.fn<DragListener['onStart']>(),
    onFrame: vi.fn<DragListener['onFrame']>(),
    onEnd: vi.fn<DragListener['onEnd']>(),
  };
  const session = new DragSession(
    { ticketId: 't-1', element: rowWithButton(), pointerId: 1, x: 50, y: 120, immediate },
    {
      measure: () => groups,
      scroller: () => scroller as unknown as HTMLElement,
      isPhone: () => false,
    },
    listener,
  );
  return { session, listener, scroller };
}

function pointer(type: string, x: number, y: number, pointerId = 1) {
  window.dispatchEvent(
    new PointerEvent(type, { pointerId, clientX: x, clientY: y, bubbles: true, cancelable: true }),
  );
}

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame'],
  });
});

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

describe('DragSession', () => {
  it('treats a press that moves less than 6px as a click', () => {
    const { listener } = startSession();
    pointer('pointermove', 53, 122);
    pointer('pointerup', 53, 122);
    expect(listener.onStart).not.toHaveBeenCalled();
    expect(listener.onEnd).toHaveBeenCalledWith({ started: false, target: null });
  });

  it('starts a mouse drag after 6px and reports the row it lifted', () => {
    const { listener } = startSession();
    pointer('pointermove', 50, 126);
    expect(listener.onStart).toHaveBeenCalledWith({ left: 10, top: 101, width: 300 });
  });

  it('updates once per animation frame with the offset and drop target', () => {
    const { listener } = startSession();
    pointer('pointermove', 50, 126);
    pointer('pointermove', 55, 200);
    pointer('pointermove', 60, 230);
    vi.advanceTimersByTime(16);
    expect(listener.onFrame).toHaveBeenCalledTimes(1);
    expect(listener.onFrame).toHaveBeenCalledWith({
      dx: 10,
      dy: 104,
      target: { statusId: 'done', beforeId: null, afterId: null },
    });
  });

  it('drops at the last pointer position on release', () => {
    const { listener } = startSession();
    pointer('pointermove', 50, 126);
    pointer('pointermove', 50, 180);
    pointer('pointerup', 50, 180);
    expect(listener.onEnd).toHaveBeenCalledWith({
      started: true,
      target: { statusId: 'todo', beforeId: null, afterId: 't-2' },
    });
  });

  it('starts touch drags from the handle at once', () => {
    const { listener } = startSession(true);
    expect(listener.onStart).toHaveBeenCalledTimes(1);
  });

  it('drops nothing on pointercancel', () => {
    const { listener } = startSession(true);
    pointer('pointermove', 50, 230);
    pointer('pointercancel', 50, 230);
    expect(listener.onEnd).toHaveBeenCalledWith({ started: true, target: null });
    pointer('pointerup', 50, 230);
    expect(listener.onEnd).toHaveBeenCalledTimes(1);
  });

  it('ignores other pointers', () => {
    const { listener } = startSession();
    pointer('pointermove', 50, 300, 2);
    pointer('pointerup', 50, 300, 2);
    expect(listener.onStart).not.toHaveBeenCalled();
    expect(listener.onEnd).not.toHaveBeenCalled();
  });

  it('auto-scrolls the screen near the bottom edge', () => {
    const { scroller } = startSession(true);
    pointer('pointermove', 50, window.innerHeight - 10);
    vi.advanceTimersByTime(16);
    expect(scroller.scrollTop).toBe(6);
    vi.advanceTimersByTime(16);
    expect(scroller.scrollTop).toBe(12);
  });

  it('can be cancelled from outside without dropping', () => {
    const { session, listener } = startSession(true);
    session.cancel();
    expect(listener.onEnd).toHaveBeenCalledWith({ started: true, target: null });
  });
});
