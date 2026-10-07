import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MockEventSource } from '../test/mockEventSource';
import { connectLiveUpdates, LIVE_RETRY_MS } from './eventStream';

const event = { type: 'changed', projectId: 'p-mob', ticketId: 't-1' };

describe('connectLiveUpdates', () => {
  beforeEach(() => {
    MockEventSource.instances = [];
    vi.stubGlobal('EventSource', MockEventSource);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('passes change events from unnamed and named messages', () => {
    const onChange = vi.fn();
    connectLiveUpdates('/api/events', { onChange, onReconnect: vi.fn() });
    const source = MockEventSource.latest();
    expect(source.url).toBe('/api/events');
    source.emit(event);
    source.emit(event, 'changed');
    source.emit('not json');
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenCalledWith(event);
  });

  it('reports reconnects but not the first connection', () => {
    const onReconnect = vi.fn();
    connectLiveUpdates('/api/events', { onChange: vi.fn(), onReconnect });
    const source = MockEventSource.latest();
    source.open();
    expect(onReconnect).not.toHaveBeenCalled();
    source.fail(false);
    source.open();
    expect(onReconnect).toHaveBeenCalledTimes(1);
  });

  it('reopens a stream the browser gave up on', () => {
    vi.useFakeTimers();
    const onReconnect = vi.fn();
    connectLiveUpdates('/api/events', { onChange: vi.fn(), onReconnect });
    const first = MockEventSource.latest();
    first.open();
    first.fail(true);
    vi.advanceTimersByTime(LIVE_RETRY_MS - 1);
    expect(MockEventSource.instances).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(MockEventSource.instances).toHaveLength(2);
    MockEventSource.latest().open();
    expect(onReconnect).toHaveBeenCalledTimes(1);
  });

  it('closes the stream and cancels a pending retry on cleanup', () => {
    vi.useFakeTimers();
    const stop = connectLiveUpdates('/api/events', { onChange: vi.fn(), onReconnect: vi.fn() });
    const source = MockEventSource.latest();
    source.fail(true);
    stop();
    vi.advanceTimersByTime(LIVE_RETRY_MS * 2);
    expect(MockEventSource.instances).toHaveLength(1);
    const again = connectLiveUpdates('/api/events', { onChange: vi.fn(), onReconnect: vi.fn() });
    again();
    expect(MockEventSource.latest().readyState).toBe(MockEventSource.CLOSED);
  });

  it('does nothing where EventSource is missing', () => {
    vi.stubGlobal('EventSource', undefined);
    const stop = connectLiveUpdates('/api/events', { onChange: vi.fn(), onReconnect: vi.fn() });
    expect(() => stop()).not.toThrow();
  });
});
