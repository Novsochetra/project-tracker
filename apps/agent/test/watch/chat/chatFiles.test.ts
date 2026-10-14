import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { DEFAULT_ASK_OPTIONS, type Attachment } from '@tracker/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createChatRunner } from '../../../src/watch/chat/chatRunner';
import { askJob } from '../fakeTracker';
import { fakeSpawn } from './fakeChatChild';

const board: Attachment = {
  id: 'f1',
  ticketId: null,
  activityId: null,
  fileName: 'board.jpg',
  mimeType: 'image/jpeg',
  size: 9,
  width: 4,
  height: 3,
  url: '/api/attachments/f1/file',
  createdAt: 1,
};

const running: { closeAll: () => void }[] = [];
afterEach(() => running.splice(0).forEach((chats) => chats.closeAll()));

const fetchFile = (id: string) => Promise.resolve(new Response(`bytes of ${id}`));

describe("a question's files in a chat's open claude", () => {
  it('go in a folder inside the added folder for the answer only, and the process stays', async () => {
    const { spawn, children } = fakeSpawn();
    const chats = createChatRunner({
      command: 'claude',
      cwd: '/repo',
      limit: [],
      spawn,
      fetchFile,
    });
    running.push(chats);
    const job = {
      ...askJob('r-1', 'chat-1', null, DEFAULT_ASK_OPTIONS),
      prompt: 'What is wrong here?',
      files: [board],
    };
    const exit = chats.ask(job, new AbortController().signal, () => undefined);
    await vi.waitFor(() => expect(children[0]?.messages()).toHaveLength(1));
    const child = children[0]!;
    const added = child.command.args[child.command.args.indexOf('--add-dir') + 1] ?? '';
    const path = /^- (.+board\.jpg)$/m.exec(child.messages()[0] ?? '')?.[1] ?? '';
    expect(dirname(dirname(path))).toBe(added);
    expect(readFileSync(path, 'utf8')).toBe('bytes of f1');

    child.answer('A loose cable.');
    await exit;
    expect(existsSync(path)).toBe(false);
    expect(readdirSync(added)).toEqual([]);
    expect(child.exited).toBe(false);

    chats.closeAll();
    await vi.waitFor(() => expect(existsSync(added)).toBe(false));
  });
});
