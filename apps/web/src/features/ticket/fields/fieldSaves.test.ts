import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { keepDraft, storedDraft } from '../../../lib/storedDrafts';
import {
  carries,
  clearSaves,
  finishSave,
  isSaving,
  isSavingAnywhere,
  isSavingElsewhere,
  NO_SAVES,
  saveStep,
  savesOf,
  sendSave,
  settleSave,
  startSave,
  subscribeSaves,
  typedOver,
  whenSettled,
  type SentSaves,
} from './fieldSaves';
import { SAVE_MARKS_STORAGE_KEY } from './saveMarks';

const sent = (...texts: string[]): SentSaves => texts.reduce(sendSave, NO_SAVES);

describe('the step a field save takes', () => {
  it('sends text the tracker does not show', () => {
    expect(saveStep(NO_SAVES, { value: 'Fix login now', shown: 'Fix login', checked: false })).toBe(
      'send',
    );
  });

  it('counts text the tracker shows as saved while nothing is on its way', () => {
    expect(saveStep(NO_SAVES, { value: 'Fix login', shown: 'Fix login', checked: false })).toBe(
      'unchanged',
    );
  });

  it('sends text the cache shows when the kept text was typed over other text', () => {
    const request = { value: 'Fix login', shown: 'Fix login', checked: false, base: 'Fix it' };
    expect(saveStep(NO_SAVES, request)).toBe('send');
  });

  // Reviewer 61 (PT-76): the other tab's save may already have changed the tracker's text.
  it('sends text the tracker shows while another tab has a save of the field on its way', () => {
    const request = { value: 'Fix login', shown: 'Fix login', checked: false, sentElsewhere: true };
    expect(saveStep(NO_SAVES, request)).toBe('send');
  });

  it('names what it was typed over: the latest save on its way, else the kept text’s base', () => {
    expect(typedOver(NO_SAVES, 'Fix login')).toBe('Fix login');
    expect(typedOver(sent('Fix login now', 'Fix login now!'), 'Fix login')).toBe('Fix login now!');
  });

  it('leaves text to the latest save when that save carries it and is on its way', () => {
    const saves = sent('Fix login now');
    expect(
      saveStep(saves, { value: 'Fix login now', shown: 'Fix login now', checked: false }),
    ).toBe('skip');
  });

  // The tracker would end with the newer save's text.
  it('sends text an older save carries when a newer save with other text went out after it', () => {
    const saves = sent('Fix login now', 'Fix login now please');
    expect(
      saveStep(saves, { value: 'Fix login now', shown: 'Fix login now please', checked: false }),
    ).toBe('send');
  });

  it('sends text the cache shows while a save is still on its way', () => {
    const saves = settleSave(sent('Fix login now', 'Fix login now please'), 2, true).saves;
    expect(
      saveStep(saves, {
        value: 'Fix login now please',
        shown: 'Fix login now please',
        checked: false,
      }),
    ).toBe('send');
  });

  it('sends the latest text again once its save failed', () => {
    const saves = settleSave(sent('Fix login now'), 1, false).saves;
    expect(saveStep(saves, { value: 'Fix login now', shown: 'Fix login', checked: false })).toBe(
      'send',
    );
  });

  it('always sends a retry that checked the tracker first', () => {
    expect(
      saveStep(sent('Fix login now'), { value: 'Fix login now', shown: '', checked: true }),
    ).toBe('send');
    expect(saveStep(NO_SAVES, { value: 'Fix login', shown: 'Fix login', checked: true })).toBe(
      'send',
    );
  });
});

describe('a field save that settles', () => {
  it('is done when it was the latest save sent and landed', () => {
    const { saves, outcome } = settleSave(sent('Fix login now'), 1, true);
    expect(outcome).toBe('done');
    expect(saves.onTheirWay.size).toBe(0);
  });

  it('tells the kept text what the tracker has when an older save lands first', () => {
    const { saves, outcome } = settleSave(sent('Fix login now', 'Fix login now please'), 1, true);
    expect(outcome).toBe('rebase');
    expect([...saves.onTheirWay.values()]).toEqual(['Fix login now please']);
  });

  it('keeps the text when it failed', () => {
    expect(settleSave(sent('Fix login now'), 1, false).outcome).toBe('keep');
    expect(settleSave(sent('Fix login now', 'Fix login now please'), 1, false).outcome).toBe(
      'keep',
    );
  });

  it('keeps the text when it lands after a newer save', () => {
    const newerFirst = settleSave(sent('Fix login now', 'Fix login now please'), 2, true).saves;
    expect(settleSave(newerFirst, 1, true).outcome).toBe('keep');
  });

  it('is done only for the latest of three saves when an undo sent older text again', () => {
    let saves = sent('Fix login now', 'Fix login now please', 'Fix login now');
    let settled = settleSave(saves, 1, true);
    expect(settled.outcome).toBe('rebase');
    saves = settled.saves;
    settled = settleSave(saves, 2, true);
    expect(settled.outcome).toBe('rebase');
    expect(settleSave(settled.saves, 3, true).outcome).toBe('done');
  });
});

describe('the saves of a field kept per draft id', () => {
  const ID = 'description:MOB-1';
  const keep = (text: string) =>
    keepDraft(ID, { ticketKey: 'MOB-1', field: 'description', text }, 'Fix login');

  beforeEach(() => {
    localStorage.clear();
  });

  // A field opened again, or the app-wide sync, asks by id while the field that sent them is gone.
  it('are on their way until the last of them settles', () => {
    keep('Fix login now please');
    const first = startSave(ID, 'Fix login now');
    const second = startSave(ID, 'Fix login now please');
    expect(isSaving(ID)).toBe(true);
    expect(isSaving('title:MOB-1')).toBe(false);
    expect(carries(savesOf(ID), 'Fix login now please')).toBe(true);
    expect(carries(savesOf(ID), 'Fix login now')).toBe(false);
    finishSave(ID, first, true);
    expect(isSaving(ID)).toBe(true);
    finishSave(ID, second, true);
    expect(isSaving(ID)).toBe(false);
    expect(savesOf(ID)).toBe(NO_SAVES);
  });

  it('let the kept text go only when the latest save lands', () => {
    keep('Fix login now please');
    const first = startSave(ID, 'Fix login now');
    const second = startSave(ID, 'Fix login now please');
    finishSave(ID, first, true);
    expect(storedDraft(ID)).toMatchObject({ text: 'Fix login now please', base: 'Fix login now' });
    finishSave(ID, second, true);
    expect(storedDraft(ID)).toBeUndefined();
  });

  it('keep the text when the latest save fails', () => {
    keep('Fix login now');
    const first = startSave(ID, 'Fix login now please');
    const second = startSave(ID, 'Fix login now');
    finishSave(ID, first, true);
    finishSave(ID, second, false);
    expect(storedDraft(ID)).toMatchObject({ text: 'Fix login now', base: 'Fix login now please' });
    expect(isSaving(ID)).toBe(false);
  });

  it('settle each save once', () => {
    keep('Fix login now');
    const number = startSave(ID, 'Fix login now');
    finishSave(ID, number + 1, true);
    expect(isSaving(ID)).toBe(true);
    expect(storedDraft(ID)?.text).toBe('Fix login now');
    finishSave(ID, number, true);
  });

  it('tell subscribers when a save starts or settles', () => {
    const listener = vi.fn();
    const stop = subscribeSaves(listener);
    const number = startSave(ID, 'Fix login now');
    finishSave(ID, number, false);
    expect(listener).toHaveBeenCalledTimes(2);
    stop();
    finishSave(ID, startSave(ID, 'Fix login now'), false);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe('the saves of a field on their way in another tab', () => {
  const ID = 'description:MOB-1';

  // The same module with memory of its own, as in another tab.
  async function otherTab() {
    vi.resetModules();
    return import('./fieldSaves');
  }

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('count for this tab until the other tab hears back', async () => {
    const tab = await otherTab();
    const number = tab.startSave(ID, 'Fix login now');
    expect(isSavingElsewhere(ID)).toBe(true);
    expect(isSavingAnywhere(ID)).toBe(true);
    expect(isSaving(ID)).toBe(false);
    expect(tab.isSavingElsewhere(ID)).toBe(false);
    tab.finishSave(ID, number, true);
    expect(isSavingElsewhere(ID)).toBe(false);
    expect(localStorage.getItem(SAVE_MARKS_STORAGE_KEY)).toBeNull();
  });

  it('stop counting a minute after a tab that closed while sending last sent one', async () => {
    vi.useFakeTimers();
    const tab = await otherTab();
    tab.startSave(ID, 'Fix login now');
    vi.advanceTimersByTime(59_999);
    expect(isSavingElsewhere(ID)).toBe(true);
    vi.advanceTimersByTime(1);
    expect(isSavingElsewhere(ID)).toBe(false);
  });

  // Reviewer 77 (PT-90): nothing said when the mark of a tab that closed mid-save ran out, so a
  // refused field waiting on it waited until something else happened.
  it('tell subscribers when another tab’s mark runs out, though nothing else says so', async () => {
    vi.useFakeTimers();
    const tab = await otherTab();
    tab.startSave(ID, 'Fix login now');
    const listener = vi.fn();
    const run = vi.fn();
    const stop = subscribeSaves(listener);
    whenSettled(ID, run);
    vi.advanceTimersByTime(59_999);
    expect(run).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(listener).toHaveBeenCalled();
    expect(run).toHaveBeenCalledTimes(1);
    stop();
  });

  it('stop counting at once when the page that sent them goes for good', async () => {
    const tab = await otherTab();
    tab.startSave(ID, 'Fix login now');
    const pageGoes = (persisted: boolean) =>
      window.dispatchEvent(Object.assign(new Event('pagehide'), { persisted }));
    pageGoes(true);
    expect(isSavingElsewhere(ID)).toBe(true);
    pageGoes(false);
    expect(isSavingElsewhere(ID)).toBe(false);
  });

  it('tell subscribers when another tab marks or unmarks a draft', () => {
    const listener = vi.fn();
    const stop = subscribeSaves(listener);
    window.dispatchEvent(new StorageEvent('storage', { key: SAVE_MARKS_STORAGE_KEY }));
    window.dispatchEvent(new StorageEvent('storage', { key: 'tracker.drafts' }));
    expect(listener).toHaveBeenCalledTimes(1);
    stop();
  });

  it("leave nothing marked once tests reset this tab's record", () => {
    startSave(ID, 'Fix login now');
    clearSaves();
    expect(isSaving(ID)).toBe(false);
    expect(localStorage.getItem(SAVE_MARKS_STORAGE_KEY)).toBeNull();
  });

  it('run what waits for them once none of the draft is on its way, here or there, once', async () => {
    const run = vi.fn();
    whenSettled(ID, run);
    expect(run).toHaveBeenCalledTimes(1);

    const tab = await otherTab();
    const theirs = tab.startSave(ID, 'Fix login now');
    const mine = startSave(ID, 'Fix login now, please');
    whenSettled(ID, run);
    whenSettled(ID, run);
    finishSave(ID, mine, false);
    expect(run).toHaveBeenCalledTimes(1);
    tab.finishSave(ID, theirs, true);
    window.dispatchEvent(new StorageEvent('storage', { key: SAVE_MARKS_STORAGE_KEY }));
    expect(run).toHaveBeenCalledTimes(2);
  });

  // Lead (PT-90, WebKit under load): each tab wrote every tab's marks back as one value. One that
  // hadn't yet heard of another tab removing its mark put that mark back, so this tab waited a
  // minute for a save that had landed, and its refused edit was never checked again.
  it('are written by each tab for its own saves only', async () => {
    const tab = await otherTab();
    const theirs = tab.startSave(ID, 'Fix login now');
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const mine = startSave(ID, 'Fix login now, please');
    finishSave(ID, mine, false);
    const written = setItem.mock.calls.filter(([key]) => key.startsWith(SAVE_MARKS_STORAGE_KEY));
    const pages = new Set(written.map(([, value]) => (JSON.parse(value) as { page: string }).page));
    expect(written.length).toBe(1);
    expect(pages.size).toBe(1);
    setItem.mockRestore();
    expect(isSavingElsewhere(ID)).toBe(true);
    tab.finishSave(ID, theirs, true);
    expect(isSavingElsewhere(ID)).toBe(false);
  });

  it('drop what waits for them once tests reset this tab’s record', () => {
    const run = vi.fn();
    startSave(ID, 'Fix login now');
    whenSettled(ID, run);
    clearSaves();
    startSave(ID, 'Again');
    clearSaves();
    expect(run).not.toHaveBeenCalled();
  });
});
