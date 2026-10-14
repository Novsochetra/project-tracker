// Claude Code's own names in its stream-json `rate_limit_event` (checked with 2.1.299).
export const PLAN_LIMIT_STATUSES = ['allowed', 'allowed_warning', 'rejected'] as const;
export type PlanLimitStatus = (typeof PLAN_LIMIT_STATUSES)[number];

export const PLAN_WINDOWS = ['five_hour', 'seven_day', 'seven_day_overage_included'] as const;
export type PlanWindowName = (typeof PLAN_WINDOWS)[number];

export const PLAN_LIMIT_TYPES = [
  ...PLAN_WINDOWS,
  'seven_day_opus',
  'seven_day_sonnet',
  'overage',
] as const;
export type PlanLimitType = (typeof PLAN_LIMIT_TYPES)[number];

// Past 100 when work runs over a window's cap; a figure far beyond is not a real one.
export const PLAN_PERCENT_MAX = 1000;
// The year 3000, in ms.
export const PLAN_TIME_MAX = 32_503_680_000_000;

export interface PlanWindow {
  usedPercent: number;
  resetsAt: number;
}

// What the person's Claude plan allows, as Claude Code last said in a run. Times are ms.
export interface PlanLimits {
  status: PlanLimitStatus;
  rateLimitType?: PlanLimitType | undefined;
  usedPercent?: number | undefined;
  resetsAt?: number | undefined;
  windows?: Partial<Record<PlanWindowName, PlanWindow>> | undefined;
  overageStatus?: PlanLimitStatus | undefined;
  overageResetsAt?: number | undefined;
  isUsingOverage?: boolean | undefined;
}

export interface HelperPlanUsage {
  runnerId: string;
  runnerName: string;
  // Null until a run of this helper's ends with Claude Code having said something.
  limits: PlanLimits | null;
  seenAt: number | null;
}
