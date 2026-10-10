import { describe, expect, it } from 'vitest';
import { DARA, makeRun, makeRunner } from '../../api/test/runFixtures';
import { chatFooter, helperOf, runHelper, thinkingText } from './chatFooter';

const dara = makeRunner();
const studio = makeRunner({ id: 'h-studio', name: 'Studio' });
const ask = (overrides = {}) =>
  makeRun({ kind: 'ask', ticketKey: null, chatId: 'c-1', ...overrides });
const input = { runners: [dara], run: null, projectKey: 'mob', lastUsedId: null };

describe('chatFooter', () => {
  it('shows Claude thinking while the latest ask waits or works, helpers known or not', () => {
    for (const status of ['queued', 'running'] as const) {
      const run = ask({ status });
      expect(chatFooter({ ...input, runners: undefined, run })).toEqual({ kind: 'thinking', run });
    }
    expect(thinkingText(ask())).toBe(`Claude is thinking on ${DARA}…`);
  });

  it('waits for the helpers before offering Send or the setup line', () => {
    expect(chatFooter({ ...input, runners: undefined })).toEqual({ kind: 'loading' });
  });

  it('asks the helper used last on this device, among the online ones serving the project', () => {
    const away = makeRunner({ id: 'h-away', online: false });
    const other = makeRunner({ id: 'h-web', projectKeys: ['WEB'] });
    const footer = chatFooter({
      ...input,
      runners: [away, other, dara, studio],
      lastUsedId: studio.id,
    });
    expect(footer).toEqual({ kind: 'ask', helpers: [dara, studio], helper: studio, stopped: null });
    expect(helperOf(footer)).toBe(studio);
  });

  it('offers setup when no helper serving the project is online', () => {
    const footer = chatFooter({ ...input, runners: [makeRunner({ online: false })] });
    expect(footer).toEqual({ kind: 'setup', stopped: null });
    expect(helperOf(footer)).toBeNull();
  });

  it('says why the latest ask stopped, and lets the person ask again', () => {
    const run = ask({ status: 'failed', error: 'Your computer stopped answering.' });
    expect(chatFooter({ ...input, run })).toMatchObject({
      kind: 'ask',
      stopped: 'Claude stopped: Your computer stopped answering.',
    });
    expect(chatFooter({ ...input, runners: [], run })).toMatchObject({ kind: 'setup' });
  });

  it('says nothing about an ask that ended well or was cancelled', () => {
    for (const status of ['done', 'cancelled'] as const) {
      expect(chatFooter({ ...input, run: ask({ status }) })).toMatchObject({ stopped: null });
    }
  });

  it("picks the card's Run helper whether or not Claude is thinking", () => {
    const runners = [dara, studio];
    expect(runHelper({ ...input, runners, lastUsedId: studio.id })).toBe(studio);
    expect(runHelper({ ...input, runners: undefined })).toBeNull();
    expect(runHelper({ ...input, runners: [makeRunner({ online: false })] })).toBeNull();
  });
});
