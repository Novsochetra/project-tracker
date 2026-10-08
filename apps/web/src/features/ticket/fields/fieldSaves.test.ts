import { beforeEach, describe, expect, it, vi } from 'vitest';
import { keepDraft, storedDraft } from '../../../lib/storedDrafts';
import {
  carries,
  finishSave,
  isSaving,
  NO_SAVES,
  saveStep,
  savesOf,
  sendSave,
  settleSave,
  startSave,
  subscribeSaves,
  type SentSaves,
} from './fieldSaves';

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
