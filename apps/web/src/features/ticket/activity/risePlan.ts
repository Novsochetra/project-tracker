import { isDraftItem, type ActivityItem } from './activityItems';

export const RISE_STEP_MS = 16;
export const RISE_MAX_STEPS = 10;

export interface RisePlan {
  /** Each item's rise-in delay, fixed when it first appears; null means it appears as is. */
  delays: ReadonlyMap<string, number | null>;
  drafts: ReadonlySet<string>;
}

const draftIds = (items: readonly ActivityItem[]): Set<string> =>
  new Set(items.filter(isDraftItem).map((item) => item.id));

export const firstRise = (items: readonly ActivityItem[]): RisePlan => ({
  delays: new Map(
    items.map((item, index) => [item.id, Math.min(index, RISE_MAX_STEPS) * RISE_STEP_MS]),
  ),
  drafts: draftIds(items),
});

/** Items that show up later rise in at once, except a saved comment taking its draft's place. */
export function nextRise(plan: RisePlan, items: readonly ActivityItem[]): RisePlan {
  const ids = new Set(items.map((item) => item.id));
  const fresh = items.some((item) => !plan.delays.has(item.id));
  const draftSaved = [...plan.drafts].some((id) => !ids.has(id));
  if (!fresh && !draftSaved) return plan;
  const delays = new Map<string, number | null>();
  for (const item of items) {
    const known = plan.delays.get(item.id);
    const replacesDraft = draftSaved && item.kind === 'comment' && !item.draft;
    delays.set(item.id, known !== undefined ? known : replacesDraft ? null : 0);
  }
  return { delays, drafts: draftIds(items) };
}
