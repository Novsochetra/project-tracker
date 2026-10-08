import { afterEach, describe, expect, it } from 'vitest';
import { clearDraft, hasDrafts, markDraft } from './drafts';

afterEach(() => {
  clearDraft('comment:PT-1');
  clearDraft('new-ticket:PT');
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

  it('keeps one entry per id, so marking twice needs one clear', () => {
    markDraft('comment:PT-1');
    markDraft('comment:PT-1');
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
  });
});
