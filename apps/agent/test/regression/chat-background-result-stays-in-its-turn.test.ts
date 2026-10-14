import { DEFAULT_ASK_OPTIONS } from '@tracker/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { askOutcomeOf } from '../../src/watch/ask/askOutcome';
import { createChatRunner } from '../../src/watch/chat/chatRunner';
import { fakeSpawn, SESSION } from '../watch/chat/fakeChatChild';
import { askJob } from '../watch/fakeTracker';

const running: { closeAll: () => void }[] = [];
afterEach(() => running.splice(0).forEach((chats) => chats.closeAll()));

function setUp(legacy = false) {
  const { spawn, children } = fakeSpawn({ legacy });
  const chats = createChatRunner({ command: 'claude', cwd: '/repo', limit: [], spawn });
  running.push(chats);
  return { chats, children };
}

const question = (id: string, resume: string | null = null) => ({
  ...askJob(id, 'chat-1', resume, DEFAULT_ASK_OPTIONS),
  prompt: `Q ${id}`,
});

const ask = (chats: ReturnType<typeof setUp>['chats'], id: string, resume?: string) => {
  const settled = { done: false };
  const exit = chats.ask(question(id, resume ?? null), new AbortController().signal, () => {
    return undefined;
  });
  void exit.finally(() => (settled.done = true));
  return { exit, settled };
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 20));

// Review of PT-238: a turn ended on its first result, so a background sub agent's later result
// went to the next question and that question's own answer was dropped. It also freed the
// ticket lane while an Edit question's background agent could still change the folder.
describe('regression: background work stays in the turn that started it', () => {
  it('keeps the turn open until Claude Code is idle, and answers with the last result', async () => {
    const { chats, children } = setUp();
    const first = ask(chats, 'r-1');
    await vi.waitFor(() => expect(children[0]?.lines).toHaveLength(1));
    const child = children[0]!;
    child.begin();
    child.result('I started the sub agent.');
    await flush();
    expect(first.settled.done).toBe(false);
    child.print({ type: 'system', subtype: 'init' });
    child.result('The sub agent found two files.');
    child.state('idle');
    expect(askOutcomeOf(await first.exit, false)).toMatchObject({
      status: 'done',
      answer: 'The sub agent found two files.',
    });
    const second = ask(chats, 'r-2', SESSION);
    await vi.waitFor(() => expect(child.lines).toHaveLength(2));
    child.answer('Answer to r-2.');
    expect(askOutcomeOf(await second.exit, false)).toMatchObject({ answer: 'Answer to r-2.' });
  });

  it("never takes a late turn of earlier background work for the next question's", async () => {
    const { chats, children } = setUp();
    const first = ask(chats, 'r-1');
    await vi.waitFor(() => expect(children[0]?.lines).toHaveLength(1));
    const child = children[0]!;
    child.answer('Started a background shell.');
    await first.exit;
    const second = ask(chats, 'r-2', SESSION);
    await vi.waitFor(() => expect(child.lines).toHaveLength(2));
    child.state('running');
    child.print({ type: 'system', subtype: 'init' });
    child.result('The background shell finished.');
    child.state('idle');
    await flush();
    expect(second.settled.done).toBe(false);
    child.answer('Answer to r-2.');
    expect(askOutcomeOf(await second.exit, false)).toMatchObject({ answer: 'Answer to r-2.' });
  });

  it('closes stdin at the first result of a Claude Code too old to say it is idle', async () => {
    const { chats, children } = setUp(true);
    const first = ask(chats, 'r-1');
    await vi.waitFor(() => expect(children[0]?.lines).toHaveLength(1));
    children[0]?.answer('Yes.');
    expect(askOutcomeOf(await first.exit, false)).toMatchObject({ status: 'done', answer: 'Yes.' });
    expect(children[0]?.exited).toBe(true);
    const second = ask(chats, 'r-2', SESSION);
    await vi.waitFor(() => expect(children[1]?.lines).toHaveLength(1));
    children[1]?.answer('Again.');
    expect(askOutcomeOf(await second.exit, false)).toMatchObject({ answer: 'Again.' });
    expect(children[1]?.command.args).toEqual(expect.arrayContaining(['--resume', SESSION]));
  });
});
