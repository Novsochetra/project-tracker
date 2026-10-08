import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HIDDEN_GRACE_MS, pauseWhileHidden } from './pauseWhileHidden';

let stop: () => void = () => undefined;

function watch() {
  const target = { pause: vi.fn(), resume: vi.fn() };
  stop = pauseWhileHidden(target);
  return target;
}

const setVisibility = (state: DocumentVisibilityState) =>
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(state);

const visibilityChange = () => document.dispatchEvent(new Event('visibilitychange'));

function becomeHidden() {
  setVisibility('hidden');
  visibilityChange();
}

function becomeVisible() {
  setVisibility('visible');
  visibilityChange();
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  stop();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('pauseWhileHidden', () => {
  it('pauses once the page has stayed hidden for the grace period', () => {
    const target = watch();
    becomeHidden();
    vi.advanceTimersByTime(HIDDEN_GRACE_MS - 1);
    expect(target.pause).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);

    expect(target.pause).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(HIDDEN_GRACE_MS * 10);
    expect(target.pause).toHaveBeenCalledTimes(1);
    expect(target.resume).not.toHaveBeenCalled();
  });

  it('resumes as soon as a paused page is visible again', () => {
    const target = watch();
    becomeHidden();
    vi.advanceTimersByTime(HIDDEN_GRACE_MS);

    becomeVisible();

    expect(target.resume).toHaveBeenCalledTimes(1);
    becomeVisible();
    expect(target.resume).toHaveBeenCalledTimes(1);
  });

  it('leaves quick switches to another app alone', () => {
    const target = watch();
    for (let visit = 0; visit < 3; visit += 1) {
      becomeHidden();
      vi.advanceTimersByTime(HIDDEN_GRACE_MS - 1);
      becomeVisible();
    }
    vi.advanceTimersByTime(HIDDEN_GRACE_MS * 2);
    expect(target.pause).not.toHaveBeenCalled();
    expect(target.resume).not.toHaveBeenCalled();
  });

  it('pauses a page that starts hidden', () => {
    setVisibility('hidden');
    const target = watch();
    vi.advanceTimersByTime(HIDDEN_GRACE_MS);
    expect(target.pause).toHaveBeenCalledTimes(1);
  });

  it('reopens once on the visible event when a resumed phone runs the timer first', () => {
    const target = watch();
    becomeHidden();
    setVisibility('visible');
    vi.advanceTimersByTime(HIDDEN_GRACE_MS);
    expect(target.pause).not.toHaveBeenCalled();

    visibilityChange();

    expect(target.pause).toHaveBeenCalledTimes(1);
    expect(target.resume).toHaveBeenCalledTimes(1);
    expect(target.pause.mock.invocationCallOrder[0]).toBeLessThan(
      target.resume.mock.invocationCallOrder[0]!,
    );
  });

  it('reopens a page hidden for the grace period whose timer never ran', () => {
    const target = watch();
    becomeHidden();
    vi.setSystemTime(Date.now() + HIDDEN_GRACE_MS);

    becomeVisible();

    expect(target.pause).toHaveBeenCalledTimes(1);
    expect(target.resume).toHaveBeenCalledTimes(1);
    becomeVisible();
    expect(target.resume).toHaveBeenCalledTimes(1);
  });

  it('keeps a page hidden for less than the grace period whose timer never ran', () => {
    const target = watch();
    becomeHidden();
    vi.setSystemTime(Date.now() + HIDDEN_GRACE_MS - 1);
    becomeVisible();
    expect(target.pause).not.toHaveBeenCalled();
    expect(target.resume).not.toHaveBeenCalled();
  });

  it('stops watching once stopped', () => {
    const target = watch();
    becomeHidden();
    stop();
    vi.advanceTimersByTime(HIDDEN_GRACE_MS);
    becomeVisible();
    expect(target.pause).not.toHaveBeenCalled();
    expect(target.resume).not.toHaveBeenCalled();
  });
});
