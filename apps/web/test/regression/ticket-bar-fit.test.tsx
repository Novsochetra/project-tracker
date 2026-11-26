import { render, screen, within } from '@testing-library/react';
import { createRef } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { statuses, STATUS } from '../../src/api/test/fixtures';
import { TicketBottomBar } from '../../src/features/ticket/TicketBottomBar';
import { NavigationProvider } from '../../src/navigation';
import { mockPhone } from '../../src/overlays/testing';
import { phoneRule, phoneStyle, pixels } from './phoneCss';

// At 320px the Ticket screen's bar needed 346px: "Send to Claude" ended 10px past the screen's
// edge, and a reviewed ticket's primary read "Move to D…" with its check icon squeezed. Since
// PT-274 the bar holds one button across its width: Comment, or Move to Done on a reviewed ticket.

const SCREEN = 'features/ticket/TicketScreen.module.css';
const BUTTON = 'components/Button/Button.module.css';
const WIDTHS = [320, 360, 375];
// The labels in the bar's 15px semibold Geist, measured in WebKit.
const LABEL_WIDTH: Record<string, number> = {
  Comment: 69.5,
  'Move to Done': 98.9,
};
const ICON = 20;
const BORDERS = 2;
const GUTTER = 16;

const done = statuses.find((status) => status.id === STATUS.done)!;

function renderBar(reviewed: boolean) {
  const { container } = render(
    <MemoryRouter initialEntries={['/p/MOB/3']}>
      <NavigationProvider>
        <TicketBottomBar
          done={reviewed ? { status: done, move: vi.fn() } : null}
          commentBox={createRef()}
        />
      </NavigationProvider>
    </MemoryRouter>,
  );
  const buttons = within(container).getAllByRole('button');
  expect(buttons).toHaveLength(1);

  return buttons[0]!;
}

const visibleLabel = (button: HTMLElement): string => button.textContent ?? '';

function contentWidth(button: HTMLElement, width: number): number {
  const style = new Map([
    ...phoneStyle(button, BUTTON, width),
    ...phoneStyle(button, SCREEN, width),
  ]);
  const [, side = '0'] = (style.get('padding') ?? '').split(/\s+/);
  const text = visibleLabel(button);
  const label = LABEL_WIDTH[text];
  if (label === undefined) throw new Error(`Measure "${text}" in WebKit`);

  return 2 * pixels(side) + BORDERS + ICON + pixels(style.get('gap')) + label;
}

let restore: () => void;

beforeEach(() => {
  restore = mockPhone(true);
});

afterEach(() => restore());

describe('regression: the Ticket bar fits 320, 360 and 375px phones', () => {
  for (const reviewed of [false, true]) {
    const bar = reviewed ? 'a reviewed ticket' : 'a ticket';

    it(`keeps the button of ${bar} inside the 16px gutters with its text whole`, () => {
      const primary = renderBar(reviewed);
      expect(phoneStyle(primary, SCREEN, 320).get('flex')).toBe('1 1 0');
      for (const width of WIDTHS) {
        const label = visibleLabel(primary);
        expect(width - 2 * GUTTER, `${label} at ${width}px`).toBeGreaterThanOrEqual(
          contentWidth(primary, width) - 0.5,
        );
      }
    });

    // Voice Control users say the words they see, so the label must be part of the name.
    it(`keeps the visible label of ${bar} inside its button's accessible name`, () => {
      const primary = renderBar(reviewed);
      const name = (primary.getAttribute('aria-label') ?? primary.textContent ?? '').toLowerCase();
      expect(name).toContain(visibleLabel(primary).toLowerCase());
    });
  }

  // Each text node or element beside the icon is a flex item with the button's 8px gap before it.
  it('keeps every label one flex item beside its icon', () => {
    for (const reviewed of [false, true]) {
      const primary = renderBar(reviewed);
      const items = [...primary.childNodes].filter((node) => node.nodeName !== 'svg');
      expect(items, primary.textContent ?? '').toHaveLength(1);
    }
  });

  it('names Comment as the jump to the comment box, whose own button is "Comment"', () => {
    const primary = renderBar(false);
    expect(screen.getByRole('button', { name: 'Go to the comment box' })).toBe(primary);
    expect(visibleLabel(primary)).toBe('Comment');
  });

  it('shows "Move to Done" whole on a reviewed ticket, 320px included', () => {
    const primary = renderBar(true);
    expect(screen.getByRole('button', { name: 'Move to Done' })).toBe(primary);
    expect(visibleLabel(primary)).toBe('Move to Done');
  });

  it('never squeezes the icon of a primary that shrinks for a long done name', () => {
    expect(phoneRule(SCREEN, '.barPrimary svg').get('flex')).toBe('none');
  });
});
