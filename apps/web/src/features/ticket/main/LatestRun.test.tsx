import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Run } from '@tracker/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { refreshRunSteps } from '../../../api/live/refreshRunSteps';
import { listItem, makeTicketDetail, STATUS } from '../../../api/test/fixtures';
import { makeRequest } from '../../../api/test/requestFixtures';
import { DARA, makeRun } from '../../../api/test/runFixtures';
import { skipAnimations } from '../../../overlays/testing';
import { STOPPED_SHOWN_MS } from '../../claude/runs';
import { makeStep, makeSteps } from '../../steps/testSteps';
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
    expect(screen.getByRole('button', { name: /^Status/ })).toHaveFocus();
  });

  it('shows what Claude asks under its latest step, and says it waits for an answer', async () => {
    const running = makeRun({ status: 'running', startedAt: Date.now() });
    const request = makeRequest({ runId: running.id, label: 'Edit src/rotate.ts' });
    const answerRunRequest = vi
      .fn()
      .mockResolvedValue({ ...request, status: 'answered', decision: 'deny', endedAt: Date.now() });
    setup([running], {
      client: {
        listRunSteps: vi.fn().mockResolvedValue(makeSteps(1)),
        listRunRequests: vi.fn().mockResolvedValue([request]),
        answerRunRequest,
      },
    });
    const user = userEvent.setup();
    const card = await runCard();
    const asked = await within(card).findByRole('region', {
      name: 'Claude asks: Edit src/rotate.ts',
    });

    expect(card).toHaveTextContent('Claude is waiting for your answer.');
    const latest = within(card).getByRole('button', { name: /^Latest step:/ });
    expect(follows(latest, asked)).toBe(true);
    await user.click(within(asked).getByRole('button', { name: 'Deny' }));
    expect(await within(asked).findByText('Denied')).toBeInTheDocument();
    expect(card).toHaveTextContent(`Claude is working on ${DARA}…`);
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

  it('says a ticket in a Run all batch is stopped from Activity, with no Cancel', async () => {
    setup([makeRun({ status: 'running', startedAt: Date.now(), batchId: 'b-1' })]);
    const card = await runCard();

    expect(card).toHaveTextContent(`Claude is working on ${DARA}…`);
    expect(card).toHaveTextContent('Part of a Run all batch. Stop it from Activity.');
    expect(within(card).queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
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

  describe('its steps', () => {
    const running = makeRun({ status: 'running', startedAt: Date.now(), stepCount: 12 });
    const latestLine = async () =>
      within(await runCard()).findByRole('button', { name: /^Latest step:/ });

    it('shows the latest step under who is working, and follows new ones', async () => {
      const listRunSteps = vi
        .fn()
        .mockResolvedValueOnce(makeSteps(12))
        .mockResolvedValue([makeStep(13, { label: 'Run npm run verify' })]);
      const { queryClient } = setup([running], { client: { listRunSteps } });
      const line = await latestLine();

      expect(line).toHaveAccessibleName('Latest step: Read apps/web/src/file12.ts, 12 steps');
      act(() => void refreshRunSteps(queryClient, running.id));
      await waitFor(() =>
        expect(line).toHaveAccessibleName('Latest step: Run npm run verify, 13 steps'),
      );
      expect(listRunSteps).toHaveBeenLastCalledWith(running.id, { after: 12 });
    });

    it('opens every step in a sheet, with who is still working', async () => {
      const listRunSteps = vi.fn().mockResolvedValue(makeSteps(12));
      setup([running], { phone: true, client: { listRunSteps } });
      const user = userEvent.setup();
      await user.click(await latestLine());

      const sheet = await screen.findByRole('dialog', { name: "Claude's steps" });
      const list = await within(sheet).findByRole('list', { name: "Claude's steps" });
      expect(within(list).getAllByRole('listitem')).toHaveLength(12);
      expect(sheet).toHaveTextContent('MOB-1 · 12 steps');
      expect(sheet).toHaveTextContent(`Claude is working on ${DARA}…`);
    });

    it('shows the last step of a run that stopped, to see where it stopped', async () => {
      const failed = makeRun({ status: 'failed', error: LOST, endedAt: Date.now(), stepCount: 3 });
      const listRunSteps = vi.fn().mockResolvedValue([
        makeStep(1),
        makeStep(2, { label: 'Run rm -rf build', toolId: 'toolu_x' }),
        makeStep(3, {
          kind: 'denied',
          label: 'Not allowed: Run rm -rf build',
          toolId: 'toolu_x',
        }),
      ]);
      setup([failed], { client: { listRunSteps } });
      expect(await latestLine()).toHaveAccessibleName(
        'Latest step: Not allowed: Run rm -rf build, 3 steps',
      );
    });

    it('shows no step line before the first step', async () => {
      const listRunSteps = vi.fn().mockResolvedValue([]);
      setup([makeRun({ status: 'queued' })], { client: { listRunSteps } });
      await runCard();
      await waitFor(() => expect(listRunSteps).toHaveBeenCalled());
      expect(screen.queryByRole('button', { name: /^Latest step:/ })).not.toBeInTheDocument();
    });
  });
});
