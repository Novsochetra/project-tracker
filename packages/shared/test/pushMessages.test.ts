import { describe, expect, it } from 'vitest';
import {
  batchEndedPush,
  chainStoppedPush,
  chatAnsweredPush,
  chatPath,
  permissionPush,
  questionPush,
  reviewedPush,
  runEndedPush,
  ticketPath,
} from '../src/logic/pushMessages';

const TICKET = { projectKey: 'MOB', num: 3, title: 'Fix the login button' };
const CHAT = { projectKey: 'MOB', chatId: 'c-1', title: 'Login bug' };

describe('push messages', () => {
  it('says a ticket run finished and opens the ticket', () => {
    expect(runEndedPush(TICKET, null)).toEqual({
      title: 'MOB-3: Claude finished',
      body: 'Fix the login button',
      url: '/p/MOB/3',
      tag: 'ticket:MOB-3',
    });
  });

  it('says why a ticket run stopped', () => {
    expect(runEndedPush(TICKET, 'That computer was removed.').title).toBe(
      'MOB-3: Claude stopped: That computer was removed.',
    );
  });

  it('says how many tickets a batch did and which it left, and opens Activity', () => {
    const batch = { runId: 'r-1', projectKey: 'MOB', total: 10, notDoneKeys: ['MOB-3', 'MOB-7'] };
    expect(batchEndedPush(batch, null)).toEqual({
      title: 'MOB: Run all finished: 8 of 10 done',
      body: 'Not finished: MOB-3, MOB-7',
      url: '/activity',
      tag: 'batch:r-1',
    });
  });

  it('says a batch did every ticket, or why it stopped', () => {
    const batch = { runId: 'r-1', projectKey: 'MOB', total: 2, notDoneKeys: [] };
    expect(batchEndedPush(batch, null).body).toBe('Every ticket is done.');
    const stopped = batchEndedPush({ ...batch, notDoneKeys: ['MOB-2'] }, 'Claude exited.');
    expect(stopped.title).toBe('MOB: Run all stopped: 1 of 2 done');
    expect(stopped.body).toBe('Claude exited. · Not finished: MOB-2');
  });

  it('says the automatic review stopped and why, under the ticket’s tag', () => {
    expect(chainStoppedPush(TICKET, 'You moved the ticket.')).toEqual({
      title: 'MOB-3: Automatic review stopped',
      body: 'You moved the ticket.',
      url: '/p/MOB/3',
      tag: 'ticket:MOB-3',
    });
  });

  it('says a reviewed ticket is ready with its rating, under the same tag as its run', () => {
    expect(reviewedPush(TICKET, 4)).toEqual({
      title: 'MOB-3 is ready for you · 4/5',
      body: 'Fix the login button',
      url: '/p/MOB/3',
      tag: 'ticket:MOB-3',
    });
  });

  it('shows the start of a chat answer on one line and opens the chat', () => {
    const chat = { projectKey: 'MOB', chatId: 'c-1', title: 'Login bug' };
    expect(chatAnsweredPush(chat, 'It is in\n\n  `auth.ts`.')).toEqual({
      title: 'Claude answered: Login bug',
      body: 'It is in `auth.ts`.',
      url: '/p/MOB/ask/c-1',
      tag: 'chat:c-1',
    });
    expect(chatAnsweredPush({ ...chat, title: ' ' }, 'Yes').title).toBe('Claude answered');
  });

  it('says Claude has a question on a ticket, with the question, under the ticket’s tag', () => {
    expect(questionPush({ ticket: TICKET }, 'Which name should\nthe setting have?')).toEqual({
      title: 'MOB-3: Claude has a question',
      body: 'Which name should the setting have?',
      url: '/p/MOB/3',
      tag: 'ticket:MOB-3',
    });
  });

  it('says Claude has a question in a chat, under the tag its answer will replace', () => {
    expect(questionPush({ chat: CHAT }, 'Plan or edit?')).toEqual({
      title: 'Claude has a question: Login bug',
      body: 'Plan or edit?',
      url: '/p/MOB/ask/c-1',
      tag: 'chat:c-1',
    });
    expect(questionPush({ chat: { ...CHAT, title: '' } }, 'Plan or edit?').title).toBe(
      'Claude has a question',
    );
  });

  it('says what Claude wants to do after the key, and opens the ticket or the chat', () => {
    expect(permissionPush({ ticket: { ...TICKET, num: 12 } }, 'Run git push origin main')).toEqual({
      title: 'MOB-12: Claude wants to run git push',
      body: 'Fix the login button',
      url: '/p/MOB/12',
      tag: 'ticket:MOB-12',
    });
    const edit = 'Edit src/auth.ts\n- old line\n+ new line';
    expect(permissionPush({ chat: CHAT }, edit)).toEqual({
      title: 'Claude wants to edit src/auth.ts',
      body: 'Login bug',
      url: '/p/MOB/ask/c-1',
      tag: 'chat:c-1',
    });
  });

  it('cuts a long path so the title stays short', () => {
    const label = `Write ${'docs/'.repeat(10)}a.md`;
    const { title } = permissionPush({ ticket: TICKET }, label);
    expect(title).toBe(`MOB-3: Claude wants to write ${'docs/'.repeat(6)}doc…`);
    expect([...title.slice('MOB-3: Claude wants to '.length)]).toHaveLength(40);
  });

  it('shows characters that hide or reorder a path as a replacement mark', () => {
    expect(permissionPush({ ticket: TICKET }, 'Read \u202Eexe.txt').title).toBe(
      'MOB-3: Claude wants to read \uFFFDexe.txt',
    );
  });

  it('asks for an OK without saying what, when nothing safe can be shown', () => {
    expect(permissionPush({ ticket: TICKET }, "Search for 'hunter2' in src").title).toBe(
      'MOB-3: Claude wants your OK',
    );
    expect(permissionPush({ chat: CHAT }, 'Run TOKEN=abc123 npm test').title).toBe(
      'Claude wants your OK',
    );
  });

  it('cuts long text by code point, so an emoji is never split', () => {
    const body = runEndedPush({ ...TICKET, title: `${'a'.repeat(298)}😀😀😀` }, null).body;
    expect([...body]).toHaveLength(300);
    expect(body.endsWith('a😀…')).toBe(true);
  });

  it('escapes keys and ids in paths', () => {
    expect(ticketPath('MOB', 12)).toBe('/p/MOB/12');
    expect(chatPath('MOB', 'a/b')).toBe('/p/MOB/ask/a%2Fb');
  });
});
