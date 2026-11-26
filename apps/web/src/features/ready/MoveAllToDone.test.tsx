import { ApiError } from '@tracker/client';
import {
  DONE_MOVE_MAX,
  type TicketListItem,
  type TicketMoves,
  type TicketPlaceInput,
} from '@tracker/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useReadyForYou } from '../../api';
import { listItem, otherProject, project, STATUS, statuses } from '../../api/test/fixtures';
import { renderWithApp } from '../../app/test/harness';
import { readMenuConfirm } from '../../components/Popover/testing';
import { mockPhone, readActionSheet, skipAnimations } from '../../overlays/testing';
import { readyItems } from './readyItems';
import { ReadySection } from './ReadySection';

// The project list sits above the card on the Projects screen.
function LiveReady() {
  const { data } = useReadyForYou();

  return (
    <>
      <button type="button">Mobile app</button>
      <ReadySection items={readyItems(data, [project, otherProject])} />
    </>
  );
}

const reviewed = (num: number) =>
  listItem(num, STATUS.reviewed, -num * 1000, { title: `Ticket ${num}`, updatedAt: num });

const placeOf = ({ key, statusId, rank }: TicketListItem) => ({ key, from: { statusId, rank } });

// The tracker's side of it: what Ready for you lists, as each request leaves it. `skips` are keys
// it leaves alone, as one moved on another device meanwhile.
function fakeTracker(initial: TicketListItem[], skips: string[] = []) {
  let listed = initial;
  const client = {
    listAllTickets: vi.fn(() => Promise.resolve({ tickets: listed, statuses })),
    moveToDone: vi.fn((keys: string[]): Promise<TicketMoves> => {
      const moving = listed.filter(({ key }) => keys.includes(key) && !skips.includes(key));
      listed = listed.filter((ticket) => !moving.includes(ticket));

      return Promise.resolve({
        moved: moving.map(placeOf),
        skipped: keys.filter((key) => skips.includes(key)),
      });
    }),
    undoMoveToDone: vi.fn((places: TicketPlaceInput[]): Promise<TicketMoves> => {
      const back = initial.filter(({ key }) => places.some((place) => place.key === key));
      listed = initial.filter((ticket) => back.includes(ticket) || listed.includes(ticket));

      return Promise.resolve({ moved: back.map(placeOf), skipped: [] });
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

async function renderReady(tickets = [reviewed(3), reviewed(2), reviewed(1)], skips?: string[]) {
  const tracker = fakeTracker(tickets, skips);
  const view = renderWithApp(<LiveReady />, { client: tracker.client });
  await screen.findByRole('region', { name: 'Ready for you' });

  return { ...view, ...tracker };
}

async function confirmInMenu(count: number) {
  const user = userEvent.setup();
  await user.click(moveAll(count));
  await readMenuConfirm();
  await user.click(screen.getByRole('button', { name: 'Move to Done' }));

  return user;
}

let restore: Array<() => void> = [];

beforeEach(() => {
  restore = [skipAnimations()];
});

afterEach(() => {
  restore.forEach((undo) => undo());
});

describe('Move all to Done in Ready for you', () => {
  it("counts the tickets it moves in the card's header", async () => {
    await renderReady();
    const header = screen.getByRole('heading', { name: 'Ready for you' }).parentElement!;
    expect(within(header).getByRole('button', { name: 'Move 3 to Done' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
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
    expect(await screen.findByText('3 tickets moved to Done')).toBeInTheDocument();
    await waitFor(() => expect(section()).not.toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(await screen.findByText('3 tickets moved back')).toBeInTheDocument();
    await waitFor(() => expect(rowKeys()).toEqual(['MOB-3', 'MOB-2', 'MOB-1']));
    expect(client.undoMoveToDone).toHaveBeenCalledTimes(1);
    expect(client.undoMoveToDone).toHaveBeenCalledWith([
      { key: 'MOB-1', statusId: STATUS.reviewed, rank: -1000 },
      { key: 'MOB-2', statusId: STATUS.reviewed, rank: -2000 },
      { key: 'MOB-3', statusId: STATUS.reviewed, rank: -3000 },
    ]);
  });

  it('hands focus to what is above the card, which leaves with the button', async () => {
    await renderReady();
    await confirmInMenu(3);
    expect(screen.getByRole('button', { name: 'Mobile app' })).toHaveFocus();
    await waitFor(() => expect(section()).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Mobile app' })).toHaveFocus();
  });

  it('keeps focus on the button when the tickets past the first 500 stay', async () => {
    const many = Array.from({ length: DONE_MOVE_MAX + 2 }, (_, index) => reviewed(index + 1));
    await renderReady(many);
    await confirmInMenu(DONE_MOVE_MAX);

    await waitFor(() => expect(moveAll(2)).toBeInTheDocument());
    expect(moveAll(2)).toHaveFocus();
  });

  it('keeps focus in the card on a ticket that stays, once no button is left', async () => {
    const website = listItem(1, 'web-s-reviewed', 0, {
      id: 't-web-1',
      projectId: otherProject.id,
      key: 'WEB-1',
      updatedAt: 9,
    });
    await renderReady([website, reviewed(3), reviewed(2)]);
    await confirmInMenu(2);

    await waitFor(() => expect(screen.queryByRole('button', { name: /^Move \d+ to/ })).toBeNull());
    expect(screen.getByRole('button', { name: /^WEB-1\b/ })).toHaveFocus();
  });

  it('says how many really moved and came back when the tracker skips some', async () => {
    const { client } = await renderReady(undefined, ['MOB-2', 'MOB-1']);
    const user = await confirmInMenu(3);
    expect(await screen.findByText('1 ticket moved to Done')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(await screen.findByText('1 ticket moved back')).toBeInTheDocument();
    expect(client.undoMoveToDone).toHaveBeenCalledWith([
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

  it('brings the tickets back and says why when the move is refused, with no Undo', async () => {
    const { client } = await renderReady();
    client.moveToDone.mockRejectedValueOnce(new ApiError(409, 'conflict', CONFLICT));
    await confirmInMenu(3);

    expect(await screen.findByText(CONFLICT)).toBeInTheDocument();
    await waitFor(() => expect(rowKeys()).toEqual(['MOB-3', 'MOB-2', 'MOB-1']));
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument();
    expect(client.undoMoveToDone).not.toHaveBeenCalled();
  });

  describe('on phones', () => {
    beforeEach(() => {
      restore.push(mockPhone(true));
    });

    it("is the card's last row, as the header has no room beside Show less", async () => {
      await renderReady();
      expect(section()!.lastElementChild).toBe(moveAll(3));
      const header = screen.getByRole('heading', { name: 'Ready for you' }).parentElement!;
      expect(within(header).queryByRole('button', { name: /^Move \d+ to/ })).toBeNull();
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
      expect(await screen.findByText('3 tickets moved to Done')).toBeInTheDocument();
      await waitFor(() => expect(section()).not.toBeInTheDocument());
      expect(screen.getByRole('button', { name: 'Mobile app' })).toHaveFocus();
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
