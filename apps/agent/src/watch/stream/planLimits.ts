import {
  isJson,
  planLimitsInput,
  planWindowInput,
  PLAN_WINDOWS,
  type PlanLimitsInput,
} from '@tracker/shared';

// Claude Code gives times in epoch seconds and use as a fraction of the window.
const msOf = (seconds: unknown) => (typeof seconds === 'number' ? seconds * 1000 : undefined);
const percentOf = (fraction: unknown) =>
  typeof fraction === 'number' ? Math.round(fraction * 100) : undefined;

const fields = planLimitsInput.shape;
type Field = keyof PlanLimitsInput;

// Each on its own, so a value a newer Claude Code adds drops that field, not the rest.
const fitting = (key: Field, value: unknown) =>
  value !== undefined && fields[key].safeParse(value).success ? { [key]: value } : {};

function windowsOf(windows: unknown) {
  if (!isJson(windows)) return {};
  const found = PLAN_WINDOWS.flatMap((name) => {
    const window = windows[name];
    if (!isJson(window)) return [];
    const read = { usedPercent: percentOf(window.utilization), resetsAt: msOf(window.resetsAt) };
    return planWindowInput.safeParse(read).success ? [[name, read] as const] : [];
  });
  return found.length > 0 ? { windows: Object.fromEntries(found) } : {};
}

export function planLimitsOf(event: unknown): PlanLimitsInput | null {
  if (!isJson(event) || event.type !== 'rate_limit_event') return null;
  const info = event.rate_limit_info;
  if (!isJson(info)) return null;
  const limits = {
    ...fitting('status', info.status),
    ...fitting('rateLimitType', info.rateLimitType),
    ...fitting('usedPercent', percentOf(info.utilization)),
    ...fitting('resetsAt', msOf(info.resetsAt)),
    ...windowsOf(info.unifiedWindows),
    ...fitting('overageStatus', info.overageStatus),
    ...fitting('overageResetsAt', msOf(info.overageResetsAt)),
    ...fitting('isUsingOverage', info.isUsingOverage),
  };
  return planLimitsInput.safeParse(limits).data ?? null;
}
