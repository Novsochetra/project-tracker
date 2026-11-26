import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { makeBoard } from '../../src/api/test/fixtures';
import { FilterRow } from '../../src/features/project/FilterRow';
import { mockPhone } from '../../src/overlays/testing';
import { edges, phoneRule, phoneStyle, pixels } from './phoneCss';

const MODULE = 'features/project/ProjectScreen.module.css';
const SEARCH = 'components/SearchField/SearchField.module.css';
const SEGMENTED = 'components/Segmented/Segmented.module.css';
// "Board" in the phone's 14px medium Geist, measured in WebKit.
const BOARD_LABEL = 39.2;

function renderFilters() {
  render(<FilterRow board={makeBoard()} />);
  const search = screen.getByRole('searchbox', { name: 'Search tickets' }).closest('label')!;
  const tools = search.parentElement!;

  return { search, tools, filters: tools.parentElement! };
}

const switchWidth = (width: number) =>
  pixels(phoneRule(MODULE, '.tools .viewSwitch', width).get('width'));

let restore: () => void;

beforeEach(() => {
  restore = mockPhone(true);
});

afterEach(() => restore());

// At 320px the search field's 160px minimum, the 8px gap and the 132px List/Board switch took
// 300px of the 288px between the gutters, leaving the switch 4px from the edge.
describe('regression: 320px phones keep the filter row inside the gutters', () => {
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
});
