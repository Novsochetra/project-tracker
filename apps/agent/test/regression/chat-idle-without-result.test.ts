import { CHAT_NO_ANSWER, DEFAULT_ASK_OPTIONS } from '@tracker/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { askOutcomeOf } from '../../src/watch/ask/askOutcome';
import { createChatRunner } from '../../src/watch/chat/chatRunner';
import { fakeSpawn } from '../watch/chat/fakeChatChild';
import { askJob } from '../watch/fakeTracker';

const running: { closeAll: () => void }[] = [];
afterEach(() => running.splice(0).forEach((chats) => chats.closeAll()));

// Review of PT-238: a turn ended on idle only once it had a result, so one that went idle after
// its replay with no result hung until the person tapped Stop.
describe('regression: a turn that goes idle with no result ends', () => {
  it('ends the turn as no answer, and the process takes the next message', async () => {
    const { spawn, children } = fakeSpawn();
    const chats = createChatRunner({ command: 'claude', cwd: '/repo', limit: [], spawn });
    running.push(chats);
    const job = { ...askJob('r-1', 'chat-1', null, DEFAULT_ASK_OPTIONS), prompt: 'Q r-1' };
    const exit = chats.ask(job, new AbortController().signal, () => undefined);
    await vi.waitFor(() => expect(children[0]?.lines).toHaveLength(1));
    const child = children[0]!;
    child.begin();
    child.state('idle');
    expect(askOutcomeOf(await exit, false)).toEqual({ status: 'failed', error: CHAT_NO_ANSWER });
    expect(child.exited).toBe(false);
  });
});
