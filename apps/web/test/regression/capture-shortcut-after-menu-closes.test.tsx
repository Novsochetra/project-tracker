import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createReachability } from '../../src/app/reachability';
import { SheetsProvider } from '../../src/app/sheets/SheetsProvider';
import { projectSummary, renderWithApp } from '../../src/app/test/harness';
import { CALENDAR_QUERY, DateRow, SelectRow } from '../../src/components';
import { QuickCapture } from '../../src/features/capture/QuickCapture';
import { skipAnimations } from '../../src/overlays/testing';

// C did nothing for half a second after a pick closed a dropdown or the calendar: the closing panel
// stays (inert) to take the second click of a double-click, and the shortcut still counted it as
// an open menu (PT-61 review).

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

function Fields() {
  const [priority, setPriority] = useState('medium');
  const [due, setDue] = useState('');
  return (
    <>
      <SelectRow
        label="Priority"
        options={[
          { value: 'high', label: 'High' },
          { value: 'medium', label: 'Medium' },
        ]}
        value={priority}
        onChange={setPriority}
      />
      <DateRow value={due} onChange={setDue} />
    </>
  );
}

let restore: Array<() => void> = [];

beforeEach(() => {
  restore = [skipAnimations(), mockDesktopCalendar()];
});

afterEach(() => {
  restore.reverse().forEach((undo) => undo());
});

describe('regression: C works as soon as a menu closes', () => {
  it.each([
    ['a dropdown', /^Priority/, '{ArrowUp}{Enter}'],
    ['the calendar', /^Due date/, '{Enter}'],
  ])('opens quick capture right after a pick in %s', async (_kind, row, pick) => {
    const user = userEvent.setup();
    renderWithApp(
      <SheetsProvider>
        <QuickCapture reachability={createReachability()} />
        <Fields />
      </SheetsProvider>,
      { projects: [projectSummary()], client: {} },
    );
    screen.getByRole('button', { name: row }).focus();
    await user.keyboard('{Enter}');
    await user.keyboard(pick);
    expect(screen.getByRole('button', { name: row })).toHaveFocus();
    await user.keyboard('c');
    expect(await screen.findByRole('dialog', { name: 'New ticket' })).toBeInTheDocument();
  });
});
