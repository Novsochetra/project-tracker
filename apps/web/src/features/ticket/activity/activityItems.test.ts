import { HUMAN, type Activity } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { attachment, comment } from '../../../api/test/fixtures';
import { activityItems, lastReportAt, reportTitle, VERDICT_LABELS } from './activityItems';

const CLAUDE = { kind: 'agent', name: 'Claude' } as const;

const entry = (id: string, type: Activity['type'], at: number, extra: Partial<Activity> = {}) =>
  comment(id, `${type} ${id}`, { type, createdAt: at, ...extra });

describe('activityItems', () => {
  it('lists items oldest first, keeping the server order for ties', () => {
    const items = activityItems([
      entry('b', 'comment', 20),
      entry('a', 'event', 10),
      entry('c', 'event', 20),
    ]);
    expect(items.map((item) => item.id)).toEqual(['a', 'b', 'c']);
  });

  it('keeps comment drafts last, whatever the device clock says', () => {
    const items = activityItems([entry('temp-1', 'comment', 1), entry('a', 'event', 10)]);
    expect(items.map((item) => item.id)).toEqual(['a', 'temp-1']);
    expect(items[1]).toMatchObject({ kind: 'comment', draft: true });
  });

  it('names the person "You" and agents by name', () => {
    const [mine, theirs] = activityItems([
      entry('a', 'event', 1, { actor: HUMAN }),
      entry('b', 'event', 2, { actor: CLAUDE }),
    ]);
    expect(mine?.author).toBe('You');
    expect(theirs?.author).toBe('Claude');
  });

  it('carries what each card needs', () => {
    const image = attachment('img-1', { activityId: 'c' });
    const [event, edited, report, review] = activityItems([
      entry('e', 'event', 1),
      entry('c', 'comment', 2, { editedAt: 5, attachments: [image] }),
      entry('r', 'report', 3, { actor: CLAUDE }),
      entry('v', 'review', 4, { actor: CLAUDE, review: { verdict: 'approved', rating: 4 } }),
    ]);
    expect(event).toMatchObject({ kind: 'event', text: 'event e', at: 1 });
    expect(edited).toMatchObject({ kind: 'comment', editedAt: 5, draft: false, images: [image] });
    expect(report).toMatchObject({ kind: 'report', title: 'Claude report' });
    expect(review).toMatchObject({ kind: 'review', review: { verdict: 'approved', rating: 4 } });
  });
});

describe('reportTitle', () => {
  it('uses the agent name, or "Claude Code" for pasted and unnamed reports', () => {
    expect(reportTitle({ kind: 'agent', name: 'Claude (reviewer)' })).toBe(
      'Claude (reviewer) report',
    );
    expect(reportTitle(HUMAN)).toBe('Claude Code report');
    expect(reportTitle({ kind: 'agent', name: '' })).toBe('Claude Code report');
  });
});

describe('lastReportAt', () => {
  it('finds the newest report', () => {
    const activity = [entry('a', 'report', 5), entry('b', 'report', 9), entry('c', 'event', 12)];
    expect(lastReportAt(activity)).toBe(9);
    expect(lastReportAt([entry('c', 'event', 12)])).toBeNull();
  });
});

describe('VERDICT_LABELS', () => {
  it('reads like the review outcome', () => {
    expect(VERDICT_LABELS.approved).toBe('Approved');
    expect(VERDICT_LABELS.changes_requested).toBe('Changes requested');
  });
});
