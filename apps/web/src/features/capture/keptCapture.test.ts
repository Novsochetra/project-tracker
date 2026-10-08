import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { keepSheetDraft, sheetDraft } from '../../lib/sheetDrafts';
import { BLANK_CAPTURE, CAPTURE_DRAFT_ID } from './captureForm';
import { keptCapture, useCaptureId, useKeepCapture, type KeptCapture } from './keptCapture';

const IDEA = { title: 'Idea from the bus', description: 'Steps', priority: 'high' } as const;

afterEach(() => {
  localStorage.clear();
});

describe('keptCapture', () => {
  it('starts blank, in the default project, when nothing is kept', () => {
    expect(keptCapture()).toEqual({ values: BLANK_CAPTURE, projectKey: null, clientId: null });
  });

  it('reads back what an open sheet kept, and skips what it cannot read', () => {
    keepSheetDraft(CAPTURE_DRAFT_ID, { ...IDEA, projectKey: 'MOB', clientId: 'c1' });
    expect(keptCapture()).toEqual({ values: IDEA, projectKey: 'MOB', clientId: 'c1' });
    keepSheetDraft(CAPTURE_DRAFT_ID, { title: 7, priority: 'urgent', projectKey: 3, clientId: 4 });
    expect(keptCapture()).toEqual({ values: BLANK_CAPTURE, projectKey: null, clientId: null });
  });
});

describe('useKeepCapture', () => {
  const keep = (kept: KeptCapture, open: boolean) =>
    renderHook((props) => useKeepCapture(props.kept, props.open), {
      initialProps: { kept, open },
    });

  it('keeps the text with its project and id while the sheet is open, until it is emptied', () => {
    const { rerender } = keep({ values: IDEA, projectKey: null, clientId: null }, true);
    expect(sheetDraft(CAPTURE_DRAFT_ID)).toEqual({ ...IDEA, projectKey: null, clientId: null });
    rerender({ kept: { values: IDEA, projectKey: 'MOB', clientId: 'c1' }, open: true });
    expect(sheetDraft(CAPTURE_DRAFT_ID)).toEqual({ ...IDEA, projectKey: 'MOB', clientId: 'c1' });
    rerender({
      kept: { values: { ...BLANK_CAPTURE, priority: 'high' }, projectKey: 'MOB', clientId: 'c1' },
      open: true,
    });
    expect(sheetDraft(CAPTURE_DRAFT_ID)).toBeUndefined();
  });

  it('leaves the kept text alone while the sheet is closed', () => {
    keepSheetDraft(CAPTURE_DRAFT_ID, { ...IDEA, projectKey: null });
    keep({ values: BLANK_CAPTURE, projectKey: null, clientId: null }, false);
    expect(sheetDraft(CAPTURE_DRAFT_ID)).toEqual({ ...IDEA, projectKey: null });
  });
});

describe('useCaptureId', () => {
  const capture = { values: IDEA, projectKey: null };

  it('makes an id at the first take, keeps it with the text at once and gives it every time', () => {
    const { result } = renderHook(() => useCaptureId(null, false));
    expect(result.current.clientId).toBeNull();

    let first = '';
    act(() => {
      // Nothing kept yet, as when Enter comes right after the last keystroke.
      first = result.current.take(capture);
      expect(sheetDraft(CAPTURE_DRAFT_ID)).toEqual({ ...IDEA, projectKey: null, clientId: first });
    });
    expect(first).not.toBe('');
    expect(result.current.clientId).toBe(first);
    expect(result.current.take(capture)).toBe(first);
  });

  it('gives the kept id of a capture whose Create had no answer', () => {
    const { result } = renderHook(() => useCaptureId('c1', false));
    expect(result.current.take(capture)).toBe('c1');
  });

  it('lets the id go once the capture is emptied, so what is typed next is a new capture', () => {
    const { result, rerender } = renderHook((props) => useCaptureId('c1', props.empty), {
      initialProps: { empty: false },
    });
    rerender({ empty: true });
    expect(result.current.clientId).toBeNull();
    rerender({ empty: false });

    let next = '';
    act(() => {
      next = result.current.take(capture);
    });
    expect(next).not.toBe('c1');
    expect(sheetDraft(CAPTURE_DRAFT_ID)).toEqual({ ...IDEA, projectKey: null, clientId: next });
  });
});
