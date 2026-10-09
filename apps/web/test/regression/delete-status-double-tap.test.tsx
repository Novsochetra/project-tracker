import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ProjectBoard } from '@tracker/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeBoard } from '../../src/api/test/fixtures';
import { renderWithApi, sheetTestSetup } from '../../src/features/claude/test/renderWithApi';
import { StatusManagerSheet } from '../../src/features/statuses/StatusManagerSheet';
import { CLICK_SHIELD_MS } from '../../src/lib/clickShield';
import { tap } from '../../src/overlays/testing';
import { GAPS } from './doubleClick';

// PT-97: on a phone, Delete status turns the status editor into its shorter delete confirm, and
// Add status below moves up under the finger. A double tap's second tap pressed it, and an empty
// new-status editor replaced the confirm (WebKit, iPhone 13 at 375×812). jsdom has no layout, so
// each test taps what the browser found there: Add status, or the confirm's own Delete.

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const sheet = () => screen.getByRole('dialog', { name: 'Statuses' });
const button = (name: string) => within(sheet()).getByRole('button', { name });

let restore: () => void;

beforeEach(() => {
  restore = sheetTestSetup(true);
});

afterEach(() => {
  restore();
});

async function openEditor() {
  const board: ProjectBoard = makeBoard();
  const server = {
    getBoard: vi.fn(() => Promise.resolve(board)),
    deleteStatus: vi.fn(() => Promise.resolve(undefined)),
  };
  renderWithApi(<StatusManagerSheet open onClose={vi.fn()} projectKey="MOB" />, server);
  const user = userEvent.setup();
  await tap(user, await within(sheet()).findByRole('button', { name: /^Need review/ }));
  await wait(CLICK_SHIELD_MS);
  return { user, server };
}

describe('regression: a double tap on Delete status keeps its confirm', () => {
  it.each(GAPS)('Add status under the second tap opens no editor (%i ms apart)', async (gap) => {
    const { user } = await openEditor();

    await tap(user, button('Delete status'));
    if (gap > 0) await wait(gap);
    await tap(user, button('Add status'));

    expect(within(sheet()).getByText("Delete “Need review”? This can't be undone.")).toBeVisible();
    expect(within(sheet()).queryByRole('form', { name: 'New status' })).toBeNull();
  });

  it.each(GAPS)(
    'the confirm’s Delete under the second tap deletes nothing (%i ms)',
    async (gap) => {
      const { user, server } = await openEditor();

      await tap(user, button('Delete status'));
      if (gap > 0) await wait(gap);
      await tap(user, button('Delete'));

      expect(server.deleteStatus).not.toHaveBeenCalled();
      expect(
        within(sheet()).getByText("Delete “Need review”? This can't be undone."),
      ).toBeVisible();
    },
  );

  it('takes a tap on Delete once the confirm has been read', async () => {
    const { user, server } = await openEditor();

    await tap(user, button('Delete status'));
    await wait(CLICK_SHIELD_MS);
    await tap(user, button('Delete'));

    expect(server.deleteStatus).toHaveBeenCalledTimes(1);
  });
});
