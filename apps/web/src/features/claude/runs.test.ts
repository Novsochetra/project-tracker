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
  workingRun,
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
  it('offers Run with a helper, the working line during a run and setup once helpers are known', () => {
    const base = { helpersKnown: true, helperCount: 0, working: false };
    expect(runFooter({ ...base, helperCount: 2 })).toBe('run');
    expect(runFooter({ ...base, helperCount: 1, working: true })).toBe('working');
    expect(runFooter({ ...base, working: true })).toBe('working');
    expect(runFooter(base)).toBe('setup');
    expect(runFooter({ ...base, helpersKnown: false })).toBe('copy');
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

describe('workingRun', () => {
  it('is the latest run while it waits or works', () => {
    const running = makeRun({ status: 'running' });
    expect(workingRun([running, makeRun({ id: 'r-0', status: 'failed' })])).toBe(running);
    expect(workingRun([makeRun({ status: 'done' }), running])).toBeUndefined();
    expect(workingRun(undefined)).toBeUndefined();
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
});
