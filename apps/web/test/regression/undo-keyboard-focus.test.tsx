import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listItem, makeBoard, STATUS } from '../../src/api/test/fixtures';
import { resetListView } from '../../src/features/project/listViewStore';
import { fakeBoardServer } from '../../src/features/project/test/fakeBoardServer';
import { renderProject } from '../../src/features/project/test/renderProject';
import { mockPhone, skipAnimations } from '../../src/overlays/testing';

vi.mock('../../src/features/projects/ProjectOptionsButton', () => ({
  ProjectOptionsButton: () => null,
}));

// Undo from the keyboard left focus on the page. Undo gives focus back to where it came from, the
// moved ticket's row, and ⌘Z works on that row too; but going back to its old group makes the row
// a new element there, and only a focused handle was taken along.

const HANDLE = 'Move MOB-3. Drag, or use the arrow keys.';
const handle = () => screen.getByRole('button', { name: HANDLE });
const row = () => screen.getByRole('button', { name: /^MOB-3\b/ });
const keysIn = (group: string) =>
  within(screen.getByRole('region', { name: group }))
    .queryAllByRole('button', { name: /^MOB-\d+/ })
    .map((button) => /^MOB-\d+/.exec(button.textContent ?? '')?.[0]);

let restore: Array<() => void> = [];

beforeEach(() => {
  restore = [skipAnimations(), mockPhone(false)];
});

afterEach(() => {
  restore.forEach((undo) => undo());
  resetListView('MOB');
});

// The project has only MOB-1, MOB-2 and MOB-3 in To do; MOB-3, the last row, goes down a group.
async function moveLastRowDown(user: UserEvent) {
  const server = fakeBoardServer(
    makeBoard([
      listItem(1, STATUS.todo, 0),
      listItem(2, STATUS.todo, 1000),
      listItem(3, STATUS.todo, 2000),
    ]),
  );
  renderProject({ client: server.client });
  (await screen.findByRole('button', { name: HANDLE })).focus();
  await user.keyboard('{ArrowDown}');
  await waitFor(() => expect(keysIn('In progress')).toEqual(['MOB-3']));
  await waitFor(() => expect(server.client.moveTicket).toHaveBeenCalledTimes(1));
}

async function expectFocusOnTicketBackInToDo() {
  await waitFor(() => expect(keysIn('To do')).toEqual(['MOB-1', 'MOB-2', 'MOB-3']));
  expect([row(), handle()]).toContain(document.activeElement);
}

describe('regression: Undo from the keyboard keeps focus on the ticket it puts back', () => {
  it('after Tab to Undo and Enter', async () => {
    const user = userEvent.setup();
    await moveLastRowDown(user);
    await user.tab();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Undo' })).toHaveFocus();
    await user.keyboard('{Enter}');
    await expectFocusOnTicketBackInToDo();
  });

  it('after ⌘Z on the ticket’s row', async () => {
    const user = userEvent.setup();
    await moveLastRowDown(user);
    await user.tab();
    expect(row()).toHaveFocus();
    await user.keyboard('{Meta>}z{/Meta}');
    await expectFocusOnTicketBackInToDo();
  });
});
