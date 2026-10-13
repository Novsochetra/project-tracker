import { RUNNER_ONLINE_MS } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import type { RunnerRow } from '../../src/db/runTables';
import type { ActivityRow } from '../../src/db/schema';
import { helperCanTake, personMovedSince } from '../../src/services/reviewChain/chainFacts';

const entry = (changes: Partial<ActivityRow>): ActivityRow => ({
  id: 'a-1',
  ticketId: 't-1',
  type: 'event',
  actorKind: 'human',
  actorName: '',
  text: 'changed status to Done',
  reviewVerdict: null,
  reviewRating: null,
  createdAt: 2_000,
  editedAt: null,
  ...changes,
});

describe('personMovedSince', () => {
  it("sees a person's status change or workflow move since the run was queued", () => {
    expect(personMovedSince([entry({})], 2_000)).toBe(true);
    expect(
      personMovedSince([entry({ text: 'claimed it and moved it to In progress' })], 1_000),
    ).toBe(true);
  });

  it("ignores Claude's moves, older moves and other changes", () => {
    const ignored = [
      entry({ actorKind: 'agent', actorName: 'Claude' }),
      entry({ createdAt: 1_999 }),
      entry({ text: 'set priority to High' }),
      entry({ type: 'comment', text: 'changed status to Done, please' }),
    ];
    expect(personMovedSince(ignored, 2_000)).toBe(false);
  });
});

describe('helperCanTake', () => {
  const runner: RunnerRow = {
    id: 'r-1',
    userId: 'u-1',
    name: 'Mac',
    projectIds: '["p-1"]',
    createdAt: 0,
    lastSeenAt: 10_000,
  };

  it('needs a helper that is online and still runs the project', () => {
    expect(helperCanTake(runner, 'p-1', 10_000 + RUNNER_ONLINE_MS - 1)).toBe(true);
    expect(helperCanTake(runner, 'p-1', 10_000 + RUNNER_ONLINE_MS)).toBe(false);
    expect(helperCanTake(runner, 'p-2', 10_000)).toBe(false);
  });
});
