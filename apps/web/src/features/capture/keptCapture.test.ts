import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { keepSheetDraft, sheetDraft } from '../../lib/sheetDrafts';
import { BLANK_CAPTURE, CAPTURE_DRAFT_ID } from './captureForm';
import { keptCapture, useKeepCapture, type KeptCapture } from './keptCapture';

const IDEA = { title: 'Idea from the bus', description: 'Steps', priority: 'high' } as const;

afterEach(() => {
  localStorage.clear();
});

describe('keptCapture', () => {
  it('starts blank, in the default project, when nothing is kept', () => {
    expect(keptCapture()).toEqual({ values: BLANK_CAPTURE, projectKey: null });
  });

  it('reads back what an open sheet kept, and skips what it cannot read', () => {
    keepSheetDraft(CAPTURE_DRAFT_ID, { ...IDEA, projectKey: 'MOB' });
    expect(keptCapture()).toEqual({ values: IDEA, projectKey: 'MOB' });
    keepSheetDraft(CAPTURE_DRAFT_ID, { title: 7, priority: 'urgent', projectKey: 3 });
    expect(keptCapture()).toEqual({ values: BLANK_CAPTURE, projectKey: null });
  });
});

describe('useKeepCapture', () => {
  const keep = (kept: KeptCapture, open: boolean) =>
    renderHook((props) => useKeepCapture(props.kept, props.open), {
      initialProps: { kept, open },
    });

  it('keeps the text with its project while the sheet is open, until it is emptied', () => {
    const { rerender } = keep({ values: IDEA, projectKey: null }, true);
    expect(sheetDraft(CAPTURE_DRAFT_ID)).toEqual({ ...IDEA, projectKey: null });
    rerender({ kept: { values: IDEA, projectKey: 'MOB' }, open: true });
    expect(sheetDraft(CAPTURE_DRAFT_ID)).toEqual({ ...IDEA, projectKey: 'MOB' });
    rerender({
      kept: { values: { ...BLANK_CAPTURE, priority: 'high' }, projectKey: 'MOB' },
      open: true,
    });
    expect(sheetDraft(CAPTURE_DRAFT_ID)).toBeUndefined();
  });

  it('leaves the kept text alone while the sheet is closed', () => {
    keepSheetDraft(CAPTURE_DRAFT_ID, { ...IDEA, projectKey: null });
    keep({ values: BLANK_CAPTURE, projectKey: null }, false);
    expect(sheetDraft(CAPTURE_DRAFT_ID)).toEqual({ ...IDEA, projectKey: null });
  });
});
