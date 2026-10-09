import { describe, expect, it } from 'vitest';
import type { StoredDraft } from '../../../lib/storedDrafts';
import {
  afterCheck,
  afterSave,
  afterTyping,
  checkApplies,
  checkStep,
  isOpen,
  restoredEdit,
  saveStep,
  STARTED,
  withPhase,
  type EditState,
} from './commentEdit';

const kept = (submitted?: boolean): StoredDraft => ({
  ticketKey: 'MOB-1',
  field: 'comment-edit',
  activityId: 'c1',
  base: 'First thought',
  text: 'First thought, edited',
  ...(submitted === undefined ? {} : { submitted }),
});

const edit = (phase: EditState['phase'], checkFirst = false): EditState => ({ phase, checkFirst });

describe('a comment edit kept from an earlier visit', () => {
  it('opens failed, to be retried, when its Save was pressed', () => {
    expect(restoredEdit(kept(true))).toEqual(edit('failed', true));
  });

  it('opens as it was left when nobody pressed Save', () => {
    expect(restoredEdit(kept())).toEqual(edit('editing', true));
  });

  it('is no edit at all when nothing was kept', () => {
    expect(isOpen(restoredEdit(undefined))).toBe(false);
  });
});

describe('typing in a comment edit', () => {
  it('starts a new edit over a save in flight or a failed one', () => {
    expect(afterTyping(edit('saving'))).toEqual(edit('editing'));
    expect(afterTyping(edit('failed', true))).toEqual(edit('editing', true));
  });

  it('keeps the note that the comment changed elsewhere', () => {
    expect(afterTyping(edit('changed', true))).toEqual(edit('changed', true));
  });
});

describe('Save in a comment edit', () => {
  it('sends an edit started now', () => {
    expect(saveStep(STARTED, 'First thought, edited', 'First thought')).toBe('send');
  });

  it('checks the tracker first for an edit kept from an earlier visit or one that failed', () => {
    expect(saveStep(restoredEdit(kept()), 'First thought, edited', 'First thought')).toBe('check');
    expect(saveStep(edit('failed', true), 'First thought, edited', 'First thought')).toBe('check');
    expect(saveStep(edit('editing', true), 'First thought, edited', 'First thought')).toBe('check');
  });

  it('replaces a comment that changed elsewhere once the user saw it', () => {
    expect(saveStep(edit('changed', true), 'Mine', 'Theirs')).toBe('replace');
  });

  it('closes the editor when the comment already reads so', () => {
    expect(saveStep(edit('editing', true), ' First thought ', 'First thought')).toBe('close');
  });

  it('does nothing while a save is on its way', () => {
    expect(saveStep(edit('saving', true), 'First thought, edited', 'First thought')).toBe('ignore');
  });
});

describe('what a check of the tracker means for a comment edit', () => {
  it('sends the edit only while the comment still reads as it did', () => {
    expect(checkStep('unchanged')).toBe('send');
    expect(checkStep('changed')).toBe('changed');
    expect(checkStep('saved')).toBe('drop');
    expect(checkStep('gone')).toBe('drop');
    expect(checkStep('unreachable')).toBe('wait');
    expect(checkStep(null)).toBe('wait');
  });

  it('counts for the app only while the edit is still the failed one', () => {
    expect(checkApplies(edit('failed', true), 'app')).toBe(true);
    expect(checkApplies(edit('editing', true), 'app')).toBe(false);
    expect(checkApplies(edit('saving', true), 'app')).toBe(false);
  });

  it('counts for Save only while the edit waits for it', () => {
    expect(checkApplies(edit('saving', true), 'user')).toBe(true);
    expect(checkApplies(edit('editing', true), 'user')).toBe(false);
    expect(checkApplies(edit('closed', true), 'user')).toBe(false);
  });

  it('shows that the comment changed elsewhere, or closes the editor when nothing is left to save', () => {
    expect(afterCheck(edit('saving', true), 'changed')).toEqual(edit('changed', true));
    expect(afterCheck(edit('failed', true), 'drop')).toEqual(edit('closed', true));
  });

  it('leaves a Save that could not check failed, to be retried', () => {
    expect(afterCheck(edit('saving', true), 'wait')).toEqual(edit('failed', true));
    expect(afterCheck(edit('failed', true), 'wait')).toEqual(edit('failed', true));
  });

  it('changes nothing before the edit is sent', () => {
    expect(afterCheck(edit('saving', true), 'send')).toEqual(edit('saving', true));
  });
});

describe('a comment edit whose save settled', () => {
  it('closes once saved, and the next Save sends at once', () => {
    expect(afterSave(edit('saving', true), 'saved')).toEqual(edit('closed'));
  });

  it('keeps a new edit typed meanwhile open', () => {
    expect(afterSave(edit('editing'), 'saved')).toEqual(edit('editing'));
    expect(afterSave(edit('editing'), 'failed')).toEqual(edit('editing', true));
  });

  it('reopens failed, and the next Save checks the tracker first', () => {
    expect(afterSave(edit('saving'), 'failed')).toEqual(edit('failed', true));
    expect(afterSave(withPhase(STARTED, 'closed'), 'failed')).toEqual(edit('failed', true));
  });

  // The tracker refused it: the comment changed since the edit was typed, also for text typed
  // since Save, which was typed over the same text.
  it('reopens as changed elsewhere once refused', () => {
    expect(afterSave(edit('saving'), 'stale')).toEqual(edit('changed', true));
    expect(afterSave(edit('editing'), 'stale')).toEqual(edit('changed', true));
    expect(afterSave(withPhase(STARTED, 'closed'), 'stale')).toEqual(edit('changed', true));
  });
});
