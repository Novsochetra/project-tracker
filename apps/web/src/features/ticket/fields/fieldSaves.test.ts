import { describe, expect, it } from 'vitest';
import { NO_SAVES, saveStep, sendSave, settleSave, type SentSaves } from './fieldSaves';

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
