import { LIVE_STALE_MS } from '@tracker/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MockEventSource } from '../test/mockEventSource';
import { LIVE_RETRY_MS, retryDelay } from './backoff';
import { connectLiveUpdates, LIVE_WAIT_ATTEMPTS, type TrackerReachability } from './eventStream';
import { HIDDEN_GRACE_MS } from './pauseWhileHidden';

const event = { type: 'changed', projectId: 'p-mob', ticketId: 't-1' };

// Every connection watches the page's visibility until it is stopped.
let connections: Array<() => void> = [];

function connect(tracker?: TrackerReachability) {
  const handlers = {
    onChange: vi.fn(),
    onRun: vi.fn(),
    onRunStep: vi.fn(),
    onReconnect: vi.fn(),
    onRefreshPending: vi.fn(),
    onRefused: vi.fn(),
  };
  const stop = connectLiveUpdates('/api/events', handlers, tracker);
  connections.push(stop);
  return { stop, ...handlers, source: MockEventSource.latest() };
}

function setVisibility(state: DocumentVisibilityState) {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(state);
  document.dispatchEvent(new Event('visibilitychange'));
}

// The app's word on whether the tracker answers (app/reachability), here lost at first.
function lostTracker() {
  let unreachable = true;
  const listeners = new Set<() => void>();
  const set = (next: boolean) => {
    unreachable = next;
    listeners.forEach((listener) => listener());
  };
  return {
    isUnreachable: () => unreachable,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    listening: () => listeners.size,
    answers: () => set(false),
    lost: () => set(true),
  };
}

// The first stream and the next `tries` reopenings each get a 502; it then waits retryDelay(tries).
function refuseTries(tries: number) {
  MockEventSource.latest().fail(true);
  for (let attempt = 0; attempt < tries; attempt += 1) {
    vi.advanceTimersByTime(retryDelay(attempt));
    MockEventSource.latest().fail(true);
  }
}

describe('connectLiveUpdates', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    MockEventSource.instances = [];
    vi.stubGlobal('EventSource', MockEventSource);
  });

  afterEach(() => {
    connections.forEach((stop) => stop());
    connections = [];
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('passes change events from unnamed and named messages', () => {
    const { source, onChange } = connect();
    expect(source.url).toBe('/api/events');
    source.emit(event);
    source.emit(event, 'changed');
    source.emit('not json');
    source.emit('', 'ping');
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenCalledWith(event);
  });

  it('passes named run events apart from changes', () => {
    const { source, onChange, onRun } = connect();
    const run = {
      type: 'run',
      runId: 'r1',
      runnerId: 'h1',
      projectId: 'p-mob',
      ticketId: 't-1',
      chatId: null,
      status: 'running',
    };
    source.emit(run, 'run');
    source.emit(run);
    source.emit(event, 'run');
    expect(onRun).toHaveBeenCalledTimes(1);
    expect(onRun).toHaveBeenCalledWith(run);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('passes named step events apart from runs and changes', () => {
    const { source, onChange, onRun, onRunStep } = connect();
    const step = {
      type: 'run-step',
      runId: 'r1',
      projectId: 'p-mob',
      ticketId: null,
      chatId: 'c-1',
      count: 4,
    };
    source.emit(step, 'run-step');
    source.emit(step);
    source.emit(step, 'run');
    expect(onRunStep).toHaveBeenCalledTimes(1);
    expect(onRunStep).toHaveBeenCalledWith(step);
    expect(onRun).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('reports reconnects but not the first connection', () => {
    const { source, onReconnect } = connect();
    source.open();
    expect(onReconnect).not.toHaveBeenCalled();
    source.fail(false);
    source.open();
    expect(onReconnect).toHaveBeenCalledTimes(1);
  });

  it('reports the first connection as a reconnect when an earlier attempt failed', () => {
    const { source, onReconnect } = connect();
    source.fail(false);
    source.open();
    expect(onReconnect).toHaveBeenCalledTimes(1);
  });

  it('reopens a stream the browser gave up on', () => {
    const { source, onReconnect } = connect();
    source.open();
    source.fail(true);
    vi.advanceTimersByTime(LIVE_RETRY_MS - 1);
    expect(MockEventSource.instances).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(MockEventSource.instances).toHaveLength(2);
    MockEventSource.latest().open();
    expect(onReconnect).toHaveBeenCalledTimes(1);
  });

  it('refreshes once a server that was down at start answers', () => {
    const { source, onReconnect } = connect();
    source.fail(true);
    vi.advanceTimersByTime(LIVE_RETRY_MS);
    MockEventSource.latest().fail(true);
    vi.advanceTimersByTime(retryDelay(1));
    expect(MockEventSource.instances).toHaveLength(3);
    expect(onReconnect).not.toHaveBeenCalled();

    MockEventSource.latest().open();

    expect(onReconnect).toHaveBeenCalledTimes(1);
  });

  it('waits longer after each failed attempt and starts over once a stream opens', () => {
    connect();
    const failAndWait = () => {
      const count = MockEventSource.instances.length;
      MockEventSource.latest().fail(true);
      let waited = 0;
      while (MockEventSource.instances.length === count && waited < LIVE_STALE_MS) {
        vi.advanceTimersByTime(500);
        waited += 500;
      }
      return waited;
    };

    const waits = Array.from({ length: 6 }, () => failAndWait());

    expect(waits).toEqual([0, 1, 2, 3, 4, 5].map((attempt) => retryDelay(attempt)));
    MockEventSource.latest().open();
    expect(failAndWait()).toBe(LIVE_RETRY_MS);
  });

  it('reopens a stream that looks open but misses two heartbeats', () => {
    const { source, onReconnect } = connect();
    source.open();
    vi.advanceTimersByTime(LIVE_STALE_MS - 1);
    expect(source.readyState).toBe(MockEventSource.OPEN);

    vi.advanceTimersByTime(1);

    expect(source.readyState).toBe(MockEventSource.CLOSED);
    vi.advanceTimersByTime(LIVE_RETRY_MS);
    expect(MockEventSource.instances).toHaveLength(2);
    MockEventSource.latest().open();
    expect(onReconnect).toHaveBeenCalledTimes(1);
  });

  it('keeps a stream that pings or sends changes', () => {
    const { source } = connect();
    source.open();
    for (let beat = 0; beat < 6; beat += 1) {
      vi.advanceTimersByTime(LIVE_STALE_MS - 1);
      if (beat % 2) source.emit(event);
      else source.emit('', 'ping');
    }
    expect(source.readyState).toBe(MockEventSource.OPEN);
    expect(MockEventSource.instances).toHaveLength(1);
  });

  it('replaces a connection that never opens', () => {
    const { source, onReconnect } = connect();
    vi.advanceTimersByTime(LIVE_STALE_MS + LIVE_RETRY_MS);
    expect(source.readyState).toBe(MockEventSource.CLOSED);
    expect(MockEventSource.instances).toHaveLength(2);
    MockEventSource.latest().open();
    expect(onReconnect).toHaveBeenCalledTimes(1);
  });

  it('reports a stream the browser gives up on, not a drop it retries itself', () => {
    const { source, onRefused } = connect();
    source.open();
    source.fail(false);
    expect(onRefused).not.toHaveBeenCalled();

    source.fail(true);

    expect(onRefused).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(LIVE_RETRY_MS);
    MockEventSource.latest().fail(true);
    expect(onRefused).toHaveBeenCalledTimes(2);
  });

  it('closes the stream while the page stays hidden and reopens it with a refresh', () => {
    const { source, onReconnect } = connect();
    source.open();
    setVisibility('hidden');
    vi.advanceTimersByTime(HIDDEN_GRACE_MS - 1);
    expect(source.readyState).toBe(MockEventSource.OPEN);

    vi.advanceTimersByTime(1);

    expect(source.readyState).toBe(MockEventSource.CLOSED);
    vi.advanceTimersByTime(LIVE_STALE_MS * 20);
    expect(MockEventSource.instances).toHaveLength(1);
    setVisibility('visible');
    expect(MockEventSource.instances).toHaveLength(2);
    expect(onReconnect).not.toHaveBeenCalled();
    MockEventSource.latest().open();
    expect(onReconnect).toHaveBeenCalledTimes(1);
  });

  it('keeps the stream through a quick switch to another app', () => {
    const { source, onReconnect } = connect();
    source.open();
    setVisibility('hidden');
    vi.advanceTimersByTime(HIDDEN_GRACE_MS - 1);
    setVisibility('visible');
    source.emit('', 'ping');
    vi.advanceTimersByTime(HIDDEN_GRACE_MS);
    expect(source.readyState).toBe(MockEventSource.OPEN);
    expect(MockEventSource.instances).toHaveLength(1);
    expect(onReconnect).not.toHaveBeenCalled();
  });

  it('stops retrying while hidden and tries again as soon as the page is visible', () => {
    const { source, onRefused } = connect();
    source.fail(true);
    setVisibility('hidden');
    vi.advanceTimersByTime(HIDDEN_GRACE_MS);
    const attempts = MockEventSource.instances.length;
    expect(MockEventSource.latest().readyState).toBe(MockEventSource.CLOSED);

    vi.advanceTimersByTime(LIVE_STALE_MS * 20);

    expect(MockEventSource.instances).toHaveLength(attempts);
    expect(onRefused).toHaveBeenCalledTimes(1);
    setVisibility('visible');
    expect(MockEventSource.instances).toHaveLength(attempts + 1);
  });

  it('reports a refresh pending from a drop until the next stream opens', () => {
    const { source, onRefreshPending, onReconnect } = connect();
    source.open();
    expect(onRefreshPending).toHaveBeenLastCalledWith(false);

    source.fail(false);
    expect(onRefreshPending).toHaveBeenLastCalledWith(true);
    source.fail(true);
    vi.advanceTimersByTime(LIVE_RETRY_MS);
    expect(onRefreshPending).toHaveBeenLastCalledWith(true);
    expect(onReconnect).not.toHaveBeenCalled();

    MockEventSource.latest().open();

    expect(onRefreshPending).toHaveBeenLastCalledWith(false);
    expect(onReconnect).toHaveBeenCalledTimes(1);
  });

  it('reports a refresh pending from a pause until the stream reopened on return opens', () => {
    const { source, onRefreshPending } = connect();
    source.open();
    setVisibility('hidden');
    vi.advanceTimersByTime(HIDDEN_GRACE_MS);
    expect(onRefreshPending).toHaveBeenLastCalledWith(true);

    setVisibility('visible');
    expect(onRefreshPending).toHaveBeenLastCalledWith(true);
    MockEventSource.latest().open();
    expect(onRefreshPending).toHaveBeenLastCalledWith(false);
  });

  it('stops holding reads back after a few failed attempts, and still refreshes on an open', () => {
    const { source, onRefreshPending, onReconnect } = connect();
    source.fail(true);
    for (let attempt = 1; attempt < LIVE_WAIT_ATTEMPTS; attempt += 1) {
      expect(onRefreshPending).toHaveBeenLastCalledWith(true);
      vi.advanceTimersByTime(retryDelay(attempt - 1));
      MockEventSource.latest().fail(true);
    }
    expect(onRefreshPending).toHaveBeenLastCalledWith(false);
    vi.advanceTimersByTime(retryDelay(LIVE_WAIT_ATTEMPTS - 1));
    MockEventSource.latest().fail(true);
    expect(onRefreshPending).toHaveBeenLastCalledWith(false);
    expect(onReconnect).not.toHaveBeenCalled();

    vi.advanceTimersByTime(retryDelay(LIVE_WAIT_ATTEMPTS));
    MockEventSource.latest().open();

    expect(onReconnect).toHaveBeenCalledTimes(1);
    MockEventSource.latest().fail(true);
    expect(onRefreshPending).toHaveBeenLastCalledWith(true);
  });

  it('counts the tries the browser makes itself toward holding reads back', () => {
    const { source, onRefreshPending, onReconnect } = connect();
    source.open();
    for (let attempt = 1; attempt < LIVE_WAIT_ATTEMPTS; attempt += 1) {
      source.fail(false);
      expect(onRefreshPending).toHaveBeenLastCalledWith(true);
    }

    source.fail(false);

    expect(onRefreshPending).toHaveBeenLastCalledWith(false);
    expect(MockEventSource.instances).toHaveLength(1);
    source.open();
    expect(onReconnect).toHaveBeenCalledTimes(1);
    source.fail(false);
    expect(onRefreshPending).toHaveBeenLastCalledWith(true);
  });

  it('reports no refresh pending once stopped, since no stream opens again', () => {
    const { source, stop, onRefreshPending } = connect();
    source.fail(true);
    expect(onRefreshPending).toHaveBeenLastCalledWith(true);
    stop();
    expect(onRefreshPending).toHaveBeenLastCalledWith(false);
  });

  it('closes the stream and cancels pending timers on cleanup', () => {
    const { source, stop } = connect();
    source.fail(true);
    stop();
    vi.advanceTimersByTime(LIVE_STALE_MS * 2);
    expect(MockEventSource.instances).toHaveLength(1);

    const again = connect();
    again.source.open();
    again.stop();
    vi.advanceTimersByTime(LIVE_STALE_MS * 2);
    expect(again.source.readyState).toBe(MockEventSource.CLOSED);
    expect(MockEventSource.instances).toHaveLength(2);
  });

  it('stops watching the page once cleaned up', () => {
    const { source, stop } = connect();
    source.open();
    stop();
    setVisibility('hidden');
    vi.advanceTimersByTime(HIDDEN_GRACE_MS);
    setVisibility('visible');
    expect(MockEventSource.instances).toHaveLength(1);
  });

  describe('when the tracker answers again', () => {
    it('opens a stream waiting to reopen at once, and starts its backoff over', () => {
      const tracker = lostTracker();
      const { onReconnect } = connect(tracker);
      refuseTries(4);
      const tried = MockEventSource.instances.length;

      tracker.answers();

      expect(MockEventSource.instances).toHaveLength(tried + 1);
      MockEventSource.latest().fail(true);
      vi.advanceTimersByTime(LIVE_RETRY_MS - 1);
      expect(MockEventSource.instances).toHaveLength(tried + 1);
      vi.advanceTimersByTime(1);
      expect(MockEventSource.instances).toHaveLength(tried + 2);
      MockEventSource.latest().open();
      expect(onReconnect).toHaveBeenCalledTimes(1);
    });

    it('drops the try it was waiting for', () => {
      const tracker = lostTracker();
      connect(tracker);
      refuseTries(4);
      tracker.answers();
      const tried = MockEventSource.instances.length;

      vi.advanceTimersByTime(retryDelay(4));

      expect(MockEventSource.instances).toHaveLength(tried);
    });

    it('leaves an open stream alone', () => {
      const tracker = lostTracker();
      const { source, onReconnect } = connect(tracker);
      source.open();

      tracker.answers();
      tracker.lost();
      tracker.answers();

      expect(MockEventSource.instances).toHaveLength(1);
      expect(source.readyState).toBe(MockEventSource.OPEN);
      expect(onReconnect).not.toHaveBeenCalled();
    });

    it('opens no second stream while one is on its way', () => {
      const tracker = lostTracker();
      const { source } = connect(tracker);
      tracker.answers();
      tracker.lost();
      expect(MockEventSource.instances).toHaveLength(1);

      source.open();
      source.fail(false);
      tracker.answers();

      expect(MockEventSource.instances).toHaveLength(1);
      expect(source.readyState).toBe(MockEventSource.CONNECTING);
    });

    it('waits on when the tracker is lost, not found', () => {
      const tracker = lostTracker();
      tracker.answers();
      connect(tracker);
      refuseTries(2);
      const tried = MockEventSource.instances.length;

      tracker.lost();

      expect(MockEventSource.instances).toHaveLength(tried);
    });

    it('keeps a stream closed while the page is hidden', () => {
      const tracker = lostTracker();
      connect(tracker);
      refuseTries(1);
      setVisibility('hidden');
      vi.advanceTimersByTime(HIDDEN_GRACE_MS);
      const tried = MockEventSource.instances.length;

      tracker.answers();

      expect(MockEventSource.instances).toHaveLength(tried);
    });

    it('stops listening once stopped', () => {
      const tracker = lostTracker();
      const { stop } = connect(tracker);
      refuseTries(1);
      expect(tracker.listening()).toBe(1);

      stop();
      tracker.answers();

      expect(tracker.listening()).toBe(0);
      expect(MockEventSource.instances).toHaveLength(2);
    });
  });

  it('does nothing where EventSource is missing', () => {
    vi.stubGlobal('EventSource', undefined);
    const stop = connectLiveUpdates('/api/events', {
      onChange: vi.fn(),
      onRun: vi.fn(),
      onRunStep: vi.fn(),
      onReconnect: vi.fn(),
      onRefreshPending: vi.fn(),
      onRefused: vi.fn(),
    });
    expect(() => stop()).not.toThrow();
  });
});
