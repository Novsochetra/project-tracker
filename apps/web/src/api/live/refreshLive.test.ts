import { QueryObserver, type QueryKey } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '../queryKeys';
import { deferred, type Deferred } from '../test/deferred';
import { createTestQueryClient } from '../test/render';
import { refreshLive } from './refreshLive';

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

const stops: Array<() => void> = [];

afterEach(() => {
  stops.splice(0).forEach((stop) => stop());
});

// An observer makes the query active, as a screen showing it does.
function shown(queryKey: QueryKey, data?: string) {
  const queryClient = createTestQueryClient();
  const reads: Array<Deferred<string>> = [];
  const queryFn = vi.fn(() => {
    const read = deferred<string>();
    reads.push(read);
    return read.promise;
  });
  if (data !== undefined) queryClient.setQueryData(queryKey, data);
  const observer = new QueryObserver(queryClient, { queryKey, queryFn, staleTime: Infinity });
  stops.push(observer.subscribe(() => undefined));
  const land = async (index: number, value: string) => {
    reads[index]?.resolve(value);
    await settle();
  };
  const refresh = () => refreshLive(queryClient, { queryKey, exact: true });
  return { queryClient, queryFn, land, refresh, data: () => queryClient.getQueryData(queryKey) };
}

describe('refreshLive', () => {
  it('reads once when no read is on its way', async () => {
    const { queryFn, land, refresh, data } = shown(queryKeys.chat('c-1'), 'old');
    const done = refresh();
    expect(queryFn).toHaveBeenCalledTimes(1);
    await land(0, 'new');
    await done;
    expect(queryFn).toHaveBeenCalledTimes(1);
    expect(data()).toBe('new');
  });

  it('lets a first read on its way land, then reads once more', async () => {
    const { queryFn, land, refresh, data } = shown(queryKeys.chat('c-1'));
    expect(queryFn).toHaveBeenCalledTimes(1);
    const done = refresh();
    expect(queryFn).toHaveBeenCalledTimes(1);

    await land(0, 'before the change');
    expect(queryFn).toHaveBeenCalledTimes(2);
    await land(1, 'after the change');
    await done;

    expect(data()).toBe('after the change');
    await settle();
    expect(queryFn).toHaveBeenCalledTimes(2);
  });

  it('turns a burst during a read into one more read, never cancelling the one on its way', async () => {
    const { queryClient, queryFn, land, refresh, data } = shown(queryKeys.chat('c-1'), 'old');
    void queryClient.refetchQueries({ queryKey: queryKeys.chat('c-1') });
    expect(queryFn).toHaveBeenCalledTimes(1);

    const burst = Array.from({ length: 10 }, refresh);
    expect(queryFn).toHaveBeenCalledTimes(1);
    await land(0, 'before the burst');
    expect(queryFn).toHaveBeenCalledTimes(2);
    await land(1, 'after the burst');
    await Promise.all(burst);

    expect(data()).toBe('after the burst');
    await settle();
    expect(queryFn).toHaveBeenCalledTimes(2);
  });

  it('gives an event during the second read one more read of its own, and no more', async () => {
    const { queryFn, land, refresh, data } = shown(queryKeys.chat('c-1'));
    const first = refresh();
    await land(0, 'first');
    expect(queryFn).toHaveBeenCalledTimes(2);

    const second = refresh();
    await land(1, 'second');
    expect(queryFn).toHaveBeenCalledTimes(3);
    await land(2, 'third');
    await Promise.all([first, second]);

    expect(data()).toBe('third');
    await settle();
    expect(queryFn).toHaveBeenCalledTimes(3);
  });

  it('leaves a query to an edit that started saving meanwhile', async () => {
    const { queryClient, queryFn, land, refresh } = shown(queryKeys.ticket('MOB-1'));
    const done = refresh();
    const saving = deferred<void>();
    void queryClient
      .getMutationCache()
      .build(queryClient, { mutationFn: () => saving.promise })
      .execute({ ticketKey: 'MOB-1' });

    await land(0, 'read');

    expect(queryFn).toHaveBeenCalledTimes(1);
    await done;
    saving.resolve();
  });
});
