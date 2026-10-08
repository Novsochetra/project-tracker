import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '../../src/api';
import { makeBoard } from '../../src/api/test/fixtures';
import { setupApi } from '../../src/api/test/render';
import { CALENDAR_QUERY, DateRow, SelectRow, ToastProvider } from '../../src/components';
import { NewTicketSheet } from '../../src/features/project/NewTicketSheet';
import { skipAnimations } from '../../src/overlays/testing';
import { doubleClick, GAPS, hitTest } from './doubleClick';

// Double-clicking a day, a quick pick or a Status or Priority option picked it, and the second
// click went through the closing popover to what lay under it (Chromium and WebKit, 1280×800):
// over the New ticket backdrop it asked "Discard changes?", over a button below it pressed that
// button ("Delete MOB-3?"). The popover's click-catching layer went at once, and the fading
// calendar (or the dropdown, gone at once) took no clicks.

function mockDesktopCalendar(): () => void {
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

let cleanups: Array<() => void> = [];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 8, 12));
  cleanups = [skipAnimations(), mockDesktopCalendar()];
});

afterEach(() => {
  cleanups.reverse().forEach((undo) => undo());
  vi.useRealTimers();
  localStorage.clear();
});

const dueRow = () => screen.getByRole('button', { name: /^Due date/ });
const priorityRow = () => screen.getByRole('button', { name: /^Priority/ });
const calendar = () => screen.getByRole('dialog', { name: 'Choose due date' });
const day = (name: string | RegExp) => within(calendar()).getByRole('button', { name });
const option = (name: string) => screen.getByRole('option', { name });

describe('regression: the second click of a double-click stays on the popover', () => {
  function renderNewTicket() {
    const api = setupApi({ getBoard: vi.fn().mockResolvedValue(makeBoard()) });
    api.queryClient.setQueryData(queryKeys.board('MOB'), makeBoard());
    const Wrapper = api.wrapper;
    render(
      <Wrapper>
        <ToastProvider>
          <NewTicketSheet open projectKey="MOB" onClose={() => undefined} />
        </ToastProvider>
      </Wrapper>,
    );
    return userEvent.setup();
  }

  const newTicket = () => screen.getByRole('dialog', { name: 'New ticket' });
  // The dimmed area around the sheet is the "Close" button outside its dialog.
  const backdrop = () =>
    within(newTicket().parentElement!)
      .getAllByRole('button', { name: 'Close' })
      .find((button) => !newTicket().contains(button))!;
  const discardAsked = () => screen.queryByRole('dialog', { name: 'Discard changes?' });

  it.each(GAPS)('picks a day over the New ticket backdrop (%i ms apart)', async (gap) => {
    const user = renderNewTicket();
    await user.type(screen.getByLabelText('Ticket title'), 'Crash on rotate');
    await user.click(dueRow());
    await doubleClick(user, day('Thursday, October 22, 2026'), backdrop(), gap);
    expect(discardAsked()).toBeNull();
    expect(newTicket()).toBeInTheDocument();
    expect(dueRow()).toHaveAccessibleName('Due date Thu, Oct 22');
    expect(dueRow()).toHaveFocus();
  });

  it('picks a quick pick over the New ticket backdrop', async () => {
    const user = renderNewTicket();
    await user.type(screen.getByLabelText('Ticket title'), 'Crash on rotate');
    await user.click(dueRow());
    await doubleClick(user, day(/^Tomorrow/), backdrop(), 120);
    expect(discardAsked()).toBeNull();
    expect(dueRow()).toHaveAccessibleName('Due date Fri, Oct 9');
  });

  it.each(GAPS)('picks a priority over the New ticket backdrop (%i ms apart)', async (gap) => {
    const user = renderNewTicket();
    await user.type(screen.getByLabelText('Ticket title'), 'Crash on rotate');
    await user.click(priorityRow());
    await doubleClick(user, option('High'), backdrop(), gap);
    expect(discardAsked()).toBeNull();
    expect(newTicket()).toBeInTheDocument();
    expect(priorityRow()).toHaveAccessibleName('Priority High');
    expect(priorityRow()).toHaveFocus();
  });

  function Fields({ onDelete }: { onDelete: () => void }) {
    const [due, setDue] = useState('');
    const [priority, setPriority] = useState('medium');
    return (
      <>
        <DateRow value={due} onChange={setDue} />
        <SelectRow
          label="Priority"
          options={[
            { value: 'high', label: 'High' },
            { value: 'medium', label: 'Medium' },
          ]}
          value={priority}
          onChange={setPriority}
        />
        <button type="button" onClick={onDelete}>
          Delete MOB-3
        </button>
      </>
    );
  }

  function renderFields() {
    const onDelete = vi.fn();
    render(<Fields onDelete={onDelete} />);
    const below = screen.getByRole('button', { name: 'Delete MOB-3' });
    return { user: userEvent.setup(), onDelete, below };
  }

  it.each(GAPS)('picks a day over a button below (%i ms apart)', async (gap) => {
    const { user, onDelete, below } = renderFields();
    await user.click(dueRow());
    await doubleClick(user, day('Thursday, October 22, 2026'), below, gap);
    expect(onDelete).not.toHaveBeenCalled();
    expect(dueRow()).toHaveAccessibleName('Due date Thu, Oct 22');
    expect(dueRow()).toHaveFocus();
  });

  it.each(GAPS)('picks an option over a button below (%i ms apart)', async (gap) => {
    const { user, onDelete, below } = renderFields();
    await user.click(priorityRow());
    await doubleClick(user, option('High'), below, gap);
    expect(onDelete).not.toHaveBeenCalled();
    expect(priorityRow()).toHaveAccessibleName('Priority High');
    expect(priorityRow()).toHaveFocus();
  });

  it('lets clicks through again once a double-click is over', async () => {
    const { user, onDelete, below } = renderFields();
    await user.click(dueRow());
    const spot = day('Thursday, October 22, 2026');
    await user.click(spot);
    await waitFor(() => expect(hitTest(spot, below)).toBe(below));
    await user.click(priorityRow());
    const high = option('High');
    await user.click(high);
    await waitFor(() => expect(hitTest(high, below)).toBe(below));
    await user.click(below);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
