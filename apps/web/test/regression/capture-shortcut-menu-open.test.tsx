import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Ellipsis, PenLine } from 'lucide-react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createReachability } from '../../src/app/reachability';
import { SheetsProvider } from '../../src/app/sheets/SheetsProvider';
import { projectSummary, renderWithApp } from '../../src/app/test/harness';
import { IconButton, MenuItem, Popover, SelectRow } from '../../src/components';
import { QuickCapture } from '../../src/features/capture/QuickCapture';
import { ActionSheet } from '../../src/overlays';
import { mockPhone, skipAnimations } from '../../src/overlays/testing';

// Popover menus (Project options •••, comment and report menus) are a role="group" panel that
// leaves focus on its trigger, so C opened quick capture under the open menu, and the menu's
// invisible close layer then took the first click on the sheet's Cancel or Create.

function PopoverMenu() {
  const [open, setOpen] = useState(false);
  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      aria-label="Project options"
      trigger={
        <IconButton
          aria-label="Project options"
          aria-expanded={open}
          icon={Ellipsis}
          onClick={() => setOpen(!open)}
        />
      }
    >
      <MenuItem icon={PenLine}>Edit project</MenuItem>
    </Popover>
  );
}

function DropdownMenu() {
  const [priority, setPriority] = useState('medium');
  return (
    <SelectRow
      label="Priority"
      options={[
        { value: 'high', label: 'High' },
        { value: 'medium', label: 'Medium' },
      ]}
      value={priority}
      onChange={setPriority}
    />
  );
}

function ActionSheetMenu() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Comment options
      </button>
      <ActionSheet
        open={open}
        onClose={() => setOpen(false)}
        label="Comment options"
        actions={[{ label: 'Edit comment', onSelect: () => setOpen(false) }]}
      />
    </>
  );
}

let restore: Array<() => void> = [];

beforeEach(() => {
  restore = [skipAnimations(), mockPhone(false)];
});

afterEach(() => {
  restore.forEach((undo) => undo());
});

const captureSheet = () => screen.queryByRole('dialog', { name: 'New ticket' });

describe('regression: C leaves an open menu alone', () => {
  it.each([
    ['a popover menu', PopoverMenu, 'Project options', 'group'],
    ['a dropdown', DropdownMenu, /^Priority/, 'listbox'],
    ['an action sheet', ActionSheetMenu, 'Comment options', 'dialog'],
  ] as const)('does nothing while %s is open', async (_kind, Menu, trigger, role) => {
    const user = userEvent.setup();
    renderWithApp(
      <SheetsProvider>
        <QuickCapture reachability={createReachability()} />
        <Menu />
      </SheetsProvider>,
      { projects: [projectSummary()], client: {} },
    );
    await user.click(screen.getByRole('button', { name: trigger }));
    const menu = screen.getByRole(role, {
      name: typeof trigger === 'string' ? trigger : 'Priority',
    });

    await user.keyboard('c');
    expect(captureSheet()).not.toBeInTheDocument();
    expect(menu).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(menu).not.toBeInTheDocument());
    await user.keyboard('c');
    expect(await screen.findByRole('dialog', { name: 'New ticket' })).toBeInTheDocument();
  });
});
