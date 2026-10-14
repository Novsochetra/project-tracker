import {
  formatRelative,
  PLAN_WINDOWS,
  type HelperPlanUsage,
  type PlanLimits,
  type PlanLimitType,
  type PlanWindow,
} from '@tracker/shared';

const LOCALE = 'en-US';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const LIMIT_NAMES: Record<PlanLimitType, string> = {
  five_hour: '5-hour',
  seven_day: 'Weekly',
  seven_day_overage_included: 'Weekly (extra usage)',
  seven_day_opus: 'Weekly Opus',
  seven_day_sonnet: 'Weekly Sonnet',
  overage: 'Extra usage',
};

export interface UsageMeter {
  name: string;
  // Null once the window has reset, as the figure is from before.
  usedPercent: number | null;
  detail: string;
}

export interface PlanUsageView {
  status: string | null;
  meters: UsageMeter[];
  seen: string | null;
}

export const UNKNOWN =
  'Unknown: Claude Code hasn’t said yet. It says while it works, after a run’s first reply; with an API key it never does.';

export const WITHIN_LIMITS = 'Within your limits; Claude Code gave no figures.';

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

export function formatResetTime(at: number, now: number): string {
  const date = new Date(at);
  const time = date.toLocaleTimeString(LOCALE, { hour: 'numeric', minute: '2-digit' });
  if (sameDay(date, new Date(now))) return time;
  const day =
    Math.abs(at - now) < WEEK_MS
      ? date.toLocaleDateString(LOCALE, { weekday: 'short' })
      : date.toLocaleDateString(LOCALE, { month: 'short', day: 'numeric' });
  return `${day} ${time}`;
}

function meterOf(name: string, { usedPercent, resetsAt }: PlanWindow, now: number): UsageMeter {
  if (resetsAt <= now) {
    const detail = `Reset ${formatResetTime(resetsAt, now)}; the next run updates it`;
    return { name, usedPercent: null, detail };
  }
  const detail = `${usedPercent}% used · resets ${formatResetTime(resetsAt, now)}`;
  return { name, usedPercent, detail };
}

// Both windows when Claude Code gave them, else the one that limits now.
export function usageMeters(limits: PlanLimits, now: number): UsageMeter[] {
  const windows = PLAN_WINDOWS.flatMap((name) => {
    const window = limits.windows?.[name];
    return window ? [meterOf(LIMIT_NAMES[name], window, now)] : [];
  });
  if (windows.length > 0) return windows;
  const { rateLimitType, usedPercent, resetsAt } = limits;
  if (!rateLimitType || usedPercent === undefined || resetsAt === undefined) return [];
  return [meterOf(LIMIT_NAMES[rateLimitType], { usedPercent, resetsAt }, now)];
}

const inSentence = (name: string) => name.charAt(0).toLowerCase() + name.slice(1);

const limitName = ({ rateLimitType }: PlanLimits) =>
  rateLimitType ? `the ${inSentence(LIMIT_NAMES[rateLimitType])} limit` : 'a limit';

function limitedText(limits: PlanLimits, now: number): string {
  const { resetsAt } = limits;
  if (resetsAt === undefined)
    return limits.rateLimitType ? `Limited by ${limitName(limits)}` : 'Limited';
  const at = formatResetTime(resetsAt, now);
  return resetsAt > now ? `Limited until ${at}` : `Was limited until ${at}`;
}

// What the plan's state says beyond the meters; nothing while all is well.
function planStatusText(limits: PlanLimits, now: number): string | null {
  const parts = [
    limits.status === 'rejected' ? limitedText(limits, now) : null,
    limits.status === 'allowed_warning' ? `Close to ${limitName(limits)}` : null,
    limits.isUsingOverage ? 'Using extra usage' : null,
  ];
  const said = parts.filter((part) => part !== null);
  return said.length > 0 ? said.join(' · ') : null;
}

export function planUsageView({ limits, seenAt }: HelperPlanUsage, now: number): PlanUsageView {
  if (!limits) return { status: UNKNOWN, meters: [], seen: null };
  const meters = usageMeters(limits, now);
  const status = planStatusText(limits, now) ?? (meters.length > 0 ? null : WITHIN_LIMITS);
  const seen = seenAt === null ? null : `As of a run that ended ${formatRelative(seenAt, now)}`;
  return { status, meters, seen };
}
