import type { Activity } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { comment } from '../../../api/test/fixtures';
import { activityItems } from './activityItems';
import { firstRise, nextRise } from './risePlan';

const items = (...ids: string[]) =>
  activityItems(
    ids.map((id, index) =>
      comment(id, `text ${id}`, {
        type: id.startsWith('e') ? 'event' : 'comment',
        createdAt: index,
      }),
    ) satisfies Activity[],
  );

describe('rise plan', () => {
  it('staggers the first items by 16ms, capped after 10 steps', () => {
    const ids = Array.from({ length: 13 }, (_, index) => `e${index}`);
    const plan = firstRise(items(...ids));
    expect(plan.delays.get('e0')).toBe(0);
    expect(plan.delays.get('e3')).toBe(48);
    expect(plan.delays.get('e10')).toBe(160);
    expect(plan.delays.get('e12')).toBe(160);
  });

  it('lets later items rise in without a delay and keeps earlier delays', () => {
    const plan = nextRise(firstRise(items('e1', 'e2')), items('e1', 'e2', 'e3'));
    expect(plan.delays.get('e2')).toBe(16);
    expect(plan.delays.get('e3')).toBe(0);
  });

  it('shows a saved comment in its draft’s place without rising in again', () => {
    const withDraft = nextRise(firstRise(items('e1')), items('e1', 'temp-1'));
    expect(withDraft.delays.get('temp-1')).toBe(0);
    const saved = nextRise(withDraft, items('e1', 'c1'));
    expect(saved.delays.get('c1')).toBeNull();
    expect(saved.drafts.size).toBe(0);
  });

  it('still lets an agent comment rise in when no draft was saved', () => {
    const plan = nextRise(firstRise(items('e1')), items('e1', 'c2'));
    expect(plan.delays.get('c2')).toBe(0);
  });

  it('returns the same plan when nothing appeared, so renders settle', () => {
    const plan = firstRise(items('e1', 'c1'));
    expect(nextRise(plan, items('e1', 'c1'))).toBe(plan);
    expect(nextRise(plan, items('e1'))).toBe(plan);
  });
});
