import { isDraftItem, type ActivityItem } from './activityItems';

export const RISE_STEP_MS = 16;
export const RISE_MAX_STEPS = 10;

// By row key, so rows without an id or with a repeated one each have their own delay.
export interface RisePlan {
  delays: ReadonlyMap<string, number | null>;
  drafts: ReadonlySet<string>;
}

const draftKeys = (items: readonly ActivityItem[]): Set<string> =>
  new Set(items.filter(isDraftItem).map((item) => item.key));

export const firstRise = (items: readonly ActivityItem[]): RisePlan => ({
  delays: new Map(
    items.map((item, index) => [item.key, Math.min(index, RISE_MAX_STEPS) * RISE_STEP_MS]),
  ),
  drafts: draftKeys(items),
});

// A saved comment replaces its draft, which already rose in, so it appears as is.
export function nextRise(plan: RisePlan, items: readonly ActivityItem[]): RisePlan {
  const keys = new Set(items.map((item) => item.key));
  const fresh = items.some((item) => !plan.delays.has(item.key));
  const draftSaved = [...plan.drafts].some((key) => !keys.has(key));
  if (!fresh && !draftSaved) return plan;
  const delays = new Map<string, number | null>();
  for (const item of items) {
    const known = plan.delays.get(item.key);
    const replacesDraft = draftSaved && item.kind === 'comment' && !item.draft;
    delays.set(item.key, known !== undefined ? known : replacesDraft ? null : 0);
  }
  return { delays, drafts: draftKeys(items) };
}
