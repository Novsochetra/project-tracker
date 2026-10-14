import { describe, expect, it } from 'vitest';
import { planLimitsOf } from '../../../src/watch/stream/planLimits';

// The shape Claude Code 2.1.299 prints with --output-format stream-json (its own schema).
const event = (info: unknown) => ({
  type: 'rate_limit_event',
  rate_limit_info: info,
  uuid: 'u-1',
  session_id: 's-1',
});

describe('planLimitsOf', () => {
  it('reads the limiting window and both plan windows, in ms and whole percents', () => {
    const info = {
      status: 'allowed_warning',
      resetsAt: 1_800_000_000,
      rateLimitType: 'five_hour',
      utilization: 0.834,
      unifiedWindows: {
        five_hour: { utilization: 0.834, resetsAt: 1_800_000_000 },
        seven_day: { utilization: 0.21, resetsAt: 1_800_400_000 },
      },
      overageStatus: 'rejected',
      overageResetsAt: 1_801_000_000,
      isUsingOverage: false,
      overageDisabledReason: 'org_level_disabled',
      canUserPurchaseCredits: true,
    };
    expect(planLimitsOf(event(info))).toEqual({
      status: 'allowed_warning',
      rateLimitType: 'five_hour',
      usedPercent: 83,
      resetsAt: 1_800_000_000_000,
      windows: {
        five_hour: { usedPercent: 83, resetsAt: 1_800_000_000_000 },
        seven_day: { usedPercent: 21, resetsAt: 1_800_400_000_000 },
      },
      overageStatus: 'rejected',
      overageResetsAt: 1_801_000_000_000,
      isUsingOverage: false,
    });
  });

  it("leaves out the per-model weekly bucket, which Claude Code doesn't explain", () => {
    const info = {
      status: 'allowed',
      unifiedWindows: { seven_day_overage_included: { utilization: 0.4, resetsAt: 1_800_000_000 } },
    };
    expect(planLimitsOf(event(info))).toEqual({ status: 'allowed' });
  });

  it('reads a bare status, as before the first response with the plan headers', () => {
    expect(planLimitsOf(event({ status: 'allowed' }))).toEqual({ status: 'allowed' });
  });

  it("drops a value it doesn't know, not the rest", () => {
    const info = {
      status: 'rejected',
      rateLimitType: 'ten_minute',
      resetsAt: 1_800_000_000,
      unifiedWindows: {
        five_hour: { utilization: 'lots', resetsAt: 1_800_000_000 },
        seven_day: { utilization: 1.4, resetsAt: 1_800_400_000 },
      },
    };
    expect(planLimitsOf(event(info))).toEqual({
      status: 'rejected',
      resetsAt: 1_800_000_000_000,
      windows: { seven_day: { usedPercent: 140, resetsAt: 1_800_400_000_000 } },
    });
  });

  it('refuses figures past the bounds', () => {
    const info = { status: 'allowed', utilization: 1e9, resetsAt: -5 };
    expect(planLimitsOf(event(info))).toEqual({ status: 'allowed' });
  });

  it('keeps the windows when a newer Claude Code sends a status it does not know', () => {
    const info = {
      status: 'throttled',
      unifiedWindows: { five_hour: { utilization: 0.5, resetsAt: 1_800_000_000 } },
    };
    expect(planLimitsOf(event(info))).toEqual({
      windows: { five_hour: { usedPercent: 50, resetsAt: 1_800_000_000_000 } },
    });
  });

  it('reads nothing from an event with nothing it knows, or from other events', () => {
    expect(planLimitsOf(event({ status: 'maybe', rateLimitType: 'hourly' }))).toBeNull();
    expect(planLimitsOf(event('allowed'))).toBeNull();
    expect(planLimitsOf({ type: 'result', rate_limit_info: { status: 'allowed' } })).toBeNull();
    expect(planLimitsOf(null)).toBeNull();
  });
});
