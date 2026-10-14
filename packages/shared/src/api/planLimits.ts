import { z } from 'zod';
import {
  PLAN_LIMIT_STATUSES,
  PLAN_LIMIT_TYPES,
  PLAN_PERCENT_MAX,
  PLAN_TIME_MAX,
} from '../domain/planLimits';

const time = z.number().int().min(0).max(PLAN_TIME_MAX);
const percent = z.number().int().min(0).max(PLAN_PERCENT_MAX);

export const planWindowInput = z.object({ usedPercent: percent, resetsAt: time });

export const planLimitsInput = z.object({
  status: z.enum(PLAN_LIMIT_STATUSES).optional(),
  rateLimitType: z.enum(PLAN_LIMIT_TYPES).optional(),
  usedPercent: percent.optional(),
  resetsAt: time.optional(),
  windows: z
    .object({
      five_hour: planWindowInput.optional(),
      seven_day: planWindowInput.optional(),
    })
    .optional(),
  overageStatus: z.enum(PLAN_LIMIT_STATUSES).optional(),
  overageResetsAt: time.optional(),
  isUsingOverage: z.boolean().optional(),
});
export type PlanLimitsInput = z.input<typeof planLimitsInput>;
