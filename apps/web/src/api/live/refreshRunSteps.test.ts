import { act, renderHook, waitFor } from '@testing-library/react';
import type { RunStep } from '@tracker/shared';
import { describe, expect, it, vi } from 'vitest';
import { makeStep } from '../../features/steps/testSteps';
import { useRunSteps } from '../hooks/runSteps';
import { queryKeys } from '../queryKeys';
import { deferred, type Deferred } from '../test/deferred';
import { setupApi } from '../test/render';
import { refreshRunSteps } from './refreshRunSteps';

const land = (read: Deferred<RunStep[]> | undefined, steps: RunStep[]) =>
  act(async () => {
    read?.resolve(steps);
    await read?.promise;
  });

function setup() {
  const reads: Array<Deferred<RunStep[]>> = [];
  const listRunSteps = vi.fn(() => {
    const read = deferred<RunStep[]>();
    reads.push(read);
    return read.promise;
  });
  const api = setupApi({ listRunSteps });
  const hook = renderHook(() => useRunSteps('r-1'), { wrapper: api.wrapper });
  return { ...api, ...hook, reads, listRunSteps };
}

describe('refreshRunSteps', () => {
  it("reads once more after a read that was on its way when the run's end came", async () => {
    const { queryClient, result, reads, listRunSteps } = setup();
    let done: Promise<void> = Promise.resolve();
    act(() => {
      done = refreshRunSteps(queryClient, 'r-1');
    });
    expect(listRunSteps).toHaveBeenCalledTimes(1);
    await land(reads[0], [makeStep(1)]);
    await waitFor(() => expect(listRunSteps).toHaveBeenCalledTimes(2));
    expect(listRunSteps).toHaveBeenLastCalledWith('r-1', { after: 1 });
    await land(reads[1], [makeStep(2)]);
    await act(() => done);
    // The cache holds the read once `done` settles; the hook hears of it in TanStack's next batch
    // (notifyManager), which can come after act returns.
    const cached = queryClient.getQueryData<RunStep[]>(queryKeys.runSteps('r-1'));
    expect(cached?.map(({ seq }) => seq)).toEqual([1, 2]);
    await waitFor(() => expect(result.current.data?.map(({ seq }) => seq)).toEqual([1, 2]));
    expect(listRunSteps).toHaveBeenCalledTimes(2);
  });

  it('stops catching up when a read of its own fails', async () => {
    const { queryClient, reads, listRunSteps } = setup();
    await land(reads[0], [makeStep(1)]);
    let done: Promise<void> = Promise.resolve();
    act(() => {
      done = refreshRunSteps(queryClient, 'r-1', 5);
    });
    await act(async () => {
      reads[1]?.reject(new TypeError('Failed to fetch'));
      await reads[1]?.promise.catch(() => undefined);
    });
    await act(() => done);
    expect(listRunSteps).toHaveBeenCalledTimes(2);
  });

  it('reads nothing for a run nobody shows', async () => {
    const { queryClient, listRunSteps, unmount, reads } = setup();
    await land(reads[0], [makeStep(1)]);
    unmount();
    await refreshRunSteps(queryClient, 'r-1', 3);
    expect(listRunSteps).toHaveBeenCalledTimes(1);
  });
});
