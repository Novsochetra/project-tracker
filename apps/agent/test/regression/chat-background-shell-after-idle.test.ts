import { DEFAULT_ASK_OPTIONS, type AskMode } from '@tracker/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createChatRunner } from '../../src/watch/chat/chatRunner';
import { fakeSpawn, SESSION, type FakeChatChild } from '../watch/chat/fakeChatChild';
import { askJob } from '../watch/fakeTracker';

const running: { closeAll: () => void }[] = [];
afterEach(() => running.splice(0).forEach((chats) => chats.closeAll()));

function setUp() {
  const { spawn, children } = fakeSpawn();
  const chats = createChatRunner({ command: 'claude', cwd: '/repo', limit: [], spawn });
  running.push(chats);
  return { chats, children };
}

const question = (id: string, mode: AskMode, resume: string | null = null) => ({
  ...askJob(id, 'chat-1', resume, { ...DEFAULT_ASK_OPTIONS, mode }),
  prompt: `Q ${id}`,
});

const startShell = (child: FakeChatChild, id: string) =>
  child.print({ type: 'system', subtype: 'task_started', task_id: id, task_type: 'local_bash' });

async function askWithShell(setup: ReturnType<typeof setUp>, mode: AskMode, shellEnds: boolean) {
  const exit = setup.chats.ask(question('r-1', mode), new AbortController().signal, () => {
    return undefined;
  });
  await vi.waitFor(() => expect(setup.children[0]?.lines).toHaveLength(1));
  const child = setup.children[0]!;
  child.begin();
  startShell(child, 'b1');
  if (shellEnds) {
    child.print({
      type: 'system',
      subtype: 'task_notification',
      task_id: 'b1',
      status: 'completed',
    });
  }
  child.result('Started the dev server.');
  child.state('idle');
  await exit;
  return child;
}

// Review of PT-238: a background shell that finishes after idle starts a turn nobody watches. In
// an Edit or Auto chat that turn could change the folder while a ticket run holds the lane.
describe('regression: an Edit chat with a shell still running is closed at turn end', () => {
  it.each(['edit', 'auto'] as const)(
    'closes a %s chat, and the next message resumes',
    async (mode) => {
      const setup = setUp();
      const child = await askWithShell(setup, mode, false);
      await vi.waitFor(() => expect(child.exited).toBe(true));
      const next = setup.chats.ask(
        question('r-2', mode, SESSION),
        new AbortController().signal,
        () => {
          return undefined;
        },
      );
      await vi.waitFor(() => expect(setup.children[1]?.lines).toHaveLength(1));
      setup.children[1]!.answer('Again.');
      await next;
      expect(setup.children[1]?.command.args).toEqual(
        expect.arrayContaining(['--resume', SESSION]),
      );
    },
  );

  it('keeps an Edit chat whose shell ended within the turn', async () => {
    const setup = setUp();
    const child = await askWithShell(setup, 'edit', true);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(child.exited).toBe(false);
  });

  it('keeps an Ask chat, which cannot change the folder', async () => {
    const setup = setUp();
    const child = await askWithShell(setup, 'ask', false);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(child.exited).toBe(false);
  });
});
