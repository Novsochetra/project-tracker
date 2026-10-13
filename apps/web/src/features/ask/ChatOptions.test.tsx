import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ChatDetail } from '@tracker/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeChat, makeChatDetail, makeMessage } from '../../api/test/chatFixtures';
import { makeRunner } from '../../api/test/runFixtures';
import { ASK_HINT, EDIT_HINT } from './copy';
import { renderAsk } from './test/renderAsk';

const dara = makeRunner();
const question = () => screen.findByRole('textbox', { name: 'Question for Claude' });
const modelChip = () => screen.findByRole('button', { name: /^Model/ });
const effortChip = () => screen.queryByRole('button', { name: /^Effort/ });
const mode = (name: string) => screen.getByRole('button', { name });

let restore: () => void;

beforeEach(() => localStorage.clear());
afterEach(() => restore());

function setup(detail: ChatDetail | null, client: Record<string, unknown> = {}) {
  const rendered = renderAsk({
    path: detail ? `/p/MOB/ask/${detail.chat.id}` : '/p/MOB/ask/new',
    client: {
      getChat: vi.fn().mockResolvedValue(detail),
      listRunners: vi.fn().mockResolvedValue([dara]),
      ...client,
    },
  });
  restore = rendered.restore;
  return rendered;
}

async function sendQuestion(text: string) {
  const user = userEvent.setup();
  await user.type(await question(), text);
  await user.click(screen.getByRole('button', { name: 'Send' }));
}

describe('Ask: the model, effort and mode pickers', () => {
  it('start a new chat on Default and Ask, with its hint', async () => {
    setup(null);
    expect(await modelChip()).toHaveTextContent('Default');
    expect(effortChip()).toHaveTextContent('Default');
    expect(screen.getByRole('group', { name: 'Mode' })).toBeInTheDocument();
    expect(mode('Ask')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(ASK_HINT)).toBeVisible();
    expect(screen.queryByText(EDIT_HINT)).not.toBeInTheDocument();
  });

  it("start an existing chat from the chat's last choice", async () => {
    setup(
      makeChatDetail({
        chat: makeChat({ options: { model: 'opus', mode: 'edit', effort: 'xhigh' } }),
      }),
    );
    expect(await modelChip()).toHaveTextContent('Opus');
    expect(effortChip()).toHaveTextContent('X-high');
    expect(mode('Edit')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(EDIT_HINT)).toBeVisible();
  });

  it('send the chosen names with the next question', async () => {
    const detail = makeChatDetail();
    const ask = vi.fn().mockResolvedValue(detail);
    const { client } = setup(detail, { ask });
    const user = userEvent.setup();
    await user.click(await modelChip());
    await user.click(screen.getByRole('option', { name: 'Sonnet' }));
    await user.click(effortChip()!);
    await user.click(screen.getByRole('option', { name: 'Max' }));
    await user.click(mode('Plan'));
    await sendQuestion('Plan offline mode');

    expect(client.ask).toHaveBeenCalledWith('c-1', {
      runnerId: dara.id,
      text: 'Plan offline mode',
      model: 'sonnet',
      mode: 'plan',
      effort: 'max',
    });
  });

  it('hide the effort for Haiku and bring the choice back for another model', async () => {
    setup(
      makeChatDetail({
        chat: makeChat({ options: { model: 'opus', mode: 'ask', effort: 'high' } }),
      }),
    );
    const user = userEvent.setup();
    await user.click(await modelChip());
    await user.click(screen.getByRole('option', { name: 'Haiku' }));
    expect(effortChip()).not.toBeInTheDocument();

    await user.click(await modelChip());
    await user.click(screen.getByRole('option', { name: 'Sonnet' }));
    expect(effortChip()).toHaveTextContent('High');
  });

  it('send the choice with the first question of a new chat', async () => {
    const startChat = vi.fn().mockResolvedValue(makeChatDetail({ messages: [makeMessage()] }));
    const { client } = setup(null, { startChat });
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Edit' }));
    expect(screen.getByText(EDIT_HINT)).toBeVisible();
    await sendQuestion('Fix the typo');

    expect(client.startChat).toHaveBeenCalledWith('MOB', {
      runnerId: dara.id,
      text: 'Fix the typo',
      model: 'default',
      mode: 'edit',
      effort: 'default',
    });
  });
});
