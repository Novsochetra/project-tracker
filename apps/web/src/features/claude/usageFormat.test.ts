import { describe, expect, it } from 'vitest';
import { formatCost, formatDuration, projectUsageParts, runUsageParts } from './usageFormat';

const runUsageLine = (usage: Parameters<typeof runUsageParts>[0]) =>
  runUsageParts(usage).join(' · ');

describe('runUsageParts', () => {
  it('says how long, how many turns and about how much', () => {
    expect(runUsageLine({ durationMs: 361_000, turns: 23, costMicros: 840_000 })).toBe(
      '6 min · 23 turns · about $0.84',
    );
  });

  it('leaves out what the helper did not send', () => {
    expect(runUsageLine({ durationMs: null, turns: 1, costMicros: null })).toBe('1 turn');
    expect(runUsageParts({ durationMs: null, turns: null, costMicros: null })).toEqual([]);
    expect(runUsageParts(null)).toEqual([]);
  });
});

describe('formatDuration', () => {
  it('uses seconds, minutes and hours', () => {
    expect(formatDuration(0)).toBe('1 s');
    expect(formatDuration(42_400)).toBe('42 s');
    expect(formatDuration(59_600)).toBe('1 min');
    expect(formatDuration(59 * 60_000)).toBe('59 min');
    expect(formatDuration(60 * 60_000)).toBe('1 h');
    expect(formatDuration(130 * 60_000)).toBe('2 h 10 min');
  });
});

describe('formatCost', () => {
  it('rounds to cents and never shows a run as free', () => {
    expect(formatCost(8_719)).toBe('about $0.01');
    expect(formatCost(4_999)).toBe('under $0.01');
    expect(formatCost(0)).toBe('under $0.01');
    expect(formatCost(1_234_567_890)).toBe('about $1,234.57');
  });
});

describe('projectUsageParts', () => {
  it('counts the runs before the sums', () => {
    const usage = { days: 30, runs: 12, durationMs: 130 * 60_000, turns: 420, costMicros: 18.4e6 };
    expect(projectUsageParts(usage).join(' · ')).toBe(
      '12 runs · 2 h 10 min · 420 turns · about $18.40',
    );
  });

  it('says nothing for a project with no runs', () => {
    const none = { days: 30, runs: 0, durationMs: null, turns: null, costMicros: null };
    expect(projectUsageParts(none)).toEqual([]);
  });
});
