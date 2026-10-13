import type { Run } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { DARA, makeRun, makeRunner } from '../../api/test/runFixtures';
import {
  helpersFor,
  pickHelper,
  runFooter,
  sentText,
  shownRun,
  STOPPED_SHOWN_MS,
  stoppedText,
  workingText,
} from './runs';

const NOW = 1_000_000_000;
const dara = makeRunner();
const studio = makeRunner({ id: 'h-studio', name: 'Studio', projectKeys: ['WEB', 'mob'] });

describe('helpersFor', () => {
  it('offers the online helpers that serve the ticket’s project', () => {
    const offline = makeRunner({ id: 'h-old', online: false });
    const web = makeRunner({ id: 'h-web', projectKeys: ['WEB'] });
    expect(helpersFor([dara, offline, web, studio], 'MOB')).toEqual([dara, studio]);
    expect(helpersFor([offline, web], 'MOB')).toEqual([]);
  });
});

describe('pickHelper', () => {
  const helpers = [dara, studio];

  it('picks the helper used last, else the first one', () => {
    expect(pickHelper(helpers, 'h-studio')).toBe(studio);
    expect(pickHelper(helpers, null)).toBe(dara);
    expect(pickHelper(helpers, 'h-gone')).toBe(dara);
    expect(pickHelper([], 'h-studio')).toBeUndefined();
  });
});

describe('runFooter', () => {
  const base = { runners: [dara, studio], runs: [], projectKey: 'MOB', lastUsedId: null };

  it('offers Run on the helper used last, among the online ones serving the project', () => {
    expect(runFooter(base)).toEqual({ kind: 'run', helpers: [dara, studio], helper: dara });
    expect(runFooter({ ...base, lastUsedId: studio.id })).toMatchObject({ helper: studio });
  });

  it('says where Claude works while the latest run waits or works', () => {
    const running = makeRun({ status: 'running' });
    expect(runFooter({ ...base, runs: [running] })).toEqual({ kind: 'working', run: running });
    expect(runFooter({ ...base, runners: [], runs: [running] })).toMatchObject({
      kind: 'working',
    });
    expect(runFooter({ ...base, runs: [makeRun({ status: 'done' })] })).toMatchObject({
      kind: 'run',
    });
  });

  it('offers to set up a computer once the helpers are known and none can run it', () => {
    expect(runFooter({ ...base, runners: [makeRunner({ online: false })] })).toEqual({
      kind: 'setup',
    });
    expect(runFooter({ ...base, projectKey: 'WEB', runners: [dara] })).toEqual({ kind: 'setup' });
  });

  it('keeps Copy alone until the helpers and the project are known', () => {
    expect(runFooter({ ...base, runners: undefined })).toEqual({ kind: 'copy' });
    expect(runFooter({ ...base, projectKey: undefined })).toEqual({ kind: 'copy' });
  });
});

describe('run texts', () => {
  it('names the computer and the reason', () => {
    expect(workingText(makeRun())).toBe(`Claude is working on ${DARA}…`);
    expect(sentText(dara)).toBe(`Sent to Claude on ${DARA}`);
    expect(stoppedText(makeRun({ error: 'Your computer stopped answering.' }))).toBe(
      'Claude stopped: Your computer stopped answering.',
    );
    expect(stoppedText(makeRun({ error: null }))).toBe('Claude stopped.');
  });
});

describe('shownRun', () => {
  const failed = (endedAt: number) =>
    makeRun({ status: 'failed', error: 'Exit 1', createdAt: endedAt - 5, endedAt });

  it('shows a waiting or working run', () => {
    expect(shownRun([makeRun()], NOW)).toMatchObject({
      state: 'working',
      text: `Claude is working on ${DARA}…`,
    });
  });

  it('shows a failure for a day', () => {
    expect(shownRun([failed(NOW - STOPPED_SHOWN_MS + 1)], NOW)).toMatchObject({
      state: 'stopped',
      text: 'Claude stopped: Exit 1',
    });
    expect(shownRun([failed(NOW - STOPPED_SHOWN_MS)], NOW)).toBeNull();
  });

  it('shows nothing once the latest run is done or cancelled', () => {
    expect(shownRun([makeRun({ status: 'done', endedAt: NOW }), failed(NOW)], NOW)).toBeNull();
    expect(shownRun([makeRun({ status: 'cancelled', endedAt: NOW })], NOW)).toBeNull();
    expect(shownRun([], NOW)).toBeNull();
  });

  it('says why the automatic review stopped after a run that ended well, for a day', () => {
    const stopped = (chainStop: Run['chainStop'], endedAt = NOW) =>
      shownRun([makeRun({ status: 'done', endedAt, chainStop })], NOW);
    expect(stopped('rounds')).toMatchObject({
      state: 'stopped',
      text: 'Automatic review stopped. The review still asks for changes after 2 rounds.',
    });
    expect(stopped('moved')?.text).toBe('Automatic review stopped. You moved the ticket.');
    expect(stopped('offline')?.text).toBe(
      `Automatic review stopped. ${DARA} can't take the next run.`,
    );
    expect(stopped('moved', NOW - STOPPED_SHOWN_MS)).toBeNull();
    expect(stopped(null)).toBeNull();
  });
});
