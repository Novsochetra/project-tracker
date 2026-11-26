import { describe, expect, it } from 'vitest';
import type { StatusCategory } from '../src/domain/status';
import { normalizeReportStatus } from '../src/logic/reportStatus';

describe('normalizeReportStatus', () => {
  it.each<[string, StatusCategory]>([
    ['not started', 'todo'],
    ['Not started yet', 'todo'],
    ['to do', 'todo'],
    ['todo', 'todo'],
    ['TODO', 'todo'],
    ['in progress', 'in_progress'],
    ['In Progress', 'in_progress'],
    ['blocked', 'in_progress'],
    ['Blocked on the API key', 'in_progress'],
    ['wip', 'in_progress'],
    ['partial', 'in_progress'],
    ['started', 'in_progress'],
    ['ongoing', 'in_progress'],
    ['done', 'in_review'],
    ['DONE', 'in_review'],
    ['Done.', 'in_review'],
    ['Fixed ✅', 'in_review'],
    ['complete', 'in_review'],
    ['completed', 'in_review'],
    ['finished', 'in_review'],
    ['resolved', 'in_review'],
    ['needs review', 'in_review'],
    ['need review', 'in_review'],
    ['ready for review', 'in_review'],
    ['in review', 'in_review'],
    ['review', 'in_review'],
    ['approved', 'reviewed'],
    ['Approved by QA', 'reviewed'],
    ['reviewed', 'reviewed'],
    ['verified', 'reviewed'],
  ])('maps %j to %s', (raw, category) => {
    expect(normalizeReportStatus(raw)).toBe(category);
  });

  it.each(['', 'maybe', 'unknown', 'n/a', 'cancelled', 'undone', 'abandoned'])(
    'returns null for %j',
    (raw) => {
      expect(normalizeReportStatus(raw)).toBeNull();
    },
  );

  it('checks reviewed words before done words', () => {
    expect(normalizeReportStatus('done and verified')).toBe('reviewed');
  });

  it('checks done words before progress words', () => {
    expect(normalizeReportStatus('started, partially done')).toBe('in_review');
  });

  it('checks not started before started', () => {
    expect(normalizeReportStatus('not started')).toBe('todo');
  });

  it('never returns done, because a report never sets Done', () => {
    const words = ['done', 'complete', 'fixed', 'finished', 'resolved', 'approved', 'shipped'];

    for (const word of words) expect(normalizeReportStatus(word)).not.toBe('done');
  });
});
