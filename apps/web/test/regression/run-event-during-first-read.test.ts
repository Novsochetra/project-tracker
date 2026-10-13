import { act, renderHook, waitFor } from '@testing-library/react';
import type { ChatDetail, Run } from '@tracker/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useChat } from '../../src/api/hooks/chats';
import { useLiveUpdates } from '../../src/api/hooks/live';
import { useTicketRuns } from '../../src/api/hooks/runs';
import { makeAskRun, makeChatDetail, makeMessage } from '../../src/api/test/chatFixtures';
import { deferred, type Deferred } from '../../src/api/test/deferred';
import { MockEventSource } from '../../src/api/test/mockEventSource';
import { setupApi } from '../../src/api/test/render';
import { makeRun } from '../../src/api/test/runFixtures';

// PT-221: the hole PT-217 closed for run requests was in every other live refresh. A screen whose
// first read was on its way when a run event came joined that read, which may have started before
// the run, and read nothing after it. A chat with no working run doesn't poll, so it stayed without
// Claude's answer, and a ticket's runs stayed without the run Claude took.

const runEvent = (overrides: Record<string, unknown>) => ({
  type: 'run',
  runId: 'r-1',
  runnerId: 'h-dara',
  projectId: 'p-mob',
  ticketId: null,
  chatId: null,
  status: 'queued',
  ...overrides,
});

function readsOf<T>() {
  const reads: Array<Deferred<T>> = [];
  const read = vi.fn(() => {
    const next = deferred<T>();
    reads.push(next);
    return next.promise;
  });
  const land = (index: number, value: T) =>
    act(async () => {
      reads[index]?.resolve(value);
      await reads[index]?.promise;
    });
  return { read, land };
}

function watch<T>(overrides: Parameters<typeof setupApi>[0], useScreen: () => T) {
  const api = setupApi(overrides);
  return renderHook(
    () => {
      useLiveUpdates();
      return useScreen();
    },
    { wrapper: api.wrapper },
  );
}

describe('regression: a run event while the first read is on its way', () => {
  beforeEach(() => {
    MockEventSource.instances = [];
    vi.stubGlobal('EventSource', MockEventSource);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("reads the chat again once that read lands, so Claude's answer shows", async () => {
    const before = makeChatDetail({ messages: [makeMessage()], run: null });
    const answered = makeChatDetail({ run: makeAskRun({ status: 'done', endedAt: Date.now() }) });
    const { read: getChat, land } = readsOf<ChatDetail>();
    const { result } = watch({ getChat }, () => useChat('c-1'));
    await waitFor(() => expect(getChat).toHaveBeenCalledTimes(1));

    act(() =>
      MockEventSource.latest().emit(
        runEvent({ runId: 'r-ask', chatId: 'c-1', status: 'done' }),
        'run',
      ),
    );
    await land(0, before);

    await waitFor(() => expect(getChat).toHaveBeenCalledTimes(2));
    await land(1, answered);
    await waitFor(() => expect(result.current.data).toEqual(answered));
  });

  it("reads the ticket's runs again once that read lands, so the run Claude took shows", async () => {
    const taken = makeRun({ status: 'running', startedAt: Date.now() });
    const { read: listTicketRuns, land } = readsOf<Run[]>();
    const { result } = watch({ listTicketRuns }, () => useTicketRuns('MOB-1'));
    await waitFor(() => expect(listTicketRuns).toHaveBeenCalledTimes(1));

    act(() =>
      MockEventSource.latest().emit(runEvent({ ticketId: 't-1', status: 'running' }), 'run'),
    );
    await land(0, []);

    await waitFor(() => expect(listTicketRuns).toHaveBeenCalledTimes(2));
    await land(1, [taken]);
    await waitFor(() => expect(result.current.data).toEqual([taken]));
  });
});
