import type { HelperPlanUsage, PlanLimits } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import {
  formatResetTime,
  NO_FIGURES,
  planUsageView,
  UNKNOWN,
  WITHIN_LIMITS,
} from './planUsageText';

const NOW = new Date(2026, 9, 14, 12, 0).getTime();
const AT_3_40 = new Date(2026, 9, 14, 15, 40).getTime();
const MONDAY = new Date(2026, 9, 19, 9, 0).getTime();
const HOUR = 60 * 60 * 1000;

const helper = (limits: PlanLimits | null, seenAt: number | null = NOW - 5 * 60_000) =>
  ({
    runnerId: 'r-1',
    runnerName: 'Mac',
    limits,
    seenAt,
  }) satisfies HelperPlanUsage;

describe('formatResetTime', () => {
  it('says the time today, the weekday within a week, else the date', () => {
    expect(formatResetTime(AT_3_40, NOW)).toBe('3:40 PM');
    expect(formatResetTime(MONDAY, NOW)).toBe('Mon 9:00 AM');
    expect(formatResetTime(new Date(2026, 10, 2, 8, 5).getTime(), NOW)).toBe('Nov 2 8:05 AM');
  });
});

describe('planUsageView', () => {
  it('shows both windows when Claude Code gave them', () => {
    const limits: PlanLimits = {
      status: 'allowed',
      windows: {
        five_hour: { usedPercent: 42, resetsAt: AT_3_40 },
        seven_day: { usedPercent: 18, resetsAt: MONDAY },
      },
    };
    expect(planUsageView(helper(limits), NOW)).toEqual({
      status: null,
      meters: [
        { name: '5-hour', usedPercent: 42, detail: '42% used · resets 3:40 PM' },
        { name: 'Weekly', usedPercent: 18, detail: '18% used · resets Mon 9:00 AM' },
      ],
      seen: 'As of a run that ended 5m ago',
    });
  });

  it('falls back to the limiting window, and warns when close to it', () => {
    const limits: PlanLimits = {
      status: 'allowed_warning',
      rateLimitType: 'seven_day_opus',
      usedPercent: 91,
      resetsAt: MONDAY,
    };
    const view = planUsageView(helper(limits), NOW);
    expect(view.status).toBe('Close to the weekly Opus limit');
    expect(view.meters).toEqual([
      { name: 'Weekly Opus', usedPercent: 91, detail: '91% used · resets Mon 9:00 AM' },
    ]);
  });

  it('says until when the plan is limited, and when it already reset', () => {
    const limited: PlanLimits = {
      status: 'rejected',
      rateLimitType: 'five_hour',
      resetsAt: AT_3_40,
    };
    expect(planUsageView(helper(limited), NOW).status).toBe('Limited until 3:40 PM');
    const later = AT_3_40 + HOUR;
    expect(planUsageView(helper(limited), later).status).toBe('Was limited until 3:40 PM');
    const overage: PlanLimits = { status: 'rejected', isUsingOverage: true };
    expect(planUsageView(helper(overage), NOW).status).toBe('Limited · Using extra usage');
  });

  it('drops a warning and extra usage once their reset time passed', () => {
    const limits: PlanLimits = {
      status: 'allowed_warning',
      rateLimitType: 'five_hour',
      usedPercent: 91,
      resetsAt: AT_3_40,
      isUsingOverage: true,
      overageResetsAt: AT_3_40,
    };
    expect(planUsageView(helper(limits), NOW).status).toBe(
      'Close to the 5-hour limit · Using extra usage',
    );
    const later = planUsageView(helper(limits), AT_3_40 + HOUR);
    expect(later.status).toBeNull();
    expect(later.meters[0]?.detail).toBe('Reset 3:40 PM; the next run updates it');
  });

  it('keeps extra usage on when Claude Code gave no end for it', () => {
    const limits: PlanLimits = { status: 'allowed', isUsingOverage: true };
    expect(planUsageView(helper(limits), NOW + 30 * 24 * HOUR).status).toBe('Using extra usage');
  });

  it('hides a figure from before its window reset', () => {
    const limits: PlanLimits = {
      status: 'allowed',
      windows: { five_hour: { usedPercent: 80, resetsAt: NOW - HOUR } },
    };
    expect(planUsageView(helper(limits), NOW).meters).toEqual([
      { name: '5-hour', usedPercent: null, detail: 'Reset 11:00 AM; the next run updates it' },
    ]);
  });

  it('says honestly when nothing is known', () => {
    expect(planUsageView(helper(null, null), NOW)).toEqual({
      status: UNKNOWN,
      meters: [],
      seen: null,
    });
    expect(planUsageView(helper({ status: 'allowed' }), NOW).status).toBe(WITHIN_LIMITS);
    expect(planUsageView(helper({ rateLimitType: 'five_hour' }), NOW).status).toBe(NO_FIGURES);
  });
});
