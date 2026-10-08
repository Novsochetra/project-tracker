import { act, render, screen } from '@testing-library/react';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { NO_HOVER_QUERY, PHONE_QUERY } from '../../src/lib/media';
import { BottomBar } from '../../src/navigation';
import { createLargeTitleStore } from '../../src/navigation/largeTitleStore';
import { ScreenContext, type ScreenState } from '../../src/navigation/ScreenContext';

// Closing the keyboard after editing a long description scrolled the screen until the end of the
// description sat 8px above the bottom bar: tap the first line of PT-48's 1,013-character
// description at 375×812, type a letter, close the keyboard, and the line just edited went off the
// top (447px in review, 1,087px for 1,676 characters, 425px at 320×568). The bar's return scrolled
// every edited field's bottom above it, also a field taller than the room between the nav bar and
// the bar.

const NAV_BAR = { top: 0, bottom: 53 };
const BAR_HEIGHT = 69;
// Measured in WebKit, iPhone 13: the 1,013-character description at 375×812 and PT-42's 651
// characters at 320×568.
const LONG_AT_375 = { top: 153.6, bottom: 932.9 };
const LONG_AT_320 = { top: 182.2, bottom: 803.2 };

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

let restore: () => void;

beforeEach(() => {
  restore = mockTouchPhone();
});

afterEach(() => restore());

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

function renderDescription(field: { top: number; bottom: number }, screenHeight: number) {
  render(
    <TicketScreenStub>
      <header data-navbar="" data-testid="nav-bar" />
      <textarea aria-label="Description" />
      <BottomBar>
        <button type="button">Send to Claude</button>
      </BottomBar>
    </TicketScreenStub>,
  );
  const scroller = screen.getByTestId('scroller');
  const description = screen.getByRole('textbox', { name: 'Description' });
  scroller.getBoundingClientRect = () => rect({ top: 0, bottom: screenHeight });
  screen.getByTestId('nav-bar').getBoundingClientRect = () => rect(NAV_BAR);
  description.getBoundingClientRect = () => rect(field);
  const bar = document.querySelector<HTMLElement>('[data-bottom-bar]')!;
  Object.defineProperty(bar, 'offsetHeight', { value: BAR_HEIGHT });
  const scrollTo = vi.fn();
  scroller.scrollTo = scrollTo as typeof scroller.scrollTo;
  return { description, bar, scrollTo };
}

const nextFrame = () =>
  act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));

async function editAndCloseKeyboard(description: HTMLElement, bar: HTMLElement) {
  act(() => description.focus());
  expect(bar).toHaveAttribute('data-hidden');
  act(() => description.blur());
  expect(bar).not.toHaveAttribute('data-hidden');
  await nextFrame();
}

it('leaves the screen where it is after editing a description too long to fit above the bar', async () => {
  const { description, bar, scrollTo } = renderDescription(LONG_AT_375, 812);
  await editAndCloseKeyboard(description, bar);
  expect(scrollTo).not.toHaveBeenCalled();
});

it('leaves a long description where it is on a 320×568 phone too', async () => {
  const { description, bar, scrollTo } = renderDescription(LONG_AT_320, 568);
  await editAndCloseKeyboard(description, bar);
  expect(scrollTo).not.toHaveBeenCalled();
});

it('counts the nav bar: a field that would end up under it stays where it is', async () => {
  // 700px tall: room below the screen's top (735px), not below the nav bar (682px).
  const { description, bar, scrollTo } = renderDescription({ top: 100, bottom: 800 }, 812);
  await editAndCloseKeyboard(description, bar);
  expect(scrollTo).not.toHaveBeenCalled();
});

it('still brings a field that fits up to 8px above the bar', async () => {
  const { description, bar, scrollTo } = renderDescription({ top: 600, bottom: 780 }, 812);
  await editAndCloseKeyboard(description, bar);
  // 780 − (812 − 69 − 8)
  expect(scrollTo).toHaveBeenCalledExactlyOnceWith({ top: 45, behavior: 'smooth' });
});
