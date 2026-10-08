import { act, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { HIDDEN_GRACE_MS } from '../../src/api/live/pauseWhileHidden';
import { MockEventSource } from '../../src/api/test/mockEventSource';
import { skipAnimations } from '../../src/overlays/testing';
import { advance, loadScreens, ONE_EACH, RENAMED, renderApp, setVisibility } from './countedReads';

// After the page was hidden for more than 30 s, TanStack Query's focus refetch read every open
// query, and the refresh when the reopened live stream opened read them all again. A phone that
// suspends a hidden page runs no timers, so there the stream was kept: the focus refetch read
// everything before the stream had caught up, and the overdue silence timer reopened it and read
// everything again.

const HIDDEN_MS = HIDDEN_GRACE_MS + 10_000;

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
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
  window.history.replaceState(null, '', '/');
});

describe('regression: a resume reads each open query once', () => {
  it('reads after the reopened stream opens and shows what changed while hidden', async () => {
    const server = renderApp('/p/MOB/1');
    expect(await screen.findByDisplayValue('Ticket 1')).toBeInTheDocument();
    const first = MockEventSource.latest();
    act(() => first.open());

    setVisibility('hidden');
    await advance(HIDDEN_MS);
    expect(first.readyState).toBe(MockEventSource.CLOSED);
    server.renameFirstTicket();
    const resumed = server.mark();
    setVisibility('visible');
    await advance(50);
    const beforeOpen = server.readsSince(resumed);
    act(() => MockEventSource.latest().open());
    expect(await screen.findByDisplayValue(RENAMED)).toBeInTheDocument();
    await advance(50);

    expect(server.readsSince(resumed)).toEqual({ ...ONE_EACH, getTicket: 1, listPeople: 1 });
    expect(beforeOpen).toEqual({});
    expect(server.routes.getTicket).toHaveBeenLastCalledWith('MOB-1', { fresh: true });
  });

  it('reopens the stream of a phone that ran no timers while the page was hidden', async () => {
    const server = renderApp('/p/MOB');
    expect(await screen.findByText('Ticket 1')).toBeInTheDocument();
    const first = MockEventSource.latest();
    act(() => first.open());

    setVisibility('hidden');
    vi.setSystemTime(Date.now() + HIDDEN_MS);
    server.renameFirstTicket();
    const resumed = server.mark();
    setVisibility('visible');
    await advance(50);
    const beforeOpen = server.readsSince(resumed);
    const second = MockEventSource.latest();
    act(() => second.open());
    expect(await screen.findByText(RENAMED)).toBeInTheDocument();
    await advance(50);

    expect(server.readsSince(resumed)).toEqual(ONE_EACH);
    expect(beforeOpen).toEqual({});
    expect(second).not.toBe(first);
    expect(first.readyState).toBe(MockEventSource.CLOSED);
  });

  it('still reads on focus after a quick switch, while the stream stays open', async () => {
    const server = renderApp('/p/MOB');
    expect(await screen.findByText('Ticket 1')).toBeInTheDocument();
    const source = MockEventSource.latest();
    act(() => source.open());
    await advance(HIDDEN_GRACE_MS);
    act(() => source.emit('', 'ping'));

    setVisibility('hidden');
    await advance(HIDDEN_GRACE_MS - 1_000);
    const resumed = server.mark();
    setVisibility('visible');
    await advance(50);

    expect(server.readsSince(resumed)).toEqual(ONE_EACH);
    expect(MockEventSource.instances).toHaveLength(1);
  });
});
