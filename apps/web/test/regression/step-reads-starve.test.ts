import { act, renderHook, waitFor } from '@testing-library/react';
import type { RunStep } from '@tracker/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLiveUpdates } from '../../src/api/hooks/live';
import { useRunSteps } from '../../src/api/hooks/runSteps';
import { lastSeq } from '../../src/api/runSteps';
import { deferred, type Deferred } from '../../src/api/test/deferred';
import { MockEventSource } from '../../src/api/test/mockEventSource';
import { setupApi } from '../../src/api/test/render';
import { makeStep } from '../../src/features/steps/testSteps';

const land = (read: Deferred<RunStep[]> | undefined, steps: RunStep[]) =>
  act(async () => {
    read?.resolve(steps);
    await read?.promise;
  });

// PT-164 review: every step event refreshed the run's steps with invalidateQueries, which cancels
// the read on its way. On a slow network (1.5 s a read, a step event every 0.8 s) each read was
// cancelled by the next event, none landed, and the ticket's latest step stayed on the first one
// for 8 s while ten reads started. A read on its way is now left to land; one more follows when
// the event said there is more than it brought, and none starts for steps the phone already has.

const RUN = 'r-1';
const stepEvent = (count: number) => ({
  type: 'run-step',
  runId: RUN,
  projectId: 'p-mob',
  ticketId: 't-1',
  chatId: null,
  count,
});

let reads: Array<Deferred<RunStep[]>> = [];

function setup() {
  reads = [];
  const listRunSteps = vi.fn(() => {
    const read = deferred<RunStep[]>();
    reads.push(read);
    return read.promise;
  });
  const api = setupApi({ listRunSteps });
  const hook = renderHook(
    () => {
      useLiveUpdates();
      return useRunSteps(RUN);
    },
    { wrapper: api.wrapper },
  );
  return { ...hook, listRunSteps };
}

const emit = (count: number) =>
  act(() => MockEventSource.latest().emit(stepEvent(count), 'run-step'));

describe('regression: step reads under steady step events', () => {
  beforeEach(() => {
    MockEventSource.instances = [];
    vi.stubGlobal('EventSource', MockEventSource);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('lets a slow read land, then reads what came while it was on its way', async () => {
    const { result, listRunSteps } = setup();
    await land(reads[0], [makeStep(1)]);
    await waitFor(() => expect(lastSeq(result.current.data ?? [])).toBe(1));

    emit(2);
    emit(3);
    emit(4);
    expect(listRunSteps).toHaveBeenCalledTimes(2);
    expect(listRunSteps).toHaveBeenLastCalledWith(RUN, { after: 1 });

    await land(reads[1], [makeStep(2)]);
    await waitFor(() => expect(lastSeq(result.current.data ?? [])).toBe(2));
    await waitFor(() => expect(listRunSteps).toHaveBeenCalledTimes(3));
    expect(listRunSteps).toHaveBeenLastCalledWith(RUN, { after: 2 });

    await land(reads[2], [makeStep(3), makeStep(4)]);
    await waitFor(() => expect(lastSeq(result.current.data ?? [])).toBe(4));
    expect(listRunSteps).toHaveBeenCalledTimes(3);
  });

  it('reads nothing for a step event about steps the phone already has', async () => {
    const { result, listRunSteps } = setup();
    await land(reads[0], [makeStep(1), makeStep(2)]);
    await waitFor(() => expect(lastSeq(result.current.data ?? [])).toBe(2));
    emit(2);
    emit(1);
    expect(listRunSteps).toHaveBeenCalledTimes(1);
  });
});
