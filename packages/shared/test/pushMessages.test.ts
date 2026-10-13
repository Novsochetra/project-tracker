import { describe, expect, it } from 'vitest';
import {
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

  it('names what Claude wants to do with the card’s first line, and where', () => {
    expect(permissionPush({ ticket: { ...TICKET, num: 12 } }, 'Run git push')).toEqual({
      title: 'Claude wants to run git push on MOB-12',
      body: 'Fix the login button',
      url: '/p/MOB/12',
      tag: 'ticket:MOB-12',
    });
    const edit = 'Edit src/auth.ts\n- old line\n+ new line';
    expect(permissionPush({ chat: CHAT }, edit)).toEqual({
      title: 'Claude wants to edit src/auth.ts …',
      body: 'Login bug',
      url: '/p/MOB/ask/c-1',
      tag: 'chat:c-1',
    });
    expect(
      permissionPush({ ticket: TICKET }, 'Use github: merge_pull_request\nowner: octo').title,
    ).toBe('Claude wants to use github: merge_pull_request … on MOB-3');
  });

  it('cuts a long command so the title stays short, and keeps the key', () => {
    const label = 'Run npm run verify -- --workspace apps/server --reporter verbose';
    const { title } = permissionPush({ ticket: TICKET }, label);
    expect(title).toBe('Claude wants to run npm run verify -- --workspace apps/… on MOB-3');
    expect([...title.slice('Claude wants to '.length, -' on MOB-3'.length)]).toHaveLength(40);
  });

  it('shows characters that hide or reorder a command as a replacement mark', () => {
    expect(permissionPush({ ticket: TICKET }, 'Run ls \u202Ehs.lru | lruc').title).toBe(
      'Claude wants to run ls \uFFFDhs.lru | lruc on MOB-3',
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
