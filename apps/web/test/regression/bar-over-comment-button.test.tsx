import { act, fireEvent, render, screen } from '@testing-library/react';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { NO_HOVER_QUERY, PHONE_QUERY } from '../../src/lib/media';
import { BottomBar } from '../../src/navigation';
import { createLargeTitleStore } from '../../src/navigation/largeTitleStore';
import { ScreenContext, type ScreenState } from '../../src/navigation/ScreenContext';

// On a touch phone the bottom bar slides away while a text field has focus, and it came back over
// the comment box's Comment button:
// - A tap on Comment takes focus out of the field on mousedown, and the bar came back right then.
//   It was still over the button (it slides away slowly, and not at all while its own entrance
//   runs), so the release landed on the bar's "Send to Claude" and Comment never got the click.
//   The phone E2E "adds, edits and deletes a comment" failed about 1 run in 4.
// - When the keyboard closed with the comment box at the bottom of the screen, the bar came back
//   on top of the box and its button, and the next tap there hit the bar.
// Review of that fix (PT-45):
// - A scroll within about 340 ms of closing the keyboard was pulled back: the box was scrolled
//   above the bar once more when the bar was in, wherever the user had scrolled it meanwhile.
// - Closing the keyboard first and then tapping Comment: the new comment pushed the empty box
//   under the bar, because nothing scrolled after the comment landed.

const SCREEN_BOTTOM = 812;
const BAR_HEIGHT = 69;
// Where the box sat in a failed run: its Comment button at 767–811, just above the screen's edge.
const BOX_AT_BOTTOM = { top: 690, bottom: 819 };

function mockTouchPhone(): () => void {
  const previous = Object.getOwnPropertyDescriptor(window, 'matchMedia');
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: query === PHONE_QUERY || query === NO_HOVER_QUERY,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  });
  return () => {
    if (previous) Object.defineProperty(window, 'matchMedia', previous);
    else Reflect.deleteProperty(window, 'matchMedia');
  };
}

// jsdom has no ResizeObserver; this one reports a change in size when the test says so.
const observers = new Set<FakeResizeObserver>();

class FakeResizeObserver {
  constructor(readonly callback: ResizeObserverCallback) {}
  observe() {
    observers.add(this);
  }
  unobserve() {}
  disconnect() {
    observers.delete(this);
  }
}

const contentResized = () =>
  act(() => {
    for (const observer of [...observers]) observer.callback([], observer);
  });

let restore: () => void;

beforeEach(() => {
  restore = mockTouchPhone();
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
});

afterEach(() => {
  restore();
  vi.unstubAllGlobals();
  observers.clear();
});

function TicketScreenStub({ children }: { children: ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [largeTitle] = useState(createLargeTitleStore);
  const value = useMemo<ScreenState>(
    () => ({ route: { name: 'ticket', key: 'MOB', num: 3 }, isTop: true, scrollRef, largeTitle }),
    [largeTitle],
  );
  return (
    <div ref={scrollRef} data-testid="scroller">
      <ScreenContext value={value}>{children}</ScreenContext>
    </div>
  );
}

const rect = ({ top, bottom }: { top: number; bottom: number }) =>
  ({ top, bottom, left: 0, right: 375, x: 0, y: top, width: 375, height: bottom - top }) as DOMRect;

function renderCommentBox(start = BOX_AT_BOTTOM) {
  const steps: string[] = [];
  let box = start;
  render(
    <TicketScreenStub>
      <form
        aria-label="Comment box"
        onSubmit={(event) => {
          event.preventDefault();
          steps.push('comment sent');
        }}
      >
        <textarea aria-label="Comment" />
        <button type="submit">Comment</button>
      </form>
      <BottomBar>
        <button type="button">Send to Claude</button>
      </BottomBar>
    </TicketScreenStub>,
  );
  const scroller = screen.getByTestId('scroller');
  const form = screen.getByRole('form', { name: 'Comment box' });
  const bar = document.querySelector<HTMLElement>('[data-bottom-bar]')!;
  scroller.getBoundingClientRect = () => rect({ top: 0, bottom: SCREEN_BOTTOM });
  form.getBoundingClientRect = () => rect(box);
  Object.defineProperty(bar, 'offsetHeight', { value: BAR_HEIGHT });
  const scrollBy = vi.fn((options: ScrollToOptions) => steps.push(`scrolled ${options.top}`));
  scroller.scrollBy = scrollBy as typeof scroller.scrollBy;
  return {
    field: screen.getByRole('textbox', { name: 'Comment' }),
    send: screen.getByRole('button', { name: 'Comment' }),
    scroller,
    bar,
    scrollBy,
    steps,
    moveBox: (to: typeof box) => {
      box = to;
    },
  };
}

const nextTask = () => act(() => new Promise<void>((resolve) => setTimeout(resolve)));
const nextFrame = () =>
  act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));

it('stays away until the press that took focus out of the field is released', async () => {
  const { field, send, bar, steps } = renderCommentBox();
  act(() => field.focus());
  expect(bar).toHaveAttribute('data-hidden');

  fireEvent.pointerDown(send);
  act(() => field.blur());
  expect(bar).toHaveAttribute('data-hidden');
  expect(bar).toHaveAttribute('inert');

  fireEvent.pointerUp(send);
  fireEvent.click(send);
  expect(bar).toHaveAttribute('inert');

  await nextTask();
  expect(bar).not.toHaveAttribute('data-hidden');
  expect(bar).not.toHaveAttribute('inert');
  await nextFrame();
  expect(steps).toEqual(['comment sent', 'scrolled 84']);
});

it('comes back after a cancelled press, such as a scroll that started on the button', async () => {
  const { field, send, bar } = renderCommentBox();
  act(() => field.focus());
  fireEvent.pointerDown(send);
  act(() => field.blur());
  fireEvent.pointerCancel(send);
  await nextTask();
  expect(bar).not.toHaveAttribute('data-hidden');
});

it('scrolls the comment box and its Comment button above the bar when the keyboard closes', async () => {
  const { field, bar, scrollBy } = renderCommentBox();
  act(() => field.focus());
  act(() => field.blur());
  expect(bar).not.toHaveAttribute('data-hidden');
  expect(scrollBy).not.toHaveBeenCalled();

  await nextFrame();
  // 819 − (812 − 69 − 8): the box's bottom ends 8px above the bar.
  expect(scrollBy).toHaveBeenCalledExactlyOnceWith({ top: 84, behavior: 'smooth' });
});

// A tap on Comment while typing: the press takes focus out of the field, the release sends.
function tapCommentWhileTyping(field: HTMLElement, send: HTMLElement) {
  act(() => field.focus());
  fireEvent.pointerDown(send);
  act(() => field.blur());
  fireEvent.pointerUp(send);
  fireEvent.click(send);
}

// A touch that starts a scroll: the browser cancels the pointer once the screen pans.
function userScrolls(scroller: HTMLElement) {
  fireEvent.pointerDown(scroller);
  fireEvent.pointerCancel(scroller);
}

it('keeps the box above the bar when the comment it sent pushes it down while the bar comes in', async () => {
  const { field, send, scrollBy, moveBox } = renderCommentBox();
  tapCommentWhileTyping(field, send);
  await nextTask();
  await nextFrame();
  expect(scrollBy).toHaveBeenLastCalledWith({ top: 84, behavior: 'smooth' });

  // Scrolled clear (606–735), then the new comment card, 90px tall, lands above the box.
  moveBox({ top: 696, bottom: 825 });
  contentResized();
  expect(scrollBy).toHaveBeenLastCalledWith({ top: 90, behavior: 'smooth' });
});

it('keeps the emptied box above the bar when a comment sent after the keyboard closed lands', async () => {
  const { field, send, scrollBy, moveBox, steps } = renderCommentBox();
  act(() => field.focus());
  act(() => field.blur());
  await nextFrame();
  expect(scrollBy).toHaveBeenLastCalledWith({ top: 84, behavior: 'smooth' });
  moveBox({ top: 606, bottom: 735 });

  fireEvent.pointerDown(send);
  fireEvent.pointerUp(send);
  fireEvent.click(send);
  expect(steps).toContain('comment sent');
  moveBox({ top: 696, bottom: 825 });
  contentResized();
  expect(scrollBy).toHaveBeenLastCalledWith({ top: 90, behavior: 'smooth' });
});

it('lets the user scroll away right after the keyboard closes', async () => {
  const { field, scroller, bar, scrollBy, moveBox } = renderCommentBox();
  act(() => field.focus());
  act(() => field.blur());
  await nextFrame();
  expect(scrollBy).toHaveBeenCalledExactlyOnceWith({ top: 84, behavior: 'smooth' });

  // 120 ms later, while the bar is still sliding in, the user scrolls up 200px.
  userScrolls(scroller);
  moveBox({ top: 806, bottom: 935 });
  fireEvent.transitionEnd(bar);
  contentResized();
  expect(scrollBy).toHaveBeenCalledTimes(1);
});

it('lets go of a sent box once the user scrolls', async () => {
  const { field, send, scroller, scrollBy, moveBox } = renderCommentBox();
  tapCommentWhileTyping(field, send);
  await nextTask();
  await nextFrame();
  expect(scrollBy).toHaveBeenCalledTimes(1);

  userScrolls(scroller);
  moveBox({ top: 696, bottom: 825 });
  contentResized();
  expect(scrollBy).toHaveBeenCalledTimes(1);
});

it('follows the box when a long comment pushes it below the screen', () => {
  const { field, send, scrollBy, moveBox } = renderCommentBox({ top: 606, bottom: 735 });
  act(() => field.focus());
  act(() => field.blur());
  fireEvent.click(send);

  // Seven lines of comment: a card 220px tall lands above the box.
  moveBox({ top: 826, bottom: 955 });
  contentResized();
  expect(scrollBy).toHaveBeenLastCalledWith({ top: 220, behavior: 'smooth' });
});

it('lets content that lands well after a send push the box down like any other', async () => {
  const { field, send, scrollBy, moveBox } = renderCommentBox({ top: 606, bottom: 735 });
  act(() => field.focus());
  act(() => field.blur());
  fireEvent.click(send);
  await act(() => new Promise((resolve) => setTimeout(resolve, 1100)));

  // An agent's comment, a minute later: the screen stays on what the user is reading.
  moveBox({ top: 696, bottom: 825 });
  contentResized();
  expect(scrollBy).not.toHaveBeenCalled();
});

it('leaves the screen where it is when the comment box is clear of the bar', async () => {
  const { field, scrollBy } = renderCommentBox({ top: 500, bottom: 629 });
  act(() => field.focus());
  act(() => field.blur());
  await nextFrame();
  expect(scrollBy).not.toHaveBeenCalled();
});
