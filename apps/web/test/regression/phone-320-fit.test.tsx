import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SheetsContext, type SheetsApi } from '../../src/app/sheets/context';
import { FilterRow } from '../../src/features/project/FilterRow';
import { ProjectBottomBar } from '../../src/features/project/ProjectBars';
import { mockPhone } from '../../src/overlays/testing';
import { edges, phoneRule, phoneStyle, pixels } from './phoneCss';

const MODULE = 'features/project/ProjectScreen.module.css';
const SEARCH = 'components/SearchField/SearchField.module.css';
const SEGMENTED = 'components/Segmented/Segmented.module.css';
// "Board" in the phone's 14px medium Geist, measured in WebKit.
const BOARD_LABEL = 39.2;

function renderFilters() {
  render(<FilterRow projectKey="MOB" counts={{ all: 6, active: 5, done: 1 }} />);
  const search = screen.getByRole('searchbox', { name: 'Search tickets' }).closest('label')!;
  const tools = search.parentElement!;
  return { search, tools, filters: tools.parentElement! };
}

function renderSendButton() {
  const sheets: SheetsApi = { open: vi.fn(), close: vi.fn(), current: null };
  render(
    <SheetsContext.Provider value={sheets}>
      <ProjectBottomBar projectKey="MOB" />
    </SheetsContext.Provider>,
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
});
