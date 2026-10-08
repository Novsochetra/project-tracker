import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockPhone } from '../../overlays/testing';
import { CALENDAR_QUERY } from '../DatePicker';
import { DateRow } from './DateRow';

function mockCalendarScreen(): () => void {
  const previous = Object.getOwnPropertyDescriptor(window, 'matchMedia');
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: query === CALENDAR_QUERY,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
  return () => {
    if (previous) Object.defineProperty(window, 'matchMedia', previous);
    else Reflect.deleteProperty(window, 'matchMedia');
  };
}

function Harness({
  initial = '',
  onChange,
}: {
  initial?: string;
  onChange: (value: string) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <DateRow
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

const trigger = () => screen.getByRole('button', { name: /^Due date/ });
const calendar = () => screen.getByRole('dialog', { name: 'Choose due date' });
const inCalendar = (name: string | RegExp) => within(calendar()).getByRole('button', { name });
const closed = () =>
  waitFor(() => expect(screen.queryByRole('dialog', { name: 'Choose due date' })).toBeNull());

let cleanups: Array<() => void> = [];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 8, 12));
  cleanups = [mockCalendarScreen()];
});

afterEach(() => {
  cleanups.reverse().forEach((undo) => undo());
  vi.useRealTimers();
});

function setup(initial = '') {
  const onChange = vi.fn();
  const user = userEvent.setup();
  render(<Harness initial={initial} onChange={onChange} />);
  return { onChange, user };
}

describe('DateRow on desktop', () => {
  it('is a button that opens a calendar dialog on today', async () => {
    const { user } = setup();
    expect(document.querySelector('input[type="date"]')).toBeNull();
    expect(trigger()).toHaveAttribute('aria-haspopup', 'dialog');
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
    expect(trigger()).toHaveAccessibleName('Due date None');

    await user.click(trigger());
    expect(trigger()).toHaveAttribute('aria-expanded', 'true');
    expect(within(calendar()).getByRole('heading', { name: 'October 2026' })).toBeInTheDocument();
    expect(within(calendar()).getByRole('grid', { name: 'October 2026' })).toBeInTheDocument();
    const columns = within(calendar()).getAllByRole('columnheader');
    expect(columns.map((column) => column.textContent).join('')).toBe('SMTWTFS');
    expect(columns[0]).toHaveAccessibleName('Sunday');
    const today = inCalendar('Thursday, October 8, 2026');
    expect(today).toHaveFocus();
    expect(today).toHaveAttribute('aria-current', 'date');
    expect(within(calendar()).queryAllByRole('button', { pressed: true })).toEqual([]);
  });

  it('is read once: the button names itself with the text beside it, which readers skip', () => {
    setup('2026-10-20');
    expect(trigger()).toHaveAccessibleName('Due date Tue, Oct 20');
    expect(screen.getByText('Due date')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('Tue, Oct 20')).toHaveAttribute('aria-hidden', 'true');
  });

  it('opens on the chosen day, pressed, with the days around the month muted', async () => {
    const { user } = setup('2026-12-24');
    expect(trigger()).toHaveAccessibleName('Due date Thu, Dec 24');
    await user.click(trigger());
    expect(within(calendar()).getByRole('heading', { name: 'December 2026' })).toBeInTheDocument();
    const chosen = inCalendar('Thursday, December 24, 2026');
    expect(chosen).toHaveFocus();
    expect(chosen).toHaveAttribute('aria-pressed', 'true');
    expect(within(calendar()).getAllByRole('button', { pressed: true })).toEqual([chosen]);
    expect(inCalendar('Sunday, November 29, 2026')).toHaveClass('outside');
    expect(inCalendar('Saturday, January 9, 2027')).toHaveClass('outside');
    expect(inCalendar('Friday, December 25, 2026')).not.toHaveClass('outside');
  });

  it('picks a day with the mouse, saves it, closes and returns focus to the row', async () => {
    const { user, onChange } = setup();
    await user.click(trigger());
    await user.click(inCalendar('Sunday, October 25, 2026'));
    expect(onChange).toHaveBeenCalledWith('2026-10-25');
    expect(trigger()).toHaveAccessibleName('Due date Sun, Oct 25');
    expect(trigger()).toHaveFocus();
    await closed();
  });

  it('lets a past day be picked', async () => {
    const { user, onChange } = setup();
    await user.click(trigger());
    await user.click(inCalendar('Friday, October 2, 2026'));
    expect(onChange).toHaveBeenCalledWith('2026-10-02');
  });

  it('moves with the arrows, Page Up/Down and Home/End, and picks with Enter', async () => {
    const { user, onChange } = setup();
    trigger().focus();
    await user.keyboard('{Enter}');
    expect(inCalendar('Thursday, October 8, 2026')).toHaveFocus();
    const steps: Array<[string, string]> = [
      ['{ArrowRight}', 'Friday, October 9, 2026'],
      ['{ArrowDown}', 'Friday, October 16, 2026'],
      ['{PageDown}', 'Monday, November 16, 2026'],
      ['{Home}', 'Sunday, November 15, 2026'],
      ['{End}', 'Saturday, November 21, 2026'],
      ['{PageUp}', 'Wednesday, October 21, 2026'],
      ['{ArrowUp}', 'Wednesday, October 14, 2026'],
      ['{ArrowLeft}', 'Tuesday, October 13, 2026'],
    ];
    for (const [key, name] of steps) {
      await user.keyboard(key);
      expect(inCalendar(name)).toHaveFocus();
      expect(inCalendar(name)).toHaveAttribute('tabindex', '0');
    }
    expect(within(calendar()).getByRole('heading', { name: 'October 2026' })).toBeInTheDocument();
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith('2026-10-13');
    expect(trigger()).toHaveFocus();
    await closed();
  });

  it('shows the month the arrows move into', async () => {
    const { user } = setup('2026-10-31');
    await user.click(trigger());
    await user.keyboard('{ArrowRight}');
    expect(within(calendar()).getByRole('heading', { name: 'November 2026' })).toBeInTheDocument();
    expect(inCalendar('Sunday, November 1, 2026')).toHaveFocus();
  });

  it('picks with Space', async () => {
    const { user, onChange } = setup();
    await user.click(trigger());
    await user.keyboard('{ArrowRight}');
    await user.keyboard(' ');
    expect(onChange).toHaveBeenCalledWith('2026-10-09');
  });

  it('turns the months with the previous and next buttons', async () => {
    const { user } = setup();
    await user.click(trigger());
    await user.click(inCalendar('Next month'));
    expect(within(calendar()).getByRole('heading', { name: 'November 2026' })).toBeInTheDocument();
    expect(inCalendar('Next month')).toHaveFocus();
    expect(inCalendar('Sunday, November 8, 2026')).toHaveAttribute('tabindex', '0');
    await user.click(inCalendar('Previous month'));
    await user.click(inCalendar('Previous month'));
    expect(within(calendar()).getByRole('heading', { name: 'September 2026' })).toBeInTheDocument();
  });

  it('quick-picks today, tomorrow and next Monday', async () => {
    const { user, onChange } = setup();
    await user.click(trigger());
    expect(inCalendar(/^Today/)).toHaveTextContent('TodayThu');
    expect(inCalendar(/^Tomorrow/)).toHaveTextContent('TomorrowFri');
    expect(inCalendar(/^Next week/)).toHaveTextContent('Next weekMon');
    await user.click(inCalendar(/^Today/));
    expect(onChange).toHaveBeenLastCalledWith('2026-10-08');
    await user.click(trigger());
    await user.click(inCalendar(/^Tomorrow/));
    expect(onChange).toHaveBeenLastCalledWith('2026-10-09');
    await user.click(trigger());
    await user.click(inCalendar(/^Next week/));
    expect(onChange).toHaveBeenLastCalledWith('2026-10-12');
    expect(trigger()).toHaveAccessibleName('Due date Mon, Oct 12');
  });

  it('offers Clear only when a date is set', async () => {
    const empty = setup();
    await empty.user.click(trigger());
    expect(within(calendar()).queryByRole('button', { name: 'Clear' })).toBeNull();
  });

  it('clears the date from the calendar', async () => {
    const { user, onChange } = setup('2026-10-20');
    await user.click(trigger());
    await user.click(inCalendar('Clear'));
    expect(onChange).toHaveBeenCalledWith('');
    expect(trigger()).toHaveAccessibleName('Due date None');
    expect(trigger()).toHaveFocus();
    await closed();
  });

  it('closes on Escape without picking, returns focus, and leaves a sheet open', async () => {
    const { user, onChange } = setup('2026-10-20');
    const escapes: boolean[] = [];
    const listener = (event: KeyboardEvent) => escapes.push(event.defaultPrevented);
    window.addEventListener('keydown', listener);
    cleanups.push(() => window.removeEventListener('keydown', listener));
    await user.click(trigger());
    await user.keyboard('{Escape}');
    expect(onChange).not.toHaveBeenCalled();
    expect(trigger()).toHaveFocus();
    expect(escapes).toEqual([true]);
    await closed();
  });

  it('opens fresh on the chosen day when opened again while it is still leaving', async () => {
    const { user } = setup();
    await user.click(trigger());
    await user.keyboard('{PageDown}');
    expect(within(calendar()).getByRole('heading', { name: 'November 2026' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await user.click(trigger());
    expect(within(calendar()).getByRole('heading', { name: 'October 2026' })).toBeInTheDocument();
    expect(inCalendar('Thursday, October 8, 2026')).toHaveFocus();
  });

  it('closes on a click outside', async () => {
    const { user, onChange } = setup();
    await user.click(trigger());
    await user.click(screen.getByRole('button', { name: 'Close calendar', hidden: true }));
    expect(onChange).not.toHaveBeenCalled();
    expect(trigger()).toHaveFocus();
    await closed();
  });

  it('keeps Tab inside the calendar', async () => {
    const { user } = setup('2026-10-20');
    await user.click(trigger());
    const order = [
      /^Today/,
      /^Tomorrow/,
      /^Next week/,
      'Clear',
      'Previous month',
      'Next month',
      'Tuesday, October 20, 2026',
    ];
    for (const name of order) {
      await user.tab();
      expect(inCalendar(name)).toHaveFocus();
    }
    await user.tab({ shift: true });
    expect(inCalendar('Next month')).toHaveFocus();
    await user.tab({ shift: true });
    await user.tab({ shift: true });
    expect(inCalendar('Clear')).toHaveFocus();
  });

  it('goes with the menu motion: hidden at once, gone after it', async () => {
    const { user } = setup();
    await user.click(trigger());
    await user.click(inCalendar(/^Tomorrow/));
    const leaving = document.querySelector('[role="dialog"][data-leaving]');
    expect(leaving).not.toBeNull();
    expect(leaving).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull());
  });

  it("keeps the row's clear button, which keeps focus on the row", async () => {
    const { user, onChange } = setup('2026-10-20');
    await user.click(screen.getByRole('button', { name: 'Clear due date' }));
    expect(onChange).toHaveBeenCalledWith('');
    expect(trigger()).toHaveAccessibleName('Due date None');
    expect(trigger()).toHaveFocus();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it("starts the week on the locale's first day", async () => {
    Object.defineProperty(navigator, 'language', { configurable: true, value: 'en-GB' });
    cleanups.push(() => Reflect.deleteProperty(navigator, 'language'));
    const { user } = setup();
    await user.click(trigger());
    const columns = within(calendar()).getAllByRole('columnheader');
    expect(columns[0]).toHaveAccessibleName('Monday');
    expect(columns.map((column) => column.textContent).join('')).toBe('MTWTFSS');
  });
});

describe('DateRow on phones', () => {
  it('keeps the native date input', async () => {
    cleanups.push(mockPhone(true));
    const { user, onChange } = setup();
    const input = screen.getByLabelText<HTMLInputElement>('Due date');
    expect(input).toHaveAttribute('type', 'date');
    expect(screen.queryByRole('button', { name: /^Due date/ })).toBeNull();
    input.showPicker = vi.fn();
    await user.click(input);
    expect(input.showPicker).toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });
});
