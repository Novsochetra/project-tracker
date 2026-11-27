import { act, render, screen } from '@testing-library/react';
import { useRef, useState } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { FloatingPanel, FloatingPortal } from '../../src/components/FloatingPanel';

// PT-292: the Project options menu, opened while the project loaded, closed by itself 400ms
// later. The status tabs scrolled sideways to show the selected tab, and the menu took any scroll
// after its first 300ms for the page moving under it, though that scroll couldn't move its button.

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

const scroll = (element: Element) => act(() => void element.dispatchEvent(new Event('scroll')));

afterEach(() => vi.restoreAllMocks());

it('stays open when a row beside its button scrolls itself', () => {
  const now = vi.spyOn(performance, 'now').mockReturnValue(1000);
  render(<Screen />);
  now.mockReturnValue(1400);

  scroll(screen.getByTestId('tabs'));

  expect(screen.getByRole('group', { name: 'Project options' })).toBeInTheDocument();
});

it('still closes when what holds its button scrolls', () => {
  const now = vi.spyOn(performance, 'now').mockReturnValue(1000);
  render(<Screen />);
  now.mockReturnValue(1400);

  scroll(screen.getByTestId('page'));

  expect(screen.queryByRole('group', { name: 'Project options' })).not.toBeInTheDocument();
});
