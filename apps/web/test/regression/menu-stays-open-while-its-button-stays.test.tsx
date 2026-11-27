import { act, render, screen } from '@testing-library/react';
import { useRef, useState } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { FloatingPanel, FloatingPortal } from '../../src/components/FloatingPanel';

// PT-292: the Project options menu, opened on an iPad while the project loaded, closed by itself
// soon after. It took any scroll after its first 300ms for the page moving under it: the status
// tabs scrolling sideways to show the selected tab, and the page resting 1px down for status-bar
// taps under the sticky app. Neither moved its button.

const place = () => ({ top: 40, left: 20, up: false, originX: 100 });

function Screen() {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(true);

  return (
    <main data-testid="page">
      <header>
        <button ref={anchorRef} type="button">
          Project options
        </button>
      </header>
      <div data-testid="tabs">Status tabs</div>
      <FloatingPortal open={open}>
        <FloatingPanel
          open={open}
          anchorRef={anchorRef}
          panelRef={panelRef}
          closeLabel="Close menu"
          place={place}
          onClose={() => setOpen(false)}
          role="group"
          aria-label="Project options"
        >
          <button type="button">Manage statuses</button>
        </FloatingPanel>
      </FloatingPortal>
    </main>
  );
}

const scroll = (target: EventTarget) => act(() => void target.dispatchEvent(new Event('scroll')));
const menu = () => screen.queryByRole('group', { name: 'Project options' });

// Where the button is on screen, which the next scroll can change. It starts where jsdom, which
// lays nothing out, put it as the menu opened.
function buttonAt(top: number): { moveTo: (next: number) => void } {
  let current = top;
  const button = screen.getByRole('button', { name: 'Project options' });
  vi.spyOn(button, 'getBoundingClientRect').mockImplementation(
    () => ({ top: current, left: 0, width: 44, height: 44 }) as DOMRect,
  );

  return { moveTo: (next) => (current = next) };
}

function openMenu() {
  const now = vi.spyOn(performance, 'now').mockReturnValue(1000);
  render(<Screen />);
  const button = buttonAt(0);
  now.mockReturnValue(1400);

  return button;
}

afterEach(() => vi.restoreAllMocks());

it('stays open when a row beside its button scrolls itself', () => {
  openMenu();

  scroll(screen.getByTestId('tabs'));

  expect(menu()).toBeInTheDocument();
});

it('stays open when the page scrolls but its button stays put', () => {
  openMenu();

  scroll(document);

  expect(menu()).toBeInTheDocument();
});

it('still closes when a scroll moves its button', () => {
  const button = openMenu();

  button.moveTo(-30);
  scroll(screen.getByTestId('page'));

  expect(menu()).not.toBeInTheDocument();
});
