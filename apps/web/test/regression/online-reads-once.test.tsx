import { act, screen } from '@testing-library/react';
import { onlineManager } from '@tanstack/react-query';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { HIDDEN_GRACE_MS } from '../../src/api/live/pauseWhileHidden';
import { STALE_TIME_MS } from '../../src/api/queryClient';
import { MockEventSource } from '../../src/api/test/mockEventSource';
import { skipAnimations } from '../../src/overlays/testing';
import {
  advance,
  loadScreens,
  ONE_EACH,
  RENAMED,
  renderApp,
  setOnline,
  setVisibility,
} from './countedReads';

// A phone that lost its network while it was locked read every stale query twice on return:
// TanStack Query's refetch when the browser is online again wasn't held back like its focus
// refetch, so it read everything before the reopened live stream opened (without the stream's
// catch-up), and the stream's refresh read it all again.

const HIDDEN_MS = HIDDEN_GRACE_MS + 10_000;
// Long enough for the queries to go stale, short of the stream's silence window.
const STALE_MS = STALE_TIME_MS + 1_000;

let restore: Array<() => void> = [];

beforeAll(loadScreens);

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  MockEventSource.instances = [];
  vi.stubGlobal('EventSource', MockEventSource);
  restore = [skipAnimations()];
});

afterEach(() => {
  restore.forEach((undo) => undo());
  onlineManager.setOnline(true);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
  window.history.replaceState(null, '', '/');
});

describe('regression: coming back online reads each open query once', () => {
  it('reads after the reopened stream opens, on a phone that ran no timers while locked', async () => {
    const server = renderApp('/p/MOB');
    expect(await screen.findByText('Ticket 1')).toBeInTheDocument();
    act(() => MockEventSource.latest().open());

    setVisibility('hidden');
    setOnline(false);
    vi.setSystemTime(Date.now() + HIDDEN_MS);
    server.renameFirstTicket();
    const back = server.mark();
    setVisibility('visible');
    setOnline(true);
    await advance(50);
    const beforeOpen = server.readsSince(back);
    act(() => MockEventSource.latest().open());
    expect(await screen.findByText(RENAMED)).toBeInTheDocument();
    await advance(50);

    expect(beforeOpen).toEqual({});
    expect(server.readsSince(back)).toEqual(ONE_EACH);
  });

  it('reads once a dropped stream opens again while the page stays visible', async () => {
    const server = renderApp('/p/MOB');
    expect(await screen.findByText('Ticket 1')).toBeInTheDocument();
    const source = MockEventSource.latest();
    act(() => source.open());

    setOnline(false);
    act(() => source.fail(false));
    await advance(STALE_MS);
    const back = server.mark();
    setOnline(true);
    await advance(50);
    const beforeOpen = server.readsSince(back);
    act(() => source.open());
    await advance(50);

    expect(beforeOpen).toEqual({});
    expect(server.readsSince(back)).toEqual(ONE_EACH);
  });

  it('still reads stale queries when the browser is online again with the stream open', async () => {
    const server = renderApp('/p/MOB');
    expect(await screen.findByText('Ticket 1')).toBeInTheDocument();
    const source = MockEventSource.latest();
    act(() => source.open());
    await advance(STALE_MS);
    act(() => source.emit('', 'ping'));

    const back = server.mark();
    setOnline(false);
    setOnline(true);
    await advance(50);

    expect(server.readsSince(back)).toEqual(ONE_EACH);
  });
});
