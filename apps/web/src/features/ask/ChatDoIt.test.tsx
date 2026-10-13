import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AskMode, ChatDetail } from '@tracker/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeAskRun, makeChat, makeChatDetail, makeMessage } from '../../api/test/chatFixtures';
import { DARA, makeRunner } from '../../api/test/runFixtures';
import { CLICK_SHIELD_MS } from '../../lib/clickShield';
import { readActionSheet, tap } from '../../overlays/testing';
import { advance, stillClock } from '../../../test/regression/stillClock';
import { DO_IT_TEXT } from './doItCopy';
import { renderAsk } from './test/renderAsk';

const options = { model: 'opus', mode: 'plan', effort: 'high' } as const;

const answered = (mode: AskMode = 'plan'): ChatDetail => {
  const run = makeAskRun({
    status: 'done',
    endedAt: Date.now(),
    askOptions: { ...options, mode },
  });
  return makeChatDetail({
    chat: makeChat({ options: { ...options, mode } }),
    messages: [
      makeMessage({ text: 'Plan a faster sync' }),
      makeMessage({ id: 'm-2', role: 'claude', text: '1. Batch.\n2. Send.', runId: run.id }),
    ],
    run,
  });
};

const sent = makeChatDetail({ run: makeAskRun({ status: 'queued' }) });

let restore: Array<() => void> = [];

beforeEach(() => localStorage.clear());
afterEach(() => restore.reverse().forEach((undo) => undo()));

function setup(detail: ChatDetail, runner = makeRunner()) {
  const rendered = renderAsk({
    client: {
      getChat: vi.fn().mockResolvedValueOnce(detail).mockResolvedValue(sent),
      listRunners: vi.fn().mockResolvedValue([runner]),
      ask: vi.fn().mockResolvedValue(sent),
    },
  });
  restore = [rendered.restore];
  return rendered;
}

const doIt = () => screen.findByRole('button', { name: 'Do it' });
const sheet = () => screen.findByRole('dialog', { name: 'Do it' });

describe('Ask: Do it', () => {
  it('asks first, then sends the plan’s go-ahead as an Edit question on the same helper', async () => {
    const { client } = setup(answered());
    const user = userEvent.setup();
    await user.click(await doIt());
    const confirm = await sheet();
    expect(confirm).toHaveTextContent(`Claude will change files on ${DARA}.`);
    expect(client.ask).not.toHaveBeenCalled();

    await readActionSheet();
    await user.click(within(confirm).getByRole('button', { name: 'Do it' }));
    expect(client.ask).toHaveBeenCalledWith('c-1', {
      runnerId: 'h-dara',
      text: DO_IT_TEXT,
      attachmentIds: [],
      model: 'opus',
      mode: 'edit',
      effort: 'high',
    });
    expect(await screen.findByRole('button', { name: 'Stop' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Do it' })).not.toBeInTheDocument();
  });

  it('sends nothing on Cancel', async () => {
    const { client } = setup(answered());
    const user = userEvent.setup();
    await user.click(await doIt());
    await user.click(within(await sheet()).getByRole('button', { name: 'Cancel' }));
    expect(client.ask).not.toHaveBeenCalled();
  });

  it('sends nothing on a double tap’s second tap', async () => {
    const { client } = setup(answered());
    const user = userEvent.setup();
    const button = await doIt();
    restore.push(stillClock());
    await tap(user, button);
    const confirm = within(await sheet()).getByRole('button', { name: 'Do it' });
    await tap(user, confirm);
    expect(client.ask).not.toHaveBeenCalled();

    await advance(CLICK_SHIELD_MS);
    await tap(user, confirm);
    expect(client.ask).toHaveBeenCalledTimes(1);
  });

  it('offers nothing under an Ask or Edit answer', async () => {
    for (const mode of ['ask', 'edit'] as const) {
      const { view, restore: undo } = renderAsk({
        client: {
          getChat: vi.fn().mockResolvedValue(answered(mode)),
          listRunners: vi.fn().mockResolvedValue([makeRunner()]),
        },
      });
      expect(await screen.findByText('Batch.')).toBeVisible();
      expect(screen.queryByRole('button', { name: 'Do it' })).not.toBeInTheDocument();
      view.unmount();
      undo();
    }
  });

  it('says so when the helper that made the plan is offline', async () => {
    setup(answered(), makeRunner({ online: false }));
    expect(await screen.findByText(`Do it needs ${DARA}, which is offline.`)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Do it' })).not.toBeInTheDocument();
  });
});
