import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ALL_TICKETS, filterTabs, type TicketFilter } from '@tracker/shared';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultTickets, STATUS, statuses } from '../../../api/test/fixtures';
import { REDUCED_MOTION_QUERY } from '../../../lib/media';
import { phoneStyle } from '../../../../test/regression/phoneCss';
import { FilterTabs } from './FilterTabs';

// All 4 · To do 2 · In progress 1 · Need review 0 · Reviewed 0 · Done 1
const tabs = filterTabs(statuses, defaultTickets());

interface HarnessProps {
  initial?: TicketFilter;
  onChange?: (value: TicketFilter) => void;
}

function Harness({ initial = ALL_TICKETS, onChange = () => undefined }: HarnessProps) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <FilterTabs
        tabs={tabs}
        value={value}
        onChange={(next) => {
          onChange(next);
          setValue(next);
        }}
      />
      <button type="button">After the tabs</button>
    </>
  );
}

const group = () => screen.getByRole('group', { name: 'Filter tickets' });
const tab = (name: RegExp) => within(group()).getByRole('button', { name });
const names = () =>
  within(group())
    .getAllByRole('button')
    .map((button) => button.textContent);
const thumb = () => group().querySelector<HTMLElement>('.thumb')!;

// jsdom lays nothing out, so the tabs get, in order, the boxes a 200px track would give them.
const BOXES = [
  { left: 2, width: 56 },
  { left: 60, width: 78 },
  { left: 140, width: 88 },
  { left: 230, width: 98 },
  { left: 330, width: 88 },
  { left: 420, width: 78 },
];

const boxOf = (element: HTMLElement) => {
  const row = element.parentElement;
  if (element.tagName !== 'BUTTON' || !row) return undefined;
  return BOXES[[...row.querySelectorAll(':scope > button')].indexOf(element)];
};

let restore: Array<() => void> = [];

function layOutTabs(): void {
  const left = vi.spyOn(HTMLElement.prototype, 'offsetLeft', 'get');
  left.mockImplementation(function (this: HTMLElement) {
    return boxOf(this)?.left ?? 0;
  });
  const width = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get');
  width.mockImplementation(function (this: HTMLElement) {
    return boxOf(this)?.width ?? 0;
  });
  // jsdom has no element scrolling; tests that check it lay out the track with their own spy.
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
    configurable: true,
    writable: true,
    value: () => undefined,
  });
  restore.push(
    () => left.mockRestore(),
    () => width.mockRestore(),
    () => Reflect.deleteProperty(HTMLElement.prototype, 'scrollTo'),
  );
}

function layOutTrack(scrollLeft = 0) {
  const track = group();
  Object.defineProperties(track, {
    clientWidth: { configurable: true, value: 200 },
    scrollWidth: { configurable: true, value: 500 },
    scrollLeft: { configurable: true, value: scrollLeft },
  });
  const scrollTo = vi.fn();
  track.scrollTo = scrollTo as typeof track.scrollTo;
  return scrollTo;
}

function mockReducedMotion(): void {
  const previous = Object.getOwnPropertyDescriptor(window, 'matchMedia');
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) =>
      ({
        matches: query === REDUCED_MOTION_QUERY,
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList,
  });
  restore.push(() => {
    if (previous) Object.defineProperty(window, 'matchMedia', previous);
    else Reflect.deleteProperty(window, 'matchMedia');
  });
}

beforeEach(() => {
  restore = [];
});

afterEach(() => {
  restore.forEach((undo) => undo());
});

describe('FilterTabs', () => {
  it('shows All, then a tab per status in status order, each read with its count', () => {
    render(<Harness />);
    expect(names()).toEqual([
      'All 4 tickets',
      'To do 2 tickets',
      'In progress 1 ticket',
      'Need review 0 tickets',
      'Reviewed 0 tickets',
      'Done 1 ticket',
    ]);
    expect(tab(/^To do 2 tickets$/)).toBeInTheDocument();
  });

  it("draws each status tab's glyph in the status color, and none on All", () => {
    render(<Harness />);
    expect(tab(/^All/).querySelector('svg')).toBeNull();
    const glyph = tab(/^Need review/).querySelector('svg');
    expect(glyph).toHaveAttribute('data-category', 'in_review');
    expect(glyph).toHaveStyle({ color: statuses[2]!.color });
    expect(tab(/^Done/).querySelector('svg')).toHaveAttribute('data-category', 'done');
  });

  it('presses the picked tab and picks another on click', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    expect(tab(/^All/)).toHaveAttribute('aria-pressed', 'true');
    expect(tab(/^Done/)).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(tab(/^Done/));
    expect(onChange).toHaveBeenCalledWith(STATUS.done);
    expect(tab(/^Done/)).toHaveAttribute('aria-pressed', 'true');
    expect(tab(/^All/)).toHaveAttribute('aria-pressed', 'false');
  });

  it('is one tab stop, on the picked tab', async () => {
    const user = userEvent.setup();
    render(<Harness initial={STATUS.progress} />);
    expect(tab(/^In progress/)).toHaveAttribute('tabindex', '0');
    expect(tab(/^All/)).toHaveAttribute('tabindex', '-1');
    await user.tab();
    expect(tab(/^In progress/)).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'After the tabs' })).toHaveFocus();
  });

  it('moves focus with the arrow keys, Home and End, and picks with Enter', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    tab(/^All/).focus();

    await user.keyboard('{ArrowRight}');
    expect(tab(/^To do/)).toHaveFocus();
    await user.keyboard('{End}');
    expect(tab(/^Done/)).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(tab(/^All/)).toHaveFocus();
    await user.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(tab(/^Reviewed/)).toHaveFocus();
    await user.keyboard('{Home}{ArrowRight}{ArrowRight}');
    expect(tab(/^In progress/)).toHaveFocus();
    expect(onChange).not.toHaveBeenCalled();
    expect(tab(/^All/)).toHaveAttribute('aria-pressed', 'true');

    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith(STATUS.progress);
    expect(tab(/^In progress/)).toHaveAttribute('aria-pressed', 'true');
  });

  it('keeps the tab stop on the focused tab, so Shift+Tab leaves the row', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.tab();
    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(tab(/^In progress/)).toHaveAttribute('tabindex', '0');
    expect(tab(/^All/)).toHaveAttribute('tabindex', '-1');
    await user.tab({ shift: true });
    expect(group()).not.toContainElement(document.activeElement as HTMLElement);

    await user.tab();
    expect(tab(/^All/)).toHaveFocus();
  });

  it('places the thumb on the picked tab and moves it to the next pick', async () => {
    layOutTabs();
    render(<Harness />);
    expect(thumb().style.getPropertyValue('--thumb-x')).toBe('2px');
    expect(thumb().style.getPropertyValue('--thumb-width')).toBe('56px');
    expect(thumb()).toHaveAttribute('data-placed');

    await userEvent.click(tab(/^Need review/));
    expect(thumb().style.getPropertyValue('--thumb-x')).toBe('230px');
    expect(thumb().style.getPropertyValue('--thumb-width')).toBe('98px');
  });

  it('follows the picked tab when the statuses are reordered', () => {
    layOutTabs();
    const { rerender } = render(
      <FilterTabs tabs={tabs} value={STATUS.review} onChange={() => undefined} />,
    );
    expect(thumb().style.getPropertyValue('--thumb-x')).toBe('230px');
    const reordered = statuses.map((status) =>
      status.id === STATUS.review ? { ...status, position: -1 } : status,
    );
    rerender(
      <FilterTabs
        tabs={filterTabs(reordered, defaultTickets())}
        value={STATUS.review}
        onChange={() => undefined}
      />,
    );
    expect(names()[1]).toBe('Need review 0 tickets');
    expect(thumb().style.getPropertyValue('--thumb-x')).toBe('60px');
  });

  it('scrolls a picked tab that is cut off into view, on a snap point', async () => {
    layOutTabs();
    render(<Harness />);
    const scrollTo = layOutTrack();
    await userEvent.click(tab(/^To do/));
    expect(scrollTo).not.toHaveBeenCalled();

    await userEvent.click(tab(/^In progress/));
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 58, behavior: 'smooth' });
  });

  it('scrolls the focused tab into view while moving with the arrow keys', async () => {
    layOutTabs();
    const user = userEvent.setup();
    render(<Harness />);
    const scrollTo = layOutTrack();
    tab(/^All/).focus();
    await user.keyboard('{End}');
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 300, behavior: 'smooth' });
  });

  it('jumps without the smooth scroll when motion is reduced', async () => {
    layOutTabs();
    mockReducedMotion();
    render(<Harness />);
    const scrollTo = layOutTrack();
    await userEvent.click(tab(/^Done/));
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 300, behavior: 'instant' });
  });
});

describe('FilterTabs on phones', () => {
  const MODULE = 'features/project/tabs/FilterTabs.module.css';

  it('scroll sideways inside the row, snapping to a tab, without a scrollbar', () => {
    render(<Harness />);
    for (const width of [375, 320]) {
      const track = phoneStyle(group(), MODULE, width);
      expect(track.get('overflow-x')).toBe('auto');
      expect(track.get('scroll-snap-type')).toBe('x mandatory');
      expect(track.get('scrollbar-width')).toBe('none');
      expect(phoneStyle(tab(/^Done/), MODULE, width).get('scroll-snap-align')).toBe('start');
    }
  });

  it('take the whole row and never more, so the page never scrolls sideways', () => {
    render(<Harness />);
    const track = phoneStyle(group(), MODULE, 320);
    expect(track.get('flex')).toBe('1 1 100%');
    expect(track.get('min-width')).toBe('0');
    expect(track.get('max-width')).toBe('100%');
  });

  it('give every tab a 44px tall target', () => {
    render(<Harness />);
    for (const width of [375, 320]) {
      expect(phoneStyle(tab(/^All/), MODULE, width).get('min-height')).toBe('44px');
    }
  });
});
