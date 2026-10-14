import { DEFAULT_ASK_OPTIONS } from '@tracker/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { askOutcomeOf } from '../../../src/watch/ask/askOutcome';
import { CHAT_BUSY } from '../../../src/watch/chat/chatPool';
import { createChatRunner } from '../../../src/watch/chat/chatRunner';
import { askJob } from '../fakeTracker';
import { fakeSpawn, SESSION } from './fakeChatChild';

const running: { closeAll: () => void }[] = [];
afterEach(() => running.splice(0).forEach((chats) => chats.closeAll()));

function setUp(pool: { idleMs?: number; max?: number } = {}) {
  const { spawn, children } = fakeSpawn();
  const chats = createChatRunner({ command: 'claude', cwd: '/repo', limit: [], spawn, pool });
  running.push(chats);
  return { chats, children };
}

const question = (
  id: string,
  { chatId = 'chat-1', resume = null as string | null, options = DEFAULT_ASK_OPTIONS } = {},
) => ({ ...askJob(id, chatId, resume, options), prompt: `Q ${id}` });

const go = () => new AbortController().signal;
const noEvents = () => undefined;

// Asks, and has the process the message went to answer it.
async function answeredBy(
  setup: ReturnType<typeof setUp>,
  job: ReturnType<typeof question>,
  text = 'Yes.',
) {
  const exit = setup.chats.ask(job, go(), noEvents);
  const asked = () =>
    setup.children.find((child) => !child.exited && child.messages().at(-1) === job.prompt);
  await vi.waitFor(() => expect(asked()).toBeDefined());
  asked()!.answer(text);
  return askOutcomeOf(await exit, false);
}

describe('a chat keeps one open claude', () => {
  it('sends a second message to the same process, each turn ending on its result', async () => {
    const setup = setUp();
    expect(await answeredBy(setup, question('r-1'), 'First.')).toEqual({
      status: 'done',
      answer: 'First.',
      sessionId: SESSION,
    });
    const second = await answeredBy(setup, question('r-2', { resume: SESSION }), 'Second.');
    expect(second).toMatchObject({ status: 'done', answer: 'Second.' });
    expect(setup.children).toHaveLength(1);
    expect(setup.children[0]?.messages()).toEqual([
      expect.stringContaining('Q r-1'),
      expect.stringContaining('Q r-2'),
    ]);
    expect(setup.children[0]?.exited).toBe(false);
  });

  it('starts claude reading stream-json, and puts the message on stdin, never in its arguments', async () => {
    const setup = setUp();
    const job = { ...question('r-1'), prompt: '--dangerously-skip-permissions\nrm -rf /' };
    await answeredBy(setup, job);
    const { args } = setup.children[0]!.command;
    expect(args.slice(0, 7)).toEqual([
      '-p',
      '--input-format',
      'stream-json',
      '--replay-user-messages',
      '--output-format',
      'stream-json',
      '--verbose',
    ]);
    expect(args).not.toContain('--dangerously-skip-permissions');
    expect(setup.children[0]?.lines).toHaveLength(1);
    expect(setup.children[0]?.messages()[0]).toBe('--dangerously-skip-permissions\nrm -rf /');
  });

  it('closes an idle process, and the next message resumes the session in a new one', async () => {
    const setup = setUp({ idleMs: 20 });
    await answeredBy(setup, question('r-1'));
    await vi.waitFor(() => expect(setup.children[0]?.exited).toBe(true));
    expect(setup.children[0]?.killed).toBe(false);
    await answeredBy(setup, question('r-2', { resume: SESSION }));
    expect(setup.children).toHaveLength(2);
    expect(setup.children[1]?.command.args).toEqual(expect.arrayContaining(['--resume', SESSION]));
  });

  it('keeps no more than the cap open, closing the one idle longest', async () => {
    const setup = setUp({ max: 2 });
    await answeredBy(setup, question('r-1', { chatId: 'a' }));
    await answeredBy(setup, question('r-2', { chatId: 'b' }));
    await answeredBy(setup, question('r-3', { chatId: 'a', resume: SESSION }));
    await answeredBy(setup, question('r-4', { chatId: 'c' }));
    const [a, b, c] = setup.children;
    expect(setup.children).toHaveLength(3);
    expect(b?.exited).toBe(true);
    expect(a?.exited).toBe(false);
    expect(c?.exited).toBe(false);
  });

  it.each([
    ['model', { ...DEFAULT_ASK_OPTIONS, model: 'opus' }, ['--model', 'opus']],
    ['mode', { ...DEFAULT_ASK_OPTIONS, mode: 'edit' }, ['--permission-mode', 'default']],
    [
      'effort',
      { ...DEFAULT_ASK_OPTIONS, model: 'opus', effort: 'high' },
      ['--model', 'opus', '--effort', 'high'],
    ],
  ] as const)(
    'starts a fresh resumed process when the %s changes',
    async (_name, options, args) => {
      const setup = setUp();
      await answeredBy(
        setup,
        question('r-1', { options: { ...DEFAULT_ASK_OPTIONS, model: 'sonnet' } }),
      );
      await answeredBy(setup, question('r-2', { resume: SESSION, options }));
      expect(setup.children).toHaveLength(2);
      expect(setup.children[0]?.exited).toBe(true);
      expect(setup.children[1]?.command.args).toEqual(
        expect.arrayContaining([...args, '--resume', SESSION]),
      );
    },
  );

  it('starts afresh when the tracker sends the whole chat instead of resuming', async () => {
    const setup = setUp();
    await answeredBy(setup, question('r-1'));
    await answeredBy(setup, question('r-2'));
    expect(setup.children).toHaveLength(2);
    expect(setup.children[1]?.command.args).not.toContain('--resume');
  });

  it('kills the process on stop, and the next message resumes in a new one', async () => {
    const setup = setUp();
    await answeredBy(setup, question('r-1'));
    const stop = new AbortController();
    const exit = setup.chats.ask(question('r-2', { resume: SESSION }), stop.signal, noEvents);
    await vi.waitFor(() => expect(setup.children[0]?.lines).toHaveLength(2));
    stop.abort();
    expect(askOutcomeOf(await exit, true)).toEqual({ status: 'cancelled' });
    expect(setup.children[0]?.killed).toBe(true);
    await answeredBy(setup, question('r-3', { resume: SESSION }));
    expect(setup.children).toHaveLength(2);
    expect(setup.children[1]?.command.args).toEqual(expect.arrayContaining(['--resume', SESSION]));
  });

  it('fails the turn when claude dies, and resumes on the next message', async () => {
    const setup = setUp();
    await answeredBy(setup, question('r-1'));
    const exit = setup.chats.ask(question('r-2', { resume: SESSION }), go(), noEvents);
    await vi.waitFor(() => expect(setup.children[0]?.lines).toHaveLength(2));
    setup.children[0]?.stderr.write('out of memory\n');
    setup.children[0]?.exit(137, null);
    expect(askOutcomeOf(await exit, false)).toEqual({
      status: 'failed',
      error: 'Claude Code exited with 137.\nout of memory',
    });
    await answeredBy(setup, question('r-3', { resume: SESSION }));
    expect(setup.children).toHaveLength(2);
  });

  it("says Claude's own words when a turn ends with an error, and keeps the process", async () => {
    const setup = setUp();
    const exit = setup.chats.ask(question('r-1'), go(), noEvents);
    await vi.waitFor(() => expect(setup.children[0]?.lines).toHaveLength(1));
    setup.children[0]?.answer('Credit balance is too low', true);
    expect(askOutcomeOf(await exit, false)).toEqual({
      status: 'failed',
      error: 'Claude Code answered with an error.\nCredit balance is too low',
    });
    expect(setup.children[0]?.exited).toBe(false);
  });

  it('refuses a second message while the chat is still answering', async () => {
    const setup = setUp();
    void setup.chats.ask(question('r-1'), go(), noEvents);
    await vi.waitFor(() => expect(setup.children[0]?.lines).toHaveLength(1));
    await expect(setup.chats.ask(question('r-2'), go(), noEvents)).rejects.toThrow(CHAT_BUSY);
  });

  it('closes every open process when the helper stops', async () => {
    const setup = setUp();
    await answeredBy(setup, question('r-1', { chatId: 'a' }));
    await answeredBy(setup, question('r-2', { chatId: 'b' }));
    setup.chats.closeAll();
    await vi.waitFor(() => expect(setup.children.every((child) => child.exited)).toBe(true));
  });
});
