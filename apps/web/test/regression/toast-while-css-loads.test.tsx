import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ToastProvider, useToast } from '../../src/components';

afterEach(() => {
  vi.restoreAllMocks();
});

function Trigger() {
  const toast = useToast();
  return (
    <button type="button" onClick={() => toast.show('1 ticket added')}>
      Sync
    </button>
  );
}

// WebKit leaves an element added while a stylesheet loads unstyled and undrawn until the sheet is
// in, and a part's stylesheet loads whenever its code does: on an iPhone, "1 ticket added" after
// reconnecting never showed while a sheet's CSS was on its way (PT-116). Asking for the toast's box
// styles it at once. The E2E while-css-loads.spec.ts checks it in WebKit.
it('asks for its box as it shows, so WebKit draws it while a stylesheet loads', () => {
  render(
    <ToastProvider>
      <Trigger />
    </ToastProvider>,
  );
  const boxes = vi.spyOn(Element.prototype, 'getBoundingClientRect');
  fireEvent.click(screen.getByRole('button', { name: 'Sync' }));
  const card = screen.getByText('1 ticket added').parentElement;
  expect(card?.parentElement).toHaveAttribute('role', 'status');
  expect(boxes.mock.contexts).toContain(card);
});
