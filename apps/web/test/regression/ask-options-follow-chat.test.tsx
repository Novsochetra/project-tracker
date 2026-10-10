import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AskOptions, ChatDetail } from '@tracker/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeChat, makeChatDetail } from '../../src/api/test/chatFixtures';
import { makeRunner } from '../../src/api/test/runFixtures';
import { queryKeys } from '../../src/api/queryKeys';
import { renderAsk } from '../../src/features/ask/test/renderAsk';

let restore: () => void;

beforeEach(() => localStorage.clear());
afterEach(() => restore());

const modelChip = () => screen.findByRole('button', { name: /^Model/ });
const mode = (name: string) => screen.getByRole('button', { name });
const savedAs = (options: AskOptions): ChatDetail =>
  makeChatDetail({ chat: makeChat({ options }) });

// PT-160 review: the composer read the chat's saved options once, so a choice saved on another
// device did not show until the screen was opened again.
describe('regression: the options row and the chat’s saved choice', () => {
  function setup() {
    const rendered = renderAsk({
      client: {
        getChat: vi.fn().mockResolvedValue(savedAs({ model: 'default', mode: 'ask' })),
        listRunners: vi.fn().mockResolvedValue([makeRunner()]),
        ask: vi.fn().mockResolvedValue(savedAs({ model: 'haiku', mode: 'ask' })),
      },
    });
    restore = rendered.restore;
    const save = (options: AskOptions) =>
      act(() => rendered.queryClient.setQueryData(queryKeys.chat('c-1'), savedAs(options)));
    return save;
  }

  it('follows the saved choice when it changes', async () => {
    const save = setup();
    expect(await modelChip()).toHaveTextContent('Default');
    await save({ model: 'opus', mode: 'plan' });
    expect(await modelChip()).toHaveTextContent('Opus');
    expect(mode('Plan')).toHaveAttribute('aria-pressed', 'true');
  });

  it('keeps a choice the person made and has not sent', async () => {
    const save = setup();
    const user = userEvent.setup();
    await user.click(await modelChip());
    await user.click(screen.getByRole('option', { name: 'Haiku' }));
    await save({ model: 'opus', mode: 'plan' });
    expect(await modelChip()).toHaveTextContent('Haiku');
    expect(mode('Plan')).toHaveAttribute('aria-pressed', 'true');
  });

  it('follows the saved choice again once the question is sent', async () => {
    const save = setup();
    const user = userEvent.setup();
    await user.click(await modelChip());
    await user.click(screen.getByRole('option', { name: 'Haiku' }));
    await user.type(screen.getByRole('textbox', { name: 'Question for Claude' }), 'Why?');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(screen.getByRole('textbox', { name: /Question/ })).toHaveValue(''));
    await save({ model: 'sonnet', mode: 'ask' });
    expect(await modelChip()).toHaveTextContent('Sonnet');
  });
});
