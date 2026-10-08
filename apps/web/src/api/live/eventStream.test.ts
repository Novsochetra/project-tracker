import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MockEventSource } from '../test/mockEventSource';
import { LIVE_RETRY_MS, retryDelay } from './backoff';
import { connectLiveUpdates, LIVE_STALE_MS } from './eventStream';

const event = { type: 'changed', projectId: 'p-mob', ticketId: 't-1' };

function connect() {
  const onChange = vi.fn();
  const onReconnect = vi.fn();
  const stop = connectLiveUpdates('/api/events', { onChange, onReconnect });
  return { stop, onChange, onReconnect, source: MockEventSource.latest() };
}

describe('connectLiveUpdates', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    MockEventSource.instances = [];
    vi.stubGlobal('EventSource', MockEventSource);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
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

  it('does nothing where EventSource is missing', () => {
    vi.stubGlobal('EventSource', undefined);
    const stop = connectLiveUpdates('/api/events', { onChange: vi.fn(), onReconnect: vi.fn() });
    expect(() => stop()).not.toThrow();
  });
});
