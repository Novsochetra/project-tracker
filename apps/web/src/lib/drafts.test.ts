import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearDraft, guardUnload, hasDrafts, markDraft } from './drafts';
import { forgetSheetDraft, keepSheetDraft } from './sheetDrafts';
import { forgetDraft, keepDraft } from './storedDrafts';

afterEach(() => {
  clearDraft('comment:PT-1');
  clearDraft('new-ticket:PT');
  forgetDraft('title:PT-1');
});

describe('drafts', () => {
  it('has no drafts at first', () => {
    expect(hasDrafts()).toBe(false);
  });

  it('has a draft from markDraft until clearDraft', () => {
    markDraft('comment:PT-1');
    expect(hasDrafts()).toBe(true);
    clearDraft('comment:PT-1');
    expect(hasDrafts()).toBe(false);
  });

  it('counts marks per id, so each mark needs its own clear', () => {
    markDraft('comment:PT-1');
    markDraft('comment:PT-1');
    clearDraft('comment:PT-1');
    expect(hasDrafts()).toBe(true);
    clearDraft('comment:PT-1');
    expect(hasDrafts()).toBe(false);
  });

  it('keeps other drafts when one is cleared', () => {
    markDraft('comment:PT-1');
    markDraft('new-ticket:PT');
    clearDraft('comment:PT-1');
    expect(hasDrafts()).toBe(true);
  });

  it('ignores clearing a draft that was never marked', () => {
    clearDraft('comment:PT-1');
    expect(hasDrafts()).toBe(false);
    markDraft('comment:PT-1');
    expect(hasDrafts()).toBe(true);
    clearDraft('comment:PT-1');
    expect(hasDrafts()).toBe(false);
  });
});

describe('stored drafts', () => {
  it('count as drafts until they are saved or dropped, with no screen marking them', () => {
    keepDraft('title:PT-1', { ticketKey: 'PT-1', field: 'title', text: 'Typed' }, '');
    expect(hasDrafts()).toBe(true);
    forgetDraft('title:PT-1');
    expect(hasDrafts()).toBe(false);
  });

  it('leave out sheet drafts, which a reload brings back', () => {
    keepSheetDraft('new-ticket:PT', { title: 'Typed' });
    expect(hasDrafts()).toBe(false);
    forgetSheetDraft('new-ticket:PT');
  });

  it('count sheet drafts that storage refused, which a reload would lose', () => {
    const full = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Full', 'QuotaExceededError');
    });
    keepSheetDraft('new-ticket:PT', { title: 'Typed' });
    expect(hasDrafts()).toBe(true);
    forgetSheetDraft('new-ticket:PT');
    expect(hasDrafts()).toBe(false);
    full.mockRestore();
  });
});

describe('guardUnload', () => {
  const unload = () => {
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  };

  it('asks before reload or close only while there are drafts, until stopped', () => {
    const stop = guardUnload();
    expect(unload()).toBe(false);
    markDraft('comment:PT-1');
    expect(unload()).toBe(true);
    stop();
    expect(unload()).toBe(false);
  });
});
