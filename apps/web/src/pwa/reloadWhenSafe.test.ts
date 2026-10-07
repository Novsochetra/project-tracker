import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reloadWhenSafe } from './reloadWhenSafe';

function focusField(): HTMLTextAreaElement {
  const field = document.createElement('textarea');
  document.body.append(field);
  field.focus();
  return field;
}

function openSheet(): HTMLElement {
  const sheet = document.createElement('div');
  sheet.setAttribute('role', 'dialog');
  document.body.append(sheet);
  return sheet;
}

function setVisibility(state: DocumentVisibilityState) {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(state);
  document.dispatchEvent(new Event('visibilitychange'));
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('reloadWhenSafe', () => {
  it('reloads at once when nothing is being edited', () => {
    const reload = vi.fn();
    reloadWhenSafe(reload);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('waits until the focused field loses focus', () => {
    const field = focusField();
    const reload = vi.fn();
    reloadWhenSafe(reload);
    vi.advanceTimersByTime(10_000);
    expect(reload).not.toHaveBeenCalled();

    field.blur();
    vi.advanceTimersByTime(1000);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('waits until the open sheet closes', () => {
    const sheet = openSheet();
    const reload = vi.fn();
    reloadWhenSafe(reload);
    vi.advanceTimersByTime(10_000);
    expect(reload).not.toHaveBeenCalled();

    sheet.remove();
    vi.advanceTimersByTime(1000);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('reloads as soon as the page is hidden, without waiting for the timer', () => {
    openSheet();
    focusField();
    const reload = vi.fn();
    reloadWhenSafe(reload);

    setVisibility('hidden');
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('keeps waiting when the page becomes visible again while a field has focus', () => {
    focusField();
    const reload = vi.fn();
    reloadWhenSafe(reload);

    setVisibility('visible');
    vi.advanceTimersByTime(10_000);
    expect(reload).not.toHaveBeenCalled();
  });

  it('reloads only once and then stops checking', () => {
    const field = focusField();
    const reload = vi.fn();
    reloadWhenSafe(reload);
    field.blur();
    vi.advanceTimersByTime(10_000);
    setVisibility('hidden');

    expect(reload).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
