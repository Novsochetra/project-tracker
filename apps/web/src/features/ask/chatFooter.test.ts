import { describe, expect, it } from 'vitest';
import { DARA, makeRun, makeRunner } from '../../api/test/runFixtures';
import {
  cancelledText,
  chatFooter,
  helperOf,
  runHelper,
  thinkingText,
  stoppableRunOf,
  stoppedWithSteps,
} from './chatFooter';
import { STOPPED_PART_WAY_TEXT, STOPPED_TEXT } from './copy';

const dara = makeRunner();
const studio = makeRunner({ id: 'h-studio', name: 'Studio' });
const ask = (overrides = {}) =>
  makeRun({ kind: 'ask', ticketKey: null, chatId: 'c-1', ...overrides });
const input = { runners: [dara], run: null, projectKey: 'mob', lastUsedId: null };

describe('chatFooter', () => {
  it('shows Claude thinking while the latest ask waits or works, helpers known or not', () => {
    for (const status of ['queued', 'running'] as const) {
      const run = ask({ status });
      const footer = chatFooter({ ...input, runners: undefined, run });
      expect(footer).toEqual({ kind: 'thinking', run });
      expect(stoppableRunOf(footer)).toBe(run);
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
    expect(stoppableRunOf(footer)).toBeNull();
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
      stopped: { kind: 'failed', text: 'Claude stopped: Your computer stopped answering.' },
    });
    expect(chatFooter({ ...input, runners: [], run })).toMatchObject({ kind: 'setup' });
  });

  it('says nothing about an ask that ended well', () => {
    expect(chatFooter({ ...input, run: ask({ status: 'done' }) })).toMatchObject({ stopped: null });
  });

  it('says the person stopped the latest ask, and lets them ask again', () => {
    const run = ask({ status: 'cancelled' });
    expect(chatFooter({ ...input, run })).toMatchObject({
      kind: 'ask',
      stopped: { kind: 'cancelled', text: STOPPED_TEXT },
    });
  });

  it("picks the card's Run helper whether or not Claude is thinking", () => {
    const runners = [dara, studio];
    expect(runHelper({ ...input, runners, lastUsedId: studio.id })).toBe(studio);
    expect(runHelper({ ...input, runners: undefined })).toBeNull();
    expect(runHelper({ ...input, runners: [makeRunner({ online: false })] })).toBeNull();
  });
});

describe('cancelledText', () => {
  const edit = { model: 'default', mode: 'edit', effort: 'default' } as const;

  it('warns that an Edit question Claude had started may have changed files or tickets', () => {
    expect(cancelledText({ askOptions: edit, startedAt: 2 })).toBe(STOPPED_PART_WAY_TEXT);
  });

  it('says only that it stopped for Ask, Plan, or an Edit question still waiting', () => {
    for (const mode of ['ask', 'plan'] as const) {
      expect(
        cancelledText({ askOptions: { model: 'opus', mode, effort: 'default' }, startedAt: 2 }),
      ).toBe(STOPPED_TEXT);
    }
    expect(cancelledText({ askOptions: edit, startedAt: null })).toBe(STOPPED_TEXT);
    expect(cancelledText({ askOptions: null, startedAt: 2 })).toBe(STOPPED_TEXT);
  });
});

describe('stoppedWithSteps', () => {
  it('is a question that failed or was stopped after Claude took steps', () => {
    for (const status of ['failed', 'cancelled'] as const) {
      const run = ask({ status, stepCount: 3 });
      expect(stoppedWithSteps(run)).toBe(run);
      expect(stoppedWithSteps({ ...run, stepCount: 0 })).toBeNull();
    }
  });

  it('is none while Claude works, once it answered, or with no question', () => {
    for (const status of ['queued', 'running', 'done'] as const) {
      expect(stoppedWithSteps(ask({ status, stepCount: 3 }))).toBeNull();
    }
    expect(stoppedWithSteps(null)).toBeNull();
    expect(stoppedWithSteps(undefined)).toBeNull();
  });
});
