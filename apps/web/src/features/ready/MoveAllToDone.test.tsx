import { ApiError } from '@tracker/client';
import type { TicketListItem, TicketMoves, TicketPlaceInput } from '@tracker/shared';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useReadyForYou } from '../../api';
import { deferred } from '../../api/test/deferred';
import { listItem, otherProject, project, STATUS, statuses } from '../../api/test/fixtures';
import { renderWithApp } from '../../app/test/harness';
import { readMenuConfirm } from '../../components/Popover/testing';
import { mockPhone, readActionSheet, skipAnimations } from '../../overlays/testing';
import { readyItems } from './readyItems';
import { ReadySection } from './ReadySection';

function LiveReady() {
  const { data } = useReadyForYou();

  return <ReadySection items={readyItems(data, [project, otherProject])} />;
}

const reviewed = (num: number) =>
  listItem(num, STATUS.reviewed, -num * 1000, { title: `Ticket ${num}`, updatedAt: num });

const keysOf = (tickets: readonly TicketListItem[]) => tickets.map(({ key }) => key);

// The tracker's side of it: what Ready for you lists, as each request leaves it.
function fakeTracker(initial: TicketListItem[]) {
  let listed = initial;
  const placeOf = ({ key, statusId, rank }: TicketListItem) => ({ key, from: { statusId, rank } });
  const client = {
    listAllTickets: vi.fn(() => Promise.resolve({ tickets: listed, statuses })),
    moveToDone: vi.fn((keys: string[]): Promise<TicketMoves> => {
      const moved = listed.filter(({ key }) => keys.includes(key));
      listed = listed.filter(({ key }) => !keys.includes(key));

      return Promise.resolve({ moved: moved.map(placeOf), skipped: [] });
    }),
    undoMoveToDone: vi.fn((places: TicketPlaceInput[]): Promise<TicketMoves> => {
      const back = places.map(({ key }) => key);
      listed = initial.filter(({ key }) => back.includes(key) || keysOf(listed).includes(key));

      return Promise.resolve({ moved: [], skipped: [] });
    }),
  };

  return { client };
}

const CONFLICT = 'Someone else changed this ticket at the same time. Try again.';

const section = () => screen.queryByRole('region', { name: 'Ready for you' });
const rowKeys = () =>
  within(section()!)
    .queryAllByRole('button', { name: /^MOB-\d+\b/ })
    .map((button) => /^MOB-\d+/.exec(button.textContent ?? '')?.[0]);
const moveAll = (count: number) => screen.getByRole('button', { name: `Move ${count} to Done` });

async function renderReady(tickets = [reviewed(3), reviewed(2), reviewed(1)]) {
  const tracker = fakeTracker(tickets);
  const view = renderWithApp(<LiveReady />, { client: tracker.client });
  await screen.findByRole('region', { name: 'Ready for you' });

  return { ...view, ...tracker };
}

let restore: Array<() => void> = [];

beforeEach(() => {
  restore = [skipAnimations()];
});

afterEach(() => {
  restore.forEach((undo) => undo());
});

describe('Move all to Done in Ready for you', () => {
  it('counts the tickets it moves in the header', async () => {
    await renderReady();
    expect(moveAll(3)).toHaveAttribute('aria-expanded', 'false');
  });

  it('leaves a single ticket to the Done of its own row', async () => {
    await renderReady([reviewed(1)]);
    expect(screen.getByRole('button', { name: 'Move MOB-1 to Done' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Move 1 to/ })).not.toBeInTheDocument();
  });

  it('asks in a menu, moves them all in one request and offers Undo in one toast', async () => {
    const user = userEvent.setup();
    const { client } = await renderReady();
    await user.click(moveAll(3));
    const menu = screen.getByRole('group', { name: 'Move to Done' });
    expect(within(menu).getByRole('alert')).toHaveTextContent('Move all 3 tickets to Done?');
    expect(within(menu).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await readMenuConfirm();
    await user.click(within(menu).getByRole('button', { name: 'Move to Done' }));

    expect(client.moveToDone).toHaveBeenCalledTimes(1);
    expect(client.moveToDone).toHaveBeenCalledWith(['MOB-3', 'MOB-2', 'MOB-1']);
    expect(screen.getByText('3 tickets moved to Done')).toBeInTheDocument();
    await waitFor(() => expect(section()).not.toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByText('3 tickets moved back')).toBeInTheDocument();
    await waitFor(() => expect(rowKeys()).toEqual(['MOB-3', 'MOB-2', 'MOB-1']));
    expect(client.undoMoveToDone).toHaveBeenCalledTimes(1);
    expect(client.undoMoveToDone).toHaveBeenCalledWith([
      { key: 'MOB-1', statusId: STATUS.reviewed, rank: -1000 },
      { key: 'MOB-2', statusId: STATUS.reviewed, rank: -2000 },
      { key: 'MOB-3', statusId: STATUS.reviewed, rank: -3000 },
    ]);
  });

  it('moves nothing on Cancel and gives focus back to the button', async () => {
    const user = userEvent.setup();
    const { client } = await renderReady();
    await user.click(moveAll(3));
    await readMenuConfirm();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('group', { name: 'Move to Done' })).not.toBeInTheDocument();
    expect(moveAll(3)).toHaveFocus();
    expect(client.moveToDone).not.toHaveBeenCalled();
    expect(rowKeys()).toEqual(['MOB-3', 'MOB-2', 'MOB-1']);
  });

  it('brings the tickets back when the move is refused, and Undo then sends nothing', async () => {
    const user = userEvent.setup();
    const { client } = await renderReady();
    const refused = deferred<TicketMoves>();
    client.moveToDone.mockImplementationOnce(() => refused.promise);
    await user.click(moveAll(3));
    await readMenuConfirm();
    await user.click(screen.getByRole('button', { name: 'Move to Done' }));
    await waitFor(() => expect(section()).not.toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Undo' }));

    act(() => refused.reject(new ApiError(409, 'conflict', CONFLICT)));
    expect(await screen.findByText(CONFLICT)).toBeInTheDocument();
    await waitFor(() => expect(rowKeys()).toEqual(['MOB-3', 'MOB-2', 'MOB-1']));
    expect(client.undoMoveToDone).not.toHaveBeenCalled();
  });

  describe('on phones', () => {
    beforeEach(() => {
      restore.push(mockPhone(true));
    });

    it('asks in an action sheet and moves them once the sheet has gone', async () => {
      const user = userEvent.setup();
      const { client } = await renderReady();
      await user.click(moveAll(3));
      const sheet = screen.getByRole('dialog', { name: 'Move to Done' });
      expect(sheet).toHaveTextContent('Move all 3 tickets to Done?');
      await readActionSheet();
      await user.click(within(sheet).getByRole('button', { name: 'Move 3 to Done' }));

      await waitFor(() =>
        expect(client.moveToDone).toHaveBeenCalledWith(['MOB-3', 'MOB-2', 'MOB-1']),
      );
      expect(screen.queryByRole('dialog', { name: 'Move to Done' })).not.toBeInTheDocument();
      expect(screen.getByText('3 tickets moved to Done')).toBeInTheDocument();
      await waitFor(() => expect(section()).not.toBeInTheDocument());
    });

    it('moves nothing when the sheet is cancelled', async () => {
      const user = userEvent.setup();
      const { client } = await renderReady();
      await user.click(moveAll(3));
      await readActionSheet();
      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(client.moveToDone).not.toHaveBeenCalled();
      expect(rowKeys()).toEqual(['MOB-3', 'MOB-2', 'MOB-1']);
    });
  });
});
