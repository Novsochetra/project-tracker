import { fireEvent, render, screen } from '@testing-library/react';
import { ALL_TICKETS, filterTabs } from '@tracker/shared';
import { describe, expect, it, vi } from 'vitest';
import { defaultTickets, statuses } from '../../src/api/test/fixtures';
import { FilterTabs } from '../../src/features/project/tabs/FilterTabs';

// A mouse wheel did nothing over a status tab row too long for its space, and only a trackpad's
// sideways swipe showed the tabs past its edge (PT-63 review, desktop).

const DELTA_LINE = 1;

// jsdom lays nothing out: the track is 200px wide, its tabs 500px, scrolled to `left`.
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
    clientWidth: { configurable: true, value: 200 },
    scrollWidth: { configurable: true, value: 500 },
    scrollLeft: { configurable: true, value: left },
  });
  const scrollTo = vi.fn();
  track.scrollTo = scrollTo;
  return { track, scrollTo };
}

describe('regression: the mouse wheel scrolls a long tab row sideways', () => {
  it('turns the wheel down into a scroll to the right, and up to the left', () => {
    const { track, scrollTo } = renderRow(100);
    const lastLeft = () => (scrollTo.mock.lastCall?.[0] as ScrollToOptions).left;
    expect(fireEvent.wheel(track, { deltaY: 100 })).toBe(false);
    expect(lastLeft()).toBeGreaterThan(100);
    expect(fireEvent.wheel(track, { deltaY: -3, deltaMode: DELTA_LINE })).toBe(false);
    expect(lastLeft()).toBeLessThan(100);
  });

  it('lets the page scroll once the row is at its end', () => {
    const { track, scrollTo } = renderRow(300);
    expect(fireEvent.wheel(track, { deltaY: 100 })).toBe(true);
    expect(fireEvent.wheel(track, { deltaY: -100 })).toBe(false);
    expect(scrollTo).toHaveBeenCalledTimes(1);
  });

  it('leaves sideways swipes and pinch zoom to the browser', () => {
    const { track, scrollTo } = renderRow(100);
    expect(fireEvent.wheel(track, { deltaX: 40, deltaY: 10 })).toBe(true);
    expect(fireEvent.wheel(track, { deltaY: 10, ctrlKey: true })).toBe(true);
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
