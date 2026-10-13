import { describe, expect, it } from 'vitest';
import { progressParts, projectProgress } from './projectProgress';

const counts = (totalCount: number, doneCount: number) => ({
  totalCount,
  doneCount,
  openCount: totalCount - doneCount,
});

describe('projectProgress', () => {
  it('counts reviewed tickets toward progress', () => {
    expect(projectProgress(counts(180, 0), 178)).toMatchObject({
      done: 0,
      ready: 178,
      open: 2,
      percent: 98,
    });
  });

  it('shows 100% only when nothing is left', () => {
    expect(projectProgress(counts(1000, 998), 1).percent).toBe(99);
    expect(projectProgress(counts(4, 3), 1).percent).toBe(100);
  });

  it('splits the bar into done and ready shares', () => {
    const progress = projectProgress(counts(4, 1), 2);
    expect(progress.doneShare).toBe(25);
    expect(progress.readyShare).toBe(50);
  });

  it('is empty for a project without tickets', () => {
    expect(projectProgress(counts(0, 0), 0)).toEqual({
      total: 0,
      done: 0,
      ready: 0,
      open: 0,
      percent: 0,
      doneShare: 0,
      readyShare: 0,
    });
  });
});

describe('progressParts', () => {
  it('lists done, ready and open, leaving out the empty ones', () => {
    expect(progressParts(projectProgress(counts(180, 0), 178))).toEqual([
      { kind: 'ready', count: 178 },
      { kind: 'open', count: 2 },
    ]);
    expect(progressParts(projectProgress(counts(5, 3), 0))).toEqual([
      { kind: 'done', count: 3 },
      { kind: 'open', count: 2 },
    ]);
    expect(progressParts(projectProgress(counts(0, 0), 0))).toEqual([]);
  });
});
