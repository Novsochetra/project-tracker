import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@tracker/client';
import type { ChatDetail, RunAllPreview, RunBatch, Runner } from '@tracker/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeChatDetail, makeMessage } from '../../api/test/chatFixtures';
import { makeRunner } from '../../api/test/runFixtures';
import { renderAsk } from './test/renderAsk';

const dara = makeRunner();
const cardText = (limit = 'limit: 3\n') => `On it:\n\`\`\`run-all\n${limit}\`\`\`\nTap Confirm.`;
const preview: RunAllPreview = {
  tickets: [
    { ticketKey: 'MOB-3', ticketTitle: 'Faster sync' },
    { ticketKey: 'MOB-4', ticketTitle: 'Dark mode' },
  ],
  skippedActive: 1,
  skippedDevice: 1,
  leftOver: 0,
  maxParallel: 5,
};
const batch: RunBatch = {
  runId: 'r-batch',
  projectKey: 'MOB',
  status: 'running',
  tickets: [
    { runId: 'r-3', ticketKey: 'MOB-3', ticketTitle: 'Faster sync', state: 'running' },
    { runId: 'r-4', ticketKey: 'MOB-4', ticketTitle: 'Dark mode', state: 'failed' },
  ],
};

const withCards = (...texts: string[]): ChatDetail =>
  makeChatDetail({
    messages: texts.map((text, index) =>
      makeMessage({ id: `m-${index + 1}`, role: 'claude', text }),
    ),
  });

const started = (detail: ChatDetail): ChatDetail => ({
  ...detail,
  messages: detail.messages.map((message) => ({ ...message, batchRunId: 'r-batch' })),
});

let restore: () => void;

beforeEach(() => localStorage.clear());
afterEach(() => restore());

function setup(
  detail: ChatDetail,
  client: Record<string, unknown> = {},
  runners: Runner[] = [dara],
) {
  const rendered = renderAsk({
    client: {
      getChat: vi.fn().mockResolvedValue(detail),
      listRunners: vi.fn().mockResolvedValue(runners),
      previewRunAll: vi.fn().mockResolvedValue(preview),
      getRunBatch: vi.fn().mockResolvedValue(batch),
      runAllFromCard: vi.fn(),
      ...client,
    },
  });
  restore = rendered.restore;
  return rendered;
}

const runAllCard = () => screen.findByRole('region', { name: 'Run all card' });

describe('Ask: Run all card', () => {
  it('lists the tickets that would run, the limit and what is left out', async () => {
    const { client } = setup(withCards(cardText()));
    const card = await runAllCard();
    expect(screen.getByRole('article', { name: 'Claude' })).toHaveTextContent(
      /On it:.*Run all To do.*Tap Confirm/,
    );
    expect(card).toHaveTextContent('3 at a time');
    expect(await within(card).findByText('Faster sync')).toBeInTheDocument();
    expect(within(card).getByText('MOB-4')).toBeInTheDocument();
    expect(card).toHaveTextContent('1 already running or waiting');
    expect(card).toHaveTextContent('1 needs a device');
    expect(client.previewRunAll).toHaveBeenCalledWith('MOB');
    expect(client.runAllFromCard).not.toHaveBeenCalled();
  });

  it("shows the project's limit when the card names none", async () => {
    setup(withCards(cardText('')));
    expect(await within(await runAllCard()).findByText('5 at a time')).toBeInTheDocument();
  });

  it('starts the batch only on Confirm, with the card limit, then shows progress', async () => {
    const detail = withCards(cardText());
    const getChat = vi.fn().mockResolvedValueOnce(detail).mockResolvedValue(started(detail));
    const runAllFromCard = vi.fn().mockResolvedValue({
      runId: 'r-batch',
      queued: 2,
      skippedActive: 1,
      skippedDevice: 1,
      maxParallel: 3,
    });
    const { client } = setup(detail, { getChat, runAllFromCard });
    const user = userEvent.setup();
    const confirm = within(await runAllCard()).getByRole('button', { name: 'Confirm' });
    await waitFor(() => expect(confirm).toBeEnabled());
    await user.click(confirm);

    expect(client.runAllFromCard).toHaveBeenCalledWith('c-1', 'm-1', {
      runnerId: dara.id,
      maxParallel: 3,
      ticketKeys: ['MOB-3', 'MOB-4'],
    });
    const progress = await screen.findByRole('region', { name: 'Run all progress' });
    expect(
      await within(progress).findByText('1 running · 0 waiting · 0 done · 1 failed'),
    ).toBeInTheDocument();
    expect(within(progress).getByText('Running')).toBeInTheDocument();
    expect(within(progress).getByText('Failed')).toBeInTheDocument();
    expect(within(progress).queryByRole('button', { name: 'Confirm' })).not.toBeInTheDocument();
    expect(client.getRunBatch).toHaveBeenCalledWith('r-batch');
  });

  it('says when a started batch finished', async () => {
    setup(started(withCards(cardText())), {
      getRunBatch: vi.fn().mockResolvedValue({ ...batch, status: 'done' }),
    });
    const progress = await screen.findByRole('region', { name: 'Run all progress' });
    expect(await within(progress).findByText('Finished')).toBeInTheDocument();
  });

  it('keeps Confirm off without a helper online for the project', async () => {
    setup(withCards(cardText()), {}, [makeRunner({ projectKeys: ['WEB'] })]);
    const card = await runAllCard();
    expect(
      await within(card).findByText('Start tracker watch on a computer for this project.'),
    ).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Confirm' })).toBeDisabled();
  });

  it('keeps Confirm off when no To do ticket would run', async () => {
    setup(withCards(cardText()), {
      previewRunAll: vi.fn().mockResolvedValue({ ...preview, tickets: [] }),
    });
    const card = await runAllCard();
    expect(await within(card).findByText('No To do tickets to run.')).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Confirm' })).toBeDisabled();
  });

  it('shows an older unconfirmed card as replaced, without Confirm', async () => {
    setup(withCards(cardText(), cardText('limit: 2\n')));
    const replaced = await screen.findByRole('region', { name: 'Replaced run all card' });
    expect(replaced).toHaveTextContent('Replaced');
    expect(within(replaced).queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Confirm' })).toHaveLength(1);
    expect(await runAllCard()).toHaveTextContent('2 at a time');
  });

  it('shows why the batch did not start', async () => {
    const runAllFromCard = vi
      .fn()
      .mockRejectedValue(new ApiError(409, 'conflict', 'Already started.'));
    setup(withCards(cardText()), { runAllFromCard });
    const user = userEvent.setup();
    const confirm = within(await runAllCard()).getByRole('button', { name: 'Confirm' });
    await waitFor(() => expect(confirm).toBeEnabled());
    await user.click(confirm);
    expect(await screen.findByText('Already started.')).toBeInTheDocument();
  });

  it('reloads its list when the To do list changed, and confirms what it shows then', async () => {
    const added: RunAllPreview = {
      ...preview,
      tickets: [...preview.tickets, { ticketKey: 'MOB-5', ticketTitle: 'Made in between' }],
    };
    const previewRunAll = vi.fn().mockResolvedValueOnce(preview).mockResolvedValue(added);
    const changed = new ApiError(409, 'conflict', 'The To do list changed. Check the card again.');
    const runAllFromCard = vi.fn().mockRejectedValueOnce(changed).mockResolvedValue({
      runId: null,
      queued: 0,
      skippedActive: 0,
      skippedDevice: 0,
      leftOver: 0,
      maxParallel: 3,
    });
    const { client } = setup(withCards(cardText()), { previewRunAll, runAllFromCard });
    const user = userEvent.setup();
    const card = await runAllCard();
    const confirm = within(card).getByRole('button', { name: 'Confirm' });
    await waitFor(() => expect(confirm).toBeEnabled());
    await user.click(confirm);

    expect(await screen.findByText(changed.message)).toBeInTheDocument();
    expect(await within(card).findByText('Made in between')).toBeInTheDocument();
    await waitFor(() => expect(confirm).toBeEnabled());
    await user.click(confirm);
    expect(client.runAllFromCard).toHaveBeenLastCalledWith('c-1', 'm-1', {
      runnerId: dara.id,
      maxParallel: 3,
      ticketKeys: ['MOB-3', 'MOB-4', 'MOB-5'],
    });
  });
});
