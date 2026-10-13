import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { statuses, STATUS } from '../../src/api/test/fixtures';
import { SheetsContext, type SheetsApi } from '../../src/app/sheets/context';
import { TicketBottomBar } from '../../src/features/ticket/TicketBottomBar';
import { NavigationProvider } from '../../src/navigation';
import { mockPhone } from '../../src/overlays/testing';
import { phoneRule, phoneStyle, pixels } from './phoneCss';

// At 320px the Ticket screen's bar needed 346px: "Send to Claude" ended 10px past the screen's
// edge, and a reviewed ticket's primary read "Move to D…" with its check icon squeezed. Since
// PT-184 Ask Claude leads the bar and it and Paste report are 48px squares, as on the Project
// screen.

const SCREEN = 'features/ticket/TicketScreen.module.css';
const BUTTON = 'components/Button/Button.module.css';
const BAR = 'navigation/BottomBar.module.css';
const WIDTHS = [320, 360, 375];
// The labels in the bar's 15px Geist, measured in WebKit: medium for the secondary button,
// semibold for the primary.
const LABEL_WIDTH: Record<string, number> = {
  'Send to Claude': 109.8,
  'Move to Done': 98.9,
};
const ICON = 20;
const BORDERS = 2;
const GUTTER = 16;
const BAR_SQUARE = 48;

const done = statuses.find((status) => status.id === STATUS.done)!;

function renderBar(reviewed: boolean) {
  const sheets: SheetsApi = { open: vi.fn(), close: vi.fn(), current: null };
  const { container } = render(
    <MemoryRouter initialEntries={['/p/MOB/3']}>
      <NavigationProvider>
        <SheetsContext.Provider value={sheets}>
          <TicketBottomBar
            ticketKey="MOB-3"
            projectKey="MOB"
            done={reviewed ? { status: done, move: vi.fn() } : null}
          />
        </SheetsContext.Provider>
      </NavigationProvider>
    </MemoryRouter>,
  );
  const [ask, paste, primary] = within(container).getAllByRole('button');
  return { ask: ask!, paste: paste!, primary: primary! };
}

const shows = (element: Element, width: number) =>
  phoneStyle(element, SCREEN, width).get('display') !== 'none';

function visibleLabel(button: HTMLElement, width: number): string {
  const hidden = [...button.querySelectorAll('*')].filter((element) => !shows(element, width));
  const texts = document.createTreeWalker(button, NodeFilter.SHOW_TEXT);
  let label = '';
  for (let text = texts.nextNode(); text; text = texts.nextNode()) {
    if (!hidden.some((element) => element.contains(text))) label += text.textContent ?? '';
  }
  return label;
}

function contentWidth(button: HTMLElement, width: number): number {
  const style = new Map([
    ...phoneStyle(button, BUTTON, width),
    ...phoneStyle(button, SCREEN, width),
  ]);
  const [, side = '0'] = (style.get('padding') ?? '').split(/\s+/);
  const text = visibleLabel(button, width);
  const label = LABEL_WIDTH[text];
  if (label === undefined) throw new Error(`Measure "${text}" in WebKit`);
  return 2 * pixels(side) + BORDERS + ICON + pixels(style.get('gap')) + label;
}

// The squares keep their width and the primary takes the rest of the bar.
function primaryRoom(squares: HTMLElement[], width: number): number {
  const bar = squares[0]!.closest('[data-bottom-bar]')!;
  const gap = pixels(phoneStyle(bar, BAR, width).get('gap'));
  const taken = squares.reduce((sum, square) => {
    const style = phoneStyle(square, SCREEN, width);
    expect(style.get('flex')).toBe('none');
    return sum + BAR_SQUARE + gap;
  }, 0);
  return width - 2 * GUTTER - taken;
}

let restore: () => void;

beforeEach(() => {
  restore = mockPhone(true);
});

afterEach(() => restore());

describe('regression: the Ticket bar fits 320, 360 and 375px phones', () => {
  for (const reviewed of [false, true]) {
    const bar = reviewed ? 'a reviewed ticket' : 'a ticket';

    it(`keeps the buttons of ${bar} inside the 16px gutters with the primary's text whole`, () => {
      const { ask, paste, primary } = renderBar(reviewed);
      for (const width of WIDTHS) {
        const label = visibleLabel(primary, width);
        expect(primaryRoom([ask, paste], width), `${label} at ${width}px`).toBeGreaterThanOrEqual(
          contentWidth(primary, width) - 0.5,
        );
      }
    });

    // Voice Control users say the words they see, so a shorter label must be part of the name.
    it(`keeps every visible label of ${bar} inside its button's accessible name`, () => {
      const { ask, paste, primary } = renderBar(reviewed);
      for (const button of [ask, paste, primary]) {
        const name = (button.getAttribute('aria-label') ?? button.textContent ?? '').toLowerCase();
        for (const width of WIDTHS) {
          expect(name).toContain(visibleLabel(button, width).toLowerCase());
        }
      }
    });
  }

  // Each text node or element beside the icon is a flex item with the button's 8px gap before it,
  // which would show as a wide space inside "Paste report".
  it('keeps every label one flex item beside its icon', () => {
    for (const reviewed of [false, true]) {
      const { primary } = renderBar(reviewed);
      const items = [...primary.childNodes].filter((node) => node.nodeName !== 'svg');
      expect(items, primary.textContent ?? '').toHaveLength(1);
    }
  });

  it('keeps the accessible names', () => {
    const { ask, paste, primary } = renderBar(false);
    expect(screen.getByRole('button', { name: 'Ask Claude' })).toBe(ask);
    expect(screen.getByRole('button', { name: 'Paste report' })).toBe(paste);
    expect(screen.getByRole('button', { name: 'Send to Claude' })).toBe(primary);
  });

  it('shows "Move to Done" whole on a reviewed ticket, 320px included', () => {
    const { primary } = renderBar(true);
    expect(screen.getByRole('button', { name: 'Move to Done' })).toBe(primary);
    for (const width of WIDTHS) expect(visibleLabel(primary, width)).toBe('Move to Done');
  });

  it('never squeezes the icon of a primary that shrinks for a long done name', () => {
    expect(phoneRule(SCREEN, '.barPrimary svg').get('flex')).toBe('none');
  });
});
