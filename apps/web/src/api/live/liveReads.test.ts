import { QueryObserver } from '@tanstack/react-query';
import { TrackerClient } from '@tracker/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '../queryKeys';
import { makeChatDetail } from '../test/chatFixtures';
import { createTestQueryClient } from '../test/render';
import { LIVE_READ_HEADER, startLiveReads, tagLiveReads } from './liveReads';
import { refreshLive } from './refreshLive';

const headersOf = (call: unknown[] | undefined) => new Headers((call?.[1] as RequestInit)?.headers);
const isTagged = (call: unknown[] | undefined) => headersOf(call).has(LIVE_READ_HEADER);

const stops: Array<() => void> = [];

afterEach(() => {
  stops.splice(0).forEach((stop) => stop());
  vi.unstubAllGlobals();
});

function watched() {
  const fetch = vi.fn((..._args: unknown[]) => Promise.resolve(Response.json({})));
  const scope = { fetch: fetch as unknown as typeof globalThis.fetch };
  stops.push(tagLiveReads(scope));
  return { scope, fetch };
}

describe('tagLiveReads', () => {
  it('tags the API reads started for a live refresh, and nothing else', async () => {
    const { scope, fetch } = watched();
    await scope.fetch('/api/chats/c-1');
    await startLiveReads(() =>
      Promise.all([
        scope.fetch('/api/chats/c-1', { headers: { accept: 'application/json' } }),
        scope.fetch('/api/chats/c-1/messages', { method: 'POST' }),
        scope.fetch('/assets/app.js'),
      ]),
    );
    await scope.fetch('/api/chats/c-1');

    expect(fetch.mock.calls.map(isTagged)).toEqual([false, true, false, false, false]);
    expect(headersOf(fetch.mock.calls[1]).get('accept')).toBe('application/json');
  });

  it('stops tagging once taken off', async () => {
    const { scope, fetch } = watched();
    stops.splice(0).forEach((stop) => stop());
    await startLiveReads(() => scope.fetch('/api/chats/c-1'));
    expect(isTagged(fetch.mock.calls[0])).toBe(false);
  });
});

describe('the reads refreshLive starts', () => {
  it('go out tagged through the API client, while a screen reads as usual', async () => {
    const fetch = vi.fn((..._args: unknown[]) => Promise.resolve(Response.json(makeChatDetail())));
    vi.stubGlobal('fetch', fetch);
    stops.push(tagLiveReads(globalThis));
    const client = new TrackerClient({ baseUrl: '' });
    const queryClient = createTestQueryClient();
    const observer = new QueryObserver(queryClient, {
      queryKey: queryKeys.chat('c-1'),
      queryFn: () => client.getChat('c-1'),
    });
    stops.push(observer.subscribe(() => undefined));
    await vi.waitFor(() => expect(queryClient.getQueryData(queryKeys.chat('c-1'))).toBeDefined());

    await refreshLive(queryClient, { queryKey: queryKeys.chat('c-1'), exact: true });

    expect(fetch.mock.calls.map(isTagged)).toEqual([false, true]);
  });
});
