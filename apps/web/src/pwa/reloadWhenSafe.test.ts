import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearDraft, markDraft } from '../lib/drafts';
import { setPendingWrites } from '../lib/pendingWrites';
import { reloadWhenSafe } from './reloadWhenSafe';

const writer = {};

function focusField(parent: HTMLElement = document.body): HTMLTextAreaElement {
  const field = document.createElement('textarea');
  parent.append(field);
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

function waitingReload() {
  const reload = vi.fn();
  reloadWhenSafe(reload);
  vi.advanceTimersByTime(10_000);
  expect(reload).not.toHaveBeenCalled();
  return reload;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.replaceChildren();
  clearDraft('comment:PT-1');
  setPendingWrites(writer, false);
});

describe('reloadWhenSafe', () => {
  it('reloads at once when nothing is in progress', () => {
    const reload = vi.fn();
    reloadWhenSafe(reload);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('waits until the focused field loses focus', () => {
    const field = focusField();
    const reload = waitingReload();
    field.blur();
    vi.advanceTimersByTime(1000);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('waits until the open sheet closes', () => {
    const sheet = openSheet();
    const reload = waitingReload();
    sheet.remove();
    vi.advanceTimersByTime(1000);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('waits until the draft is cleared', () => {
    markDraft('comment:PT-1');
    const reload = waitingReload();
    clearDraft('comment:PT-1');
    vi.advanceTimersByTime(1000);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('waits until the write in flight finishes', () => {
    setPendingWrites(writer, true);
    const reload = waitingReload();
    setPendingWrites(writer, false);
    vi.advanceTimersByTime(1000);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('keeps waiting when the page is hidden while typing in a sheet', () => {
    focusField(openSheet());
    const reload = waitingReload();
    setVisibility('hidden');
    vi.advanceTimersByTime(10_000);
    expect(reload).not.toHaveBeenCalled();
  });

  it('checks again as soon as the visibility changes, without waiting for the timer', () => {
    markDraft('comment:PT-1');
    const reload = waitingReload();
    clearDraft('comment:PT-1');
    setVisibility('hidden');
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('keeps waiting when the page becomes visible again while a field has focus', () => {
    focusField();
    const reload = waitingReload();
    setVisibility('visible');
    vi.advanceTimersByTime(10_000);
    expect(reload).not.toHaveBeenCalled();
  });

  it('reloads only once and then stops checking', () => {
    const field = focusField();
    const reload = waitingReload();
    field.blur();
    vi.advanceTimersByTime(10_000);
    setVisibility('hidden');

    expect(reload).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
