import { HUMAN, type Activity, type Actor } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { attachment, comment } from '../../../api/test/fixtures';
import { activityItems, lastReportAt, reportTitle } from './activityItems';

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
    expect(edited).toMatchObject({
      kind: 'comment',
      editedAt: 5,
      draft: false,
      attachments: [image],
    });
    expect(report).toMatchObject({ kind: 'report', title: 'Claude report', text: 'report r' });
    expect(review).toMatchObject({ kind: 'review', review: { verdict: 'approved', rating: 4 } });
  });

  it('keeps the activity each item shows, so a changed one can be told apart', () => {
    const activity = [entry('a', 'event', 1), entry('b', 'comment', 2)];
    expect(activityItems(activity).map((item) => item.source)).toEqual(activity);
    expect(activityItems(activity)[1]?.source).toBe(activity[1]);
  });

  it('builds one activity in a shape it does not expect without failing the rest', () => {
    const odd = (actor: unknown) => actor as Actor;
    const items = activityItems([
      entry('a', 'comment', 1, { actor: odd(null) }),
      entry('b', 'report', 2, { actor: odd({ kind: 'robot', name: 'R2' }) }),
      entry('c', 'review', 3, { actor: odd({ kind: 'agent', name: 42 }) }),
      entry('d', 'poll' as Activity['type'], 4),
      entry(7 as unknown as string, 'comment', 5),
    ]);
    expect(items.map((item) => [item.kind, item.actor, item.author])).toEqual([
      ['comment', null, 'Someone'],
      ['report', null, 'Someone'],
      ['review', null, 'Someone'],
      ['unknown', HUMAN, 'You'],
      ['comment', HUMAN, 'You'],
    ]);
    expect(items[1]).toMatchObject({ title: 'Claude Code report' });
    expect(items[3]).toMatchObject({ text: 'poll d' });
    expect(items[4]).toMatchObject({ draft: false });
  });
});

describe('entries that are not activities', () => {
  const gaps = [
    null,
    entry('a', 'report', 5),
    7,
    'text',
    [1, 2],
    entry('b', 'event', 9),
  ] as unknown as Activity[];

  it('leaves them out of the items', () => {
    expect(activityItems(gaps).map((item) => item.id)).toEqual(['a', 'b']);
  });

  it('leaves them out of the last report', () => {
    expect(lastReportAt(gaps)).toBe(5);
  });
});

describe('reportTitle', () => {
  it('uses the agent name, or "Claude Code" for pasted and unnamed reports', () => {
    expect(reportTitle({ kind: 'agent', name: 'Claude (reviewer)' })).toBe(
      'Claude (reviewer) report',
    );
    expect(reportTitle(HUMAN)).toBe('Claude Code report');
    expect(reportTitle({ kind: 'agent', name: '' })).toBe('Claude Code report');
    expect(reportTitle(null)).toBe('Claude Code report');
  });
});

describe('lastReportAt', () => {
  it('finds the newest report', () => {
    const activity = [entry('a', 'report', 5), entry('b', 'report', 9), entry('c', 'event', 12)];
    expect(lastReportAt(activity)).toBe(9);
    expect(lastReportAt([entry('c', 'event', 12)])).toBeNull();
  });
});

describe('row keys', () => {
  it('keys rows by id, and numbers those without one or with a repeated one among themselves', () => {
    const noId = { ...entry('x', 'event', 2), id: undefined } as unknown as Activity;
    const nullId = { ...entry('x', 'event', 4), id: null } as unknown as Activity;
    const items = activityItems([
      entry('a', 'event', 1),
      noId,
      entry('b', 'event', 3),
      nullId,
      entry('a', 'event', 5),
    ]);
    expect(items.map((item) => item.key)).toEqual(['a', 'spare-0', 'b', 'spare-1', 'spare-2']);
  });
});
