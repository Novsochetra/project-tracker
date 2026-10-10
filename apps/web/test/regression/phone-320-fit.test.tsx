import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeBoard } from '../../src/api/test/fixtures';
import { SheetsContext, type SheetsApi } from '../../src/app/sheets/context';
import { FilterRow } from '../../src/features/project/FilterRow';
import { ProjectBottomBar } from '../../src/features/project/ProjectBars';
import { NavigationProvider } from '../../src/navigation';
import { mockPhone } from '../../src/overlays/testing';
import { edges, phoneRule, phoneStyle, pixels } from './phoneCss';

const MODULE = 'features/project/ProjectScreen.module.css';
const SEARCH = 'components/SearchField/SearchField.module.css';
const SEGMENTED = 'components/Segmented/Segmented.module.css';
// "Board" in the phone's 14px medium Geist, measured in WebKit.
const BOARD_LABEL = 39.2;
// "Send open tickets" with its icon and padding, and the bar's 48px squares and 10px gaps.
const SEND_TICKETS_WIDTH = 184;
const BAR_SQUARE = 48;
const BAR_GAP = 10;

function renderFilters() {
  render(<FilterRow board={makeBoard()} />);
  const search = screen.getByRole('searchbox', { name: 'Search tickets' }).closest('label')!;
  const tools = search.parentElement!;
  return { search, tools, filters: tools.parentElement! };
}

function renderSendButton() {
  const sheets: SheetsApi = { open: vi.fn(), close: vi.fn(), current: null };
  render(
    <MemoryRouter initialEntries={['/p/MOB']}>
      <NavigationProvider>
        <SheetsContext.Provider value={sheets}>
          <ProjectBottomBar projectKey="MOB" />
        </SheetsContext.Provider>
      </NavigationProvider>
    </MemoryRouter>,
  );
  const send = screen.getByRole('button', { name: 'Send open tickets' });
  return {
    send,
    full: within(send).getByText('Send open tickets'),
    short: within(send).getByText('Send'),
  };
}

const switchWidth = (width: number) =>
  pixels(phoneRule(MODULE, '.tools .viewSwitch', width).get('width'));

const shows = (element: Element, width: number) =>
  phoneStyle(element, MODULE, width).get('display') !== 'none';

const visibleLabel = (button: HTMLElement, width: number) =>
  [...button.querySelectorAll('span')]
    .filter((span) => span.childElementCount === 0 && shows(span, width))
    .map((span) => span.textContent)
    .join(' ');

let restore: () => void;

beforeEach(() => {
  restore = mockPhone(true);
});

afterEach(() => restore());

// At 320px the search field's 160px minimum, the 8px gap and the 132px List/Board switch took
// 300px of the 288px between the gutters, leaving the switch 4px from the edge. In the bottom
// bar, "Send open tickets" (184px) beside "Paste report" (141px) ran 30px off the screen.
describe('regression: 320px phones keep the filter row and bottom bar inside the gutters', () => {
  it('fits the search field and the List/Board switch between 16px gutters', () => {
    const { search, tools, filters } = renderFilters();
    const row = phoneStyle(filters, MODULE, 320);
    const gutters = [pixels(row.get('padding-left')), pixels(row.get('padding-right'))];
    expect(gutters).toEqual([16, 16]);
    const searchMin = pixels(phoneStyle(search, SEARCH, 320).get('min-width'));
    const gap = pixels(phoneStyle(tools, MODULE, 320).get('gap'));
    expect(32 + searchMin + gap + switchWidth(320)).toBeLessThanOrEqual(320);
  });

  it('leaves both halves of the switch room for "Board"', () => {
    renderFilters();
    const group = screen.getByRole('group', { name: 'Show tickets as' });
    const track = phoneStyle(group, SEGMENTED, 320);
    const board = within(group).getByRole('button', { name: 'Board' });
    const [, segmentPadding] = edges(phoneStyle(board, SEGMENTED, 320).get('padding'));
    const [, trackPadding] = edges(track.get('padding'));
    const half = (switchWidth(320) - 2 * trackPadding - pixels(track.get('gap'))) / 2;
    expect(half - 2 * segmentPadding).toBeGreaterThanOrEqual(BOARD_LABEL);
  });

  it('shows "Send" below 375px, where the full label needs about 367px', () => {
    const { full, short } = renderSendButton();
    for (const width of [320, 360]) {
      expect([shows(full, width), shows(short, width)]).toEqual([false, true]);
    }
  });

  // Voice Control users say the words they see, so a shorter label must be part of the name.
  it('keeps the visible label inside the accessible name at every width', () => {
    const { send } = renderSendButton();
    const name = send.getAttribute('aria-label')!.toLowerCase();
    for (const width of [320, 360, 375]) {
      expect(name).toContain(visibleLabel(send, width).toLowerCase());
    }
  });

  it('keeps "Send open tickets" from 375px up', () => {
    const { full, short } = renderSendButton();
    expect([shows(full, 375), shows(short, 375)]).toEqual([true, false]);
  });

  // PT-156 put Ask Claude in the bar: it and Paste report are squares so the label still fits.
  it('fits "Send open tickets" beside Ask Claude and Paste report at 375px', () => {
    renderSendButton();
    for (const name of ['Ask Claude', 'Paste report']) {
      const square = phoneStyle(screen.getByRole('button', { name }), MODULE, 375);
      expect([square.get('flex'), pixels(square.get('width'))]).toEqual(['none', BAR_SQUARE]);
    }
    expect(32 + 2 * BAR_SQUARE + 2 * BAR_GAP + SEND_TICKETS_WIDTH).toBeLessThanOrEqual(375);
  });
});
