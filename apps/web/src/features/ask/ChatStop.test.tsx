import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@tracker/client';
import type { AskMode, ChatDetail, Run } from '@tracker/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeAskRun, makeChatDetail } from '../../api/test/chatFixtures';
import { DARA, makeRunner } from '../../api/test/runFixtures';
import { CLICK_SHIELD_MS } from '../../lib/clickShield';
import { tap } from '../../overlays/testing';
import { advance, stillClock } from '../../../test/regression/stillClock';
import { STOPPED_PART_WAY_TEXT, STOPPED_TEXT } from './copy';
import { renderAsk } from './test/renderAsk';

const question = () => screen.findByRole('textbox', { name: 'Question for Claude' });
const button = (name: string) => screen.findByRole('button', { name });

const running = (mode: AskMode = 'ask') =>
  makeAskRun({
    status: 'running',
    startedAt: Date.now(),
    askOptions: { model: 'default', mode, effort: 'default' },
  });
const cancelledOf = (run: Run): Run => ({ ...run, status: 'cancelled', endedAt: Date.now() });

let restore: Array<() => void> = [];

beforeEach(() => localStorage.clear());
afterEach(() => restore.reverse().forEach((undo) => undo()));

function setup(details: ChatDetail[], client: Record<string, unknown> = {}) {
  const getChat = vi.fn();
  details.forEach((detail) => getChat.mockResolvedValueOnce(detail));
  getChat.mockResolvedValue(details.at(-1));
  const rendered = renderAsk({
    client: { getChat, listRunners: vi.fn().mockResolvedValue([makeRunner()]), ...client },
  });
  restore = [rendered.restore];
  return rendered;
}

function stoppable(run: Run, client: Record<string, unknown> = {}) {
  const stopped = cancelledOf(run);
  const cancelRun = vi.fn().mockResolvedValue(stopped);
  const details = [makeChatDetail({ run }), makeChatDetail({ run: stopped })];
  return setup(details, { cancelRun, ...client });
}

describe('Ask: Stop', () => {
  it('takes Send’s place while Claude answers, stops the question, and turns back into Send', async () => {
    const run = running();
    const { client } = stoppable(run);
    const user = userEvent.setup();
    expect(await screen.findByText(`Claude is thinking on ${DARA}…`)).toBeVisible();
    const stop = await button('Stop');
    expect(stop).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Send' })).not.toBeInTheDocument();

    await user.click(stop);
    expect(client.cancelRun).toHaveBeenCalledWith(run.id);
    expect(await screen.findByText(STOPPED_TEXT)).toBeVisible();
    expect(screen.queryByText(/Claude is thinking/)).not.toBeInTheDocument();
    expect(await button('Send')).toBe(stop);
    expect(stop).toHaveFocus();
    expect(screen.getAllByRole('article')).toHaveLength(2);
    await user.type(await question(), 'Try another way');
    expect(stop).toBeEnabled();
  });

  it('says an Edit question stopped part way, once Claude had started it', async () => {
    stoppable(running('edit'));
    await userEvent.setup().click(await button('Stop'));
    expect(await screen.findByText(STOPPED_PART_WAY_TEXT)).toBeVisible();
  });

  // PT-234: a message typed while Claude answers is sent to wait for its turn, so Send shows for
  // it; Stop is back once the box is empty.
  it('turns Stop into Send while a draft is typed, and a double tap on it never stops', async () => {
    const run = running();
    const ask = vi.fn().mockResolvedValue(makeChatDetail({ run }));
    const cancelRun = vi.fn().mockResolvedValue(cancelledOf(run));
    setup([makeChatDetail({ run })], { ask, cancelRun });
    const user = userEvent.setup();
    const stop = await button('Stop');
    await user.type(await question(), 'Try another way');
    expect(await button('Send')).toBe(stop);
    restore.push(stillClock());
    await tap(user, await button('Send'));
    await tap(user, await button('Stop'));
    expect(ask).toHaveBeenCalledTimes(1);
    expect(cancelRun).not.toHaveBeenCalled();

    await advance(CLICK_SHIELD_MS);
    await tap(user, await button('Stop'));
    expect(cancelRun).toHaveBeenCalledTimes(1);
  });

  it('does not stop the question on the second tap of a double tap on Send', async () => {
    const asked = makeChatDetail({ run: running() });
    const cancelRun = vi.fn();
    setup([makeChatDetail(), asked], { ask: vi.fn().mockResolvedValue(asked), cancelRun });
    const user = userEvent.setup();
    await user.type(await question(), 'And offline?');
    restore.push(stillClock());
    await tap(user, await button('Send'));
    await tap(user, await button('Stop'));
    expect(cancelRun).not.toHaveBeenCalled();
  });

  it('shows why a Stop failed and turns back into Send once Claude has finished', async () => {
    const run = running();
    const done = { ...run, status: 'done' as const, endedAt: Date.now() };
    const conflict = new ApiError(409, 'conflict', 'This run already ended (done).');
    const { client } = setup([makeChatDetail({ run }), makeChatDetail({ run: done })], {
      cancelRun: vi.fn().mockRejectedValue(conflict),
    });
    const stop = await button('Stop');
    await userEvent.setup().click(stop);

    expect(await screen.findByText('This run already ended (done).')).toBeVisible();
    expect(await button('Send')).toBe(stop);
    expect(client.getChat).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(STOPPED_TEXT)).not.toBeInTheDocument();
  });
});
