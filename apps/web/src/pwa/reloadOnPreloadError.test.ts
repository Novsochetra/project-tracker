import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reloadOnPreloadError } from './reloadOnPreloadError';

let stop: () => void = () => undefined;

const failChunk = () => window.dispatchEvent(new Event('vite:preloadError', { cancelable: true }));

function focusField(): HTMLTextAreaElement {
  const field = document.createElement('textarea');
  document.body.append(field);
  field.focus();
  return field;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  stop();
  vi.useRealTimers();
  document.body.replaceChildren();
});

describe('reloadOnPreloadError', () => {
  it('reloads once a chunk of the old build fails to load and nothing is in progress', () => {
    const reload = vi.fn();
    stop = reloadOnPreloadError(reload);
    expect(reload).not.toHaveBeenCalled();
    failChunk();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('waits like an app update while text is being typed, and reloads once for many failures', () => {
    const reload = vi.fn();
    stop = reloadOnPreloadError(reload);
    const field = focusField();
    failChunk();
    failChunk();
    vi.advanceTimersByTime(10_000);
    expect(reload).not.toHaveBeenCalled();
    field.blur();
    vi.advanceTimersByTime(1000);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('leaves the failed import to fail as usual', () => {
    stop = reloadOnPreloadError(vi.fn());
    const event = new Event('vite:preloadError', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('stops listening when stopped', () => {
    const reload = vi.fn();
    reloadOnPreloadError(reload)();
    failChunk();
    expect(reload).not.toHaveBeenCalled();
  });
});
