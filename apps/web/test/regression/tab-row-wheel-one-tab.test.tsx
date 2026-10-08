import { fireEvent, render, screen } from '@testing-library/react';
import { ALL_TICKETS, filterTabs } from '@tracker/shared';
import { describe, expect, it, vi } from 'vitest';
import { defaultTickets, statuses } from '../../src/api/test/fixtures';
import { FilterTabs } from '../../src/features/project/tabs/FilterTabs';

// A mouse wheel step scrolled the status tab row 100px and let its snapping pick a tab start, so
// where the first tabs are narrow (All 45px, To do 86px) one step passed two tabs (Chromium,
// 1280×800, ten statuses).

const STARTS = [2, 49, 135, 257, 385, 498];

// jsdom lays nothing out: the track is 300px wide and its tabs 600px, scrolled to `left`.
function renderRow(left: number) {
  render(
    <FilterTabs
      tabs={filterTabs(statuses, defaultTickets())}
      value={ALL_TICKETS}
      onChange={vi.fn()}
    />,
  );
  const track = screen.getByLabelText('Filter tickets');
  Object.defineProperties(track, {
    clientWidth: { configurable: true, value: 300 },
    scrollWidth: { configurable: true, value: 600 },
    scrollLeft: { configurable: true, value: left },
  });
  screen.getAllByRole('button').forEach((tab, index) => {
    Object.defineProperty(tab, 'offsetLeft', { configurable: true, value: STARTS[index] });
  });
  const scrollTo = vi.fn();
  track.scrollTo = scrollTo;
  track.scrollBy = vi.fn();
  return { track, scrollTo };
}

describe('regression: a mouse wheel step moves the tab row one tab', () => {
  it('goes from All to the start of the next tab, however narrow All is', () => {
    const { track, scrollTo } = renderRow(0);
    fireEvent.wheel(track, { deltaY: 100 });
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenLastCalledWith(expect.objectContaining({ left: 47 }));
  });

  it('goes back one tab for a step up', () => {
    const { track, scrollTo } = renderRow(255);
    fireEvent.wheel(track, { deltaY: -100 });
    expect(scrollTo).toHaveBeenLastCalledWith(expect.objectContaining({ left: 133 }));
  });

  it('stops at the end of the row when the last tabs fit', () => {
    const { track, scrollTo } = renderRow(255);
    fireEvent.wheel(track, { deltaY: 100 });
    expect(scrollTo).toHaveBeenLastCalledWith(expect.objectContaining({ left: 300 }));
  });
});
