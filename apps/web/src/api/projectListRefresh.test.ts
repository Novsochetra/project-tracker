import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { deferred, type Deferred } from './test/deferred';
import { refreshProjectList } from './projectListRefresh';
import { queryKeys } from './queryKeys';

function watchedList() {
  const answers: Array<Deferred<string[]>> = [];
  const read = vi.fn(() => {
    const answer = deferred<string[]>();
    answers.push(answer);
    return answer.promise;
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const observer = new QueryObserver(queryClient, {
    queryKey: queryKeys.projects(),
    queryFn: read,
  });
  const stop = observer.subscribe(() => undefined);
  const answer = async (index: number) => {
    answers[index]?.resolve([`read ${index}`]);
    await vi.waitFor(() =>
      expect(queryClient.getQueryData(queryKeys.projects())).toEqual([`read ${index}`]),
    );
  };
  return { queryClient, read, answer, stop };
}

let stops: Array<() => void> = [];

afterEach(() => {
  stops.forEach((stop) => stop());
  stops = [];
});

describe('refreshing the project list', () => {
  it('reads it at once when no read is on its way', async () => {
    const list = watchedList();
    stops.push(list.stop);
    await list.answer(0);

    refreshProjectList(list.queryClient);

    expect(list.read).toHaveBeenCalledTimes(2);
  });

  it('reads it once after the read on its way, however many refreshes come meanwhile', async () => {
    const list = watchedList();
    stops.push(list.stop);

    refreshProjectList(list.queryClient);
    refreshProjectList(list.queryClient);
    refreshProjectList(list.queryClient);
    expect(list.read).toHaveBeenCalledTimes(1);

    await list.answer(0);
    await vi.waitFor(() => expect(list.read).toHaveBeenCalledTimes(2));
    await list.answer(1);

    expect(list.read).toHaveBeenCalledTimes(2);
  });

  it('reads again for a refresh that comes while the later read is on its way', async () => {
    const list = watchedList();
    stops.push(list.stop);
    refreshProjectList(list.queryClient);
    await list.answer(0);
    await vi.waitFor(() => expect(list.read).toHaveBeenCalledTimes(2));

    refreshProjectList(list.queryClient);
    await list.answer(1);

    await vi.waitFor(() => expect(list.read).toHaveBeenCalledTimes(3));
  });
});
