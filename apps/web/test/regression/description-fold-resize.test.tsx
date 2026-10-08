import { act, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { listItem, makeTicketDetail, STATUS } from '../../src/api/test/fixtures';
import { renderTicket } from '../../src/features/ticket/test/renderTicket';
import { PHONE_QUERY } from '../../src/lib/media';
import type * as OverlaysTesting from '../../src/overlays/testing';
import { skipAnimations } from '../../src/overlays/testing';

// The window below says whether it is phone-sized, and tells the page when that changes.
vi.mock('../../src/overlays/testing', async (importOriginal) => ({
  ...(await importOriginal<typeof OverlaysTesting>()),
  mockPhone: () => () => undefined,
}));

// PT-73's review: open a ticket with a long description at 375px and widen the window (or turn
// an iPad) past 768px, and a Show more stayed under the whole description on desktop. Folding
// turned off, but the fold kept the height it had measured on the phone, and the button shows
// whenever there is one.

const LONG = 'Steps to reproduce, what happened and what should happen instead. '.repeat(20);

let phone = true;
const listeners = new Set<() => void>();

function mockWindowWidth() {
  const previous = Object.getOwnPropertyDescriptor(window, 'matchMedia');
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      get matches() {
        return query === PHONE_QUERY && phone;
      },
      media: query,
      addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
      removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
    }),
  });
  return () => {
    if (previous) Object.defineProperty(window, 'matchMedia', previous);
    else Reflect.deleteProperty(window, 'matchMedia');
  };
}

function resize(toPhone: boolean) {
  phone = toPhone;
  act(() => listeners.forEach((listener) => listener()));
}

let cleanups: Array<() => void> = [];

beforeEach(() => {
  localStorage.clear();
  phone = true;
  const heights = vi
    .spyOn(HTMLElement.prototype, 'scrollHeight', 'get')
    .mockImplementation(function (this: HTMLElement) {
      return this.getAttribute('aria-label') === 'Description' ? 1300 : 0;
    });
  cleanups = [skipAnimations(), () => heights.mockRestore(), mockWindowWidth()];
});

afterEach(() => {
  cleanups.forEach((undo) => undo());
  listeners.clear();
});

it('drops Show more when the window grows past phone width', () => {
  const detail = makeTicketDetail(listItem(1, STATUS.todo, 0, { description: LONG }));
  renderTicket({ detail, phone: true });
  expect(screen.getByRole('button', { name: 'Show more' })).toBeInTheDocument();

  resize(false);
  expect(screen.getByLabelText('Description')).not.toHaveClass('folded');
  expect(screen.queryByRole('button', { name: /^Show (more|less)$/ })).not.toBeInTheDocument();

  resize(true);
  expect(screen.getByRole('button', { name: 'Show more' })).toBeInTheDocument();
});
