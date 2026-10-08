import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { statuses, STATUS } from '../../src/api/test/fixtures';
import { SheetsContext, type SheetsApi } from '../../src/app/sheets/context';
import { TicketBottomBar } from '../../src/features/ticket/TicketBottomBar';
import { mockPhone } from '../../src/overlays/testing';
import { phoneRule, phoneStyle, pixels } from './phoneCss';

// At 320px the Ticket screen's bar needed 346px: "Send to Claude" ended 10px past the screen's
// edge, and a reviewed ticket's primary read "Move to D…" with its check icon squeezed.

const SCREEN = 'features/ticket/TicketScreen.module.css';
const BUTTON = 'components/Button/Button.module.css';
const BAR = 'navigation/BottomBar.module.css';
const WIDTHS = [320, 360, 375];
// The labels in the bar's 15px Geist, measured in WebKit: medium for the secondary button,
// semibold for the primary.
const LABEL_WIDTH: Record<string, number> = {
  'Paste report': 86.6,
  Paste: 40.1,
  'Send to Claude': 109.8,
  'Move to Done': 98.9,
};
const ICON = 20;
const BORDERS = 2;
const GUTTER = 16;

const done = statuses.find((status) => status.id === STATUS.done)!;

function renderBar(reviewed: boolean) {
  const sheets: SheetsApi = { open: vi.fn(), close: vi.fn(), current: null };
  const { container } = render(
    <SheetsContext.Provider value={sheets}>
      <TicketBottomBar
        ticketKey="MOB-3"
        projectKey="MOB"
        done={reviewed ? { status: done, move: vi.fn() } : null}
      />
    </SheetsContext.Provider>,
  );
  const [secondary, primary] = within(container).getAllByRole('button');
  return { secondary: secondary!, primary: primary! };
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

interface Item {
  button: HTMLElement;
  // The Done button may shrink below its content (min-width: 0, ellipsis); that clips its text.
  shrinks: boolean;
}

// Flex 1 : 1.35 from a basis of 0, as the browser lays it out: a button that doesn't shrink keeps
// its content's width and the other one takes the rest.
function layOut(items: Item[], width: number) {
  const bar = items[0]!.button.closest('[data-bottom-bar]')!;
  const room = width - 2 * GUTTER - pixels(phoneStyle(bar, BAR, width).get('gap'));
  const sized = items.map(({ button, shrinks }) => {
    const content = contentWidth(button, width);
    const grow = Number(phoneStyle(button, SCREEN, width).get('flex-grow') ?? '1');
    return { content, grow, min: shrinks ? 0 : content };
  });
  const grows = sized.reduce((sum, item) => sum + item.grow, 0);
  const frozen = sized.map((item) => (room * item.grow) / grows < item.min);
  const taken = sized.reduce((sum, item, index) => sum + (frozen[index] ? item.min : 0), 0);
  const freeGrow = sized.reduce((sum, item, index) => sum + (frozen[index] ? 0 : item.grow), 0);
  const widths = sized.map((item, index) =>
    frozen[index] ? item.min : ((room - taken) * item.grow) / freeGrow,
  );
  return { room, sized, widths };
}

let restore: () => void;

beforeEach(() => {
  restore = mockPhone(true);
});

afterEach(() => restore());

describe('regression: the Ticket bar fits 320, 360 and 375px phones', () => {
  for (const reviewed of [false, true]) {
    const bar = reviewed ? 'a reviewed ticket' : 'a ticket';

    it(`keeps both buttons of ${bar} inside the 16px gutters with their text whole`, () => {
      const { secondary, primary } = renderBar(reviewed);
      const items = [
        { button: secondary, shrinks: false },
        { button: primary, shrinks: reviewed },
      ];
      for (const width of WIDTHS) {
        const { room, sized, widths } = layOut(items, width);
        const used = widths.reduce((sum, itemWidth) => sum + itemWidth, 0);
        expect(used, `${width}px`).toBeLessThanOrEqual(room + 0.5);
        sized.forEach(({ content }, index) => {
          const label = visibleLabel(items[index]!.button, width);
          expect(widths[index], `${label} at ${width}px`).toBeGreaterThanOrEqual(content - 0.5);
        });
      }
    });

    // Voice Control users say the words they see, so a shorter label must be part of the name.
    it(`keeps every visible label of ${bar} inside its button's accessible name`, () => {
      const { secondary, primary } = renderBar(reviewed);
      for (const button of [secondary, primary]) {
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
      for (const button of Object.values(renderBar(reviewed))) {
        const items = [...button.childNodes].filter((node) => node.nodeName !== 'svg');
        expect(items, button.textContent ?? '').toHaveLength(1);
      }
    }
  });

  it('keeps the accessible names', () => {
    const { secondary, primary } = renderBar(false);
    expect(screen.getByRole('button', { name: 'Paste report' })).toBe(secondary);
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
