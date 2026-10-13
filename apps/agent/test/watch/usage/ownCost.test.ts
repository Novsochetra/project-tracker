import { describe, expect, it } from 'vitest';
import { ownCostUsd } from '../../../src/watch/usage/ownCost';

const final = (costUsd: number, readTokens: number) => ({
  costUsd,
  readTokens,
  turns: 1,
  durationMs: 1_000,
});
const before = { costUsd: 0.5, readTokens: 70_000 };

describe('ownCostUsd', () => {
  it("takes Claude Code's cost as it is for a run that resumed nothing", () => {
    // WebFetch's own calls are counted but not streamed.
    const source = { final: final(0.2, 50_000), readTokens: 40_000, resumed: false, before };
    expect(ownCostUsd(source)).toBe(0.2);
  });

  it("takes off the session's earlier cost when Claude Code carried it over", () => {
    const source = { final: final(0.8, 110_000), readTokens: 40_000, resumed: true, before };
    expect(ownCostUsd(source)).toBeCloseTo(0.3);
  });

  it('keeps the cost when a resumed run started from nothing', () => {
    const started = { final: final(0.2, 40_000), readTokens: 40_000, resumed: true, before };
    expect(ownCostUsd(started)).toBe(0.2);
    const unstreamed = { final: final(0.2, 45_000), readTokens: 40_000, resumed: true, before };
    expect(ownCostUsd(unstreamed)).toBe(0.2);
  });

  it("leaves the cost out when it can't tell what was carried over", () => {
    const unknown = { final: final(0.8, 110_000), readTokens: 40_000, resumed: true };
    expect(ownCostUsd({ ...unknown, before: undefined })).toBeUndefined();
    const noTokens = { costUsd: 0.8, readTokens: undefined, turns: 1, durationMs: 1 };
    expect(ownCostUsd({ ...unknown, final: noTokens, before })).toBeUndefined();
  });

  it('never goes below nothing', () => {
    const source = { final: final(0.4, 110_000), readTokens: 40_000, resumed: true, before };
    expect(ownCostUsd(source)).toBe(0);
  });
});
