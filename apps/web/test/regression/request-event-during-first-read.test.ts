import { act, renderHook, waitFor } from '@testing-library/react';
import type { RunRequest } from '@tracker/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLiveUpdates } from '../../src/api/hooks/live';
import { useRunRequests } from '../../src/api/hooks/runRequests';
import { deferred, type Deferred } from '../../src/api/test/deferred';
import { MockEventSource } from '../../src/api/test/mockEventSource';
import { makeRequest } from '../../src/api/test/requestFixtures';
import { setupApi } from '../../src/api/test/render';

// PT-217: a chat opened just as Claude asked read its requests once. That first read started
// before the request was made and landed after the request's event. A query with no data yet joins
// a read on its way instead of starting another, so the event read nothing new and the Allow card
// never came, while the steps (which read again when behind) showed.

const RUN = 'r-1';
const ASKED = makeRequest({ runId: RUN });

const requestEvent = {
  type: 'run-request',
  runId: RUN,
  requestId: ASKED.id,
  projectId: 'p-mob',
  ticketId: null,
  chatId: 'c-1',
  status: 'open',
};

let reads: Array<Deferred<RunRequest[]>> = [];

function setup() {
  reads = [];
  const listRunRequests = vi.fn(() => {
    const read = deferred<RunRequest[]>();
    reads.push(read);
    return read.promise;
  });
  const api = setupApi({ listRunRequests });
  const hook = renderHook(
    () => {
      useLiveUpdates();
      return useRunRequests(RUN);
    },
    { wrapper: api.wrapper },
  );
  return { ...hook, listRunRequests };
}

const land = (read: Deferred<RunRequest[]> | undefined, requests: RunRequest[]) =>
  act(async () => {
    read?.resolve(requests);
    await read?.promise;
  });

describe('regression: a request event while the first read is on its way', () => {
  beforeEach(() => {
    MockEventSource.instances = [];
    vi.stubGlobal('EventSource', MockEventSource);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('reads the requests again once that read lands', async () => {
    const { result, listRunRequests } = setup();
    await waitFor(() => expect(listRunRequests).toHaveBeenCalledTimes(1));
    act(() => MockEventSource.latest().emit(requestEvent, 'run-request'));

    await land(reads[0], []);
    await waitFor(() => expect(listRunRequests).toHaveBeenCalledTimes(2));
    await land(reads[1], [ASKED]);
    await waitFor(() => expect(result.current.data).toEqual([ASKED]));
  });
});
