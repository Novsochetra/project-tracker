import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Run } from '@tracker/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listItem, makeTicketDetail, STATUS } from '../../../api/test/fixtures';
import { DARA, makeRun } from '../../../api/test/runFixtures';
import { skipAnimations } from '../../../overlays/testing';
import { STOPPED_SHOWN_MS } from '../../claude/runs';
import { renderTicket } from '../test/renderTicket';

const LOST = 'Your computer stopped answering.';

let cleanups: Array<() => void> = [];

beforeEach(() => {
  localStorage.clear();
  cleanups = [skipAnimations()];
});

afterEach(() => {
  cleanups.forEach((undo) => undo());
});

function setup(runs: Run[], { phone = false, client = {} } = {}) {
  const detail = makeTicketDetail(listItem(1, STATUS.progress, 0, { title: 'Crash on rotate' }));
  const listTicketRuns = vi.fn().mockResolvedValue(runs);
  const rendered = renderTicket({ detail, phone, client: { listTicketRuns, ...client } });
  cleanups.push(rendered.restorePhone);
  return rendered;
}

const runCard = () => screen.findByRole('region', { name: 'Claude Code run' });
const follows = (first: Element, second: Element) =>
  (first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

describe('Claude Code run on the ticket screen', () => {
  it('shows who is working under the title and cancels the run', async () => {
    const running = makeRun({ status: 'running', startedAt: Date.now() });
    const cancelled = { ...running, status: 'cancelled', endedAt: Date.now() };
    const cancelRun = vi.fn().mockResolvedValue(cancelled);
    const listTicketRuns = vi.fn().mockResolvedValueOnce([running]).mockResolvedValue([cancelled]);
    const { client } = setup([], { client: { cancelRun, listTicketRuns } });
    const user = userEvent.setup();
    const card = await runCard();

    expect(card).toHaveTextContent(`Claude is working on ${DARA}…`);
    expect(follows(screen.getByLabelText('Title'), card)).toBe(true);
    expect(follows(card, screen.getByLabelText('Description'))).toBe(true);
    await user.click(within(card).getByRole('button', { name: 'Cancel' }));

    expect(client.cancelRun).toHaveBeenCalledWith(running.id);
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Claude Code run' })).not.toBeInTheDocument(),
    );
  });

  it('keeps the run and says why when the cancel fails', async () => {
    const cancelRun = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    setup([makeRun()], { client: { cancelRun } });
    const user = userEvent.setup();
    await user.click(within(await runCard()).getByRole('button', { name: 'Cancel' }));
    expect(
      await screen.findByText("Can't reach the tracker. Check your connection."),
    ).toBeInTheDocument();
    expect(await runCard()).toHaveTextContent(`Claude is working on ${DARA}…`);
  });

  it('says why Claude stopped and opens the prompt sheet to try again', async () => {
    const failed = makeRun({ status: 'failed', error: LOST, endedAt: Date.now() - 60_000 });
    const getTicketPrompt = vi.fn().mockResolvedValue({ text: 'Please work', ticketCount: 1 });
    setup([failed], { phone: true, client: { getTicketPrompt } });
    const user = userEvent.setup();
    const card = await runCard();

    expect(card).toHaveTextContent(`Claude stopped: ${LOST}`);
    await user.click(within(card).getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('dialog', { name: 'Send to Claude Code' })).toBeInTheDocument();
  });

  it('shows nothing for a done or cancelled run, or a failure from over a day ago', async () => {
    const old = Date.now() - STOPPED_SHOWN_MS - 1;
    for (const runs of [
      [makeRun({ status: 'done', endedAt: Date.now() })],
      [makeRun({ status: 'cancelled', endedAt: Date.now() })],
      [makeRun({ status: 'failed', error: LOST, endedAt: old })],
    ]) {
      const { client, unmount } = setup(runs);
      await waitFor(() => expect(client.listTicketRuns).toHaveBeenCalledWith('MOB-1'));
      await screen.findByLabelText('Title');
      expect(screen.queryByRole('region', { name: 'Claude Code run' })).not.toBeInTheDocument();
      unmount();
    }
  });
});
