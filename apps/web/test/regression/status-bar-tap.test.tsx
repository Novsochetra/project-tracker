import { act, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StackNavigator } from '../../src/navigation';
import { lockBodyScroll } from '../../src/overlays/scrollLock';
import { skipAnimations } from '../../src/overlays/testing';

const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 26_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)';

// jsdom's window never scrolls, so the window's scroll position is a variable here.
function fakeWindowScroll(): { setY: (y: number) => void; y: () => number; undo: () => void } {
  let y = 0;
  const previous = Object.getOwnPropertyDescriptor(window, 'scrollY');
  Object.defineProperty(window, 'scrollY', { configurable: true, get: () => y });
  const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation((_x?: unknown, top?: number) => {
    y = top ?? 0;
  });
  return {
    setY: (next) => {
      y = next;
    },
    y: () => y,
    undo: () => {
      scrollTo.mockRestore();
      if (previous) Object.defineProperty(window, 'scrollY', previous);
    },
  };
}

function renderProject() {
  render(
    <MemoryRouter initialEntries={['/p/MOB']}>
      <StackNavigator renderScreen={(route) => <p>{route.name}</p>} />
    </MemoryRouter>,
  );
  const scroller = (path: string) =>
    document.querySelector<HTMLElement>(`[data-stack-path="${path}"] [data-stack-scroller]`)!;
  const top = scroller('/p/MOB');
  const below = scroller('/');
  top.scrollTo = vi.fn();
  below.scrollTo = vi.fn();
  return { top, below };
}

let win: ReturnType<typeof fakeWindowScroll>;
let restore: Array<() => void> = [];

beforeEach(() => {
  win = fakeWindowScroll();
  restore = [skipAnimations(), win.undo];
});

afterEach(() => {
  restore.forEach((undo) => undo());
  vi.restoreAllMocks();
});

// iOS scrolls only the document when the status bar is tapped, and here the document never
// scrolled: each screen scrolls in a scroller of its own, so the tap did nothing.
describe('regression: tapping the iOS status bar scrolls the screen to the top', () => {
  beforeEach(() => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(IPHONE_UA);
  });

  it('lets the window rest 1px down, so the tap has somewhere to scroll it', () => {
    renderProject();
    expect(win.y()).toBe(1);
    expect(document.documentElement).toHaveAttribute('data-status-bar-tap');
  });

  it('scrolls the top screen, not the one below, and rests the window again', () => {
    const { top, below } = renderProject();
    act(() => {
      win.setY(0);
      window.dispatchEvent(new Event('scroll'));
    });
    expect(top.scrollTo).toHaveBeenCalledExactlyOnceWith({ top: 0, behavior: 'smooth' });
    expect(below.scrollTo).not.toHaveBeenCalled();
    expect(win.y()).toBe(1);
  });

  it('leaves the screen alone when a sheet pins the body and the window goes to 0', () => {
    const { top } = renderProject();
    const unlock = lockBodyScroll();
    act(() => {
      win.setY(0);
      window.dispatchEvent(new Event('scroll'));
    });
    unlock();
    expect(top.scrollTo).not.toHaveBeenCalled();
  });
});

describe('off iOS, where no status-bar tap scrolls the page', () => {
  it('gives the page no scroll range, so a desktop shows no scrollbar', () => {
    const { top } = renderProject();
    act(() => {
      win.setY(0);
      window.dispatchEvent(new Event('scroll'));
    });
    expect(win.y()).toBe(0);
    expect(document.documentElement).not.toHaveAttribute('data-status-bar-tap');
    expect(top.scrollTo).not.toHaveBeenCalled();
  });
});
