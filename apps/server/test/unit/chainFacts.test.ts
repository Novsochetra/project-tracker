import { RUNNER_ONLINE_MS } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import type { RunnerRow } from '../../src/db/runTables';
import type { ActivityRow } from '../../src/db/schema';
import { helperCanTake, personMovedSince } from '../../src/services/reviewChain/chainFacts';
import {
  reportMoveText,
  statusChangedText,
  WORKFLOW_VERBS,
  workflowMoveText,
} from '../../src/services/statusEvents';

const entry = (changes: Partial<ActivityRow>): ActivityRow => ({
  id: 'a-1',
  ticketId: 't-1',
  type: 'event',
  actorKind: 'human',
  actorName: '',
  text: statusChangedText('Done'),
  reviewVerdict: null,
  reviewRating: null,
  createdAt: 2_000,
  editedAt: null,
  lineRunId: null,
  linePath: null,
  lineSide: null,
  lineNumber: null,
  ...changes,
});

describe('personMovedSince', () => {
  it("sees every event a person's move writes, since the run was queued", () => {
    const moves = [
      statusChangedText('Done'),
      reportMoveText('Need review'),
      ...Object.values(WORKFLOW_VERBS).map((verb) => workflowMoveText(verb, 'In progress')),
    ];
    for (const text of moves) expect(personMovedSince([entry({ text })], 2_000)).toBe(true);
  });

  it("ignores Claude's moves, older moves and other changes", () => {
    const ignored = [
      entry({ actorKind: 'agent', actorName: 'Claude' }),
      entry({ createdAt: 1_999 }),
      entry({ text: 'set priority to High' }),
      entry({ text: 'assigned the ticket to Sam and moved it to Done' }),
      entry({ text: WORKFLOW_VERBS.claim }),
      entry({ type: 'comment', text: statusChangedText('Done') }),
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
    tools: null,
    planLimits: null,
    createdAt: 0,
    lastSeenAt: 10_000,
  };

  it('needs a helper that is online and still runs the project', () => {
    expect(helperCanTake(runner, 'p-1', 10_000 + RUNNER_ONLINE_MS - 1)).toBe(true);
    expect(helperCanTake(runner, 'p-1', 10_000 + RUNNER_ONLINE_MS)).toBe(false);
    expect(helperCanTake(runner, 'p-2', 10_000)).toBe(false);
  });
});
