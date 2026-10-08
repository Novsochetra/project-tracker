import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { keepSheetDraft, sheetDraft } from '../../lib/sheetDrafts';
import { BLANK_CAPTURE, CAPTURE_DRAFT_ID } from './captureForm';
import {
  keptCapture,
  useCaptureId,
  useKeepCapture,
  type CaptureIdentity,
  type KeptCapture,
} from './keptCapture';

const IDEA = { title: 'Idea from the bus', description: 'Steps', priority: 'high' } as const;
const FIRST = { title: 'Idea', description: '', priority: 'medium' } as const;
const C1: CaptureIdentity = { clientId: 'c1', sent: FIRST };

afterEach(() => {
  localStorage.clear();
});

describe('keptCapture', () => {
  it('starts blank, in the default project, when nothing is kept', () => {
    expect(keptCapture()).toEqual({ values: BLANK_CAPTURE, projectKey: null, identity: null });
  });

  it('reads back what an open sheet kept, and skips what it cannot read', () => {
    keepSheetDraft(CAPTURE_DRAFT_ID, { ...IDEA, projectKey: 'MOB', clientId: 'c1', sent: FIRST });
    expect(keptCapture()).toEqual({ values: IDEA, projectKey: 'MOB', identity: C1 });
    keepSheetDraft(CAPTURE_DRAFT_ID, { title: 7, priority: 'urgent', projectKey: 3, clientId: 4 });
    expect(keptCapture()).toEqual({ values: BLANK_CAPTURE, projectKey: null, identity: null });
  });

  it('takes the kept text as the sent text of an id kept without one', () => {
    keepSheetDraft(CAPTURE_DRAFT_ID, {
      ...IDEA,
      title: ' Idea ',
      projectKey: null,
      clientId: 'c1',
    });
    expect(keptCapture().identity).toEqual({ clientId: 'c1', sent: { ...IDEA, title: 'Idea' } });
  });
});

describe('useKeepCapture', () => {
  const keep = (kept: KeptCapture, open: boolean) =>
    renderHook((props) => useKeepCapture(props.kept, props.open), {
      initialProps: { kept, open },
    });

  it('keeps the text with its project and id while the sheet is open, until it is emptied', () => {
    const { rerender } = keep({ values: IDEA, projectKey: null, identity: null }, true);
    expect(sheetDraft(CAPTURE_DRAFT_ID)).toEqual({
      ...IDEA,
      projectKey: null,
      clientId: null,
      sent: null,
    });
    rerender({ kept: { values: IDEA, projectKey: 'MOB', identity: C1 }, open: true });
    expect(sheetDraft(CAPTURE_DRAFT_ID)).toEqual({
      ...IDEA,
      projectKey: 'MOB',
      clientId: 'c1',
      sent: FIRST,
    });
    rerender({
      kept: { values: { ...BLANK_CAPTURE, priority: 'high' }, projectKey: 'MOB', identity: C1 },
      open: true,
    });
    expect(sheetDraft(CAPTURE_DRAFT_ID)).toBeUndefined();
  });

  it('leaves the kept text alone while the sheet is closed', () => {
    keepSheetDraft(CAPTURE_DRAFT_ID, { ...IDEA, projectKey: null });
    keep({ values: BLANK_CAPTURE, projectKey: null, identity: null }, false);
    expect(sheetDraft(CAPTURE_DRAFT_ID)).toEqual({ ...IDEA, projectKey: null });
  });
});

describe('useCaptureId', () => {
  const capture = { values: { ...IDEA, title: ' Idea from the bus ' }, projectKey: null };

  it('makes an id at the first take, keeps it with the sent text at once and gives it every time', () => {
    const { result } = renderHook(() => useCaptureId(null, false));
    expect(result.current.identity).toBeNull();

    let first: CaptureIdentity | null = null;
    act(() => {
      // Nothing kept yet, as when Enter comes right after the last keystroke.
      first = result.current.take(capture);
      expect(sheetDraft(CAPTURE_DRAFT_ID)).toEqual({
        ...capture.values,
        projectKey: null,
        clientId: first.clientId,
        sent: IDEA,
      });
    });
    expect(first).toEqual({ clientId: expect.any(String), sent: IDEA });
    expect(result.current.identity).toBe(first);
    expect(result.current.take({ values: BLANK_CAPTURE, projectKey: null })).toBe(first);
  });

  it('gives the kept id and sent text of a capture whose Create had no answer', () => {
    const { result } = renderHook(() => useCaptureId(C1, false));
    expect(result.current.take(capture)).toBe(C1);
  });

  it('lets the id go once the capture is emptied, so what is typed next is a new capture', () => {
    const { result, rerender } = renderHook((props) => useCaptureId(C1, props.empty), {
      initialProps: { empty: false },
    });
    rerender({ empty: true });
    expect(result.current.identity).toBeNull();
    rerender({ empty: false });

    let next: CaptureIdentity | null = null;
    act(() => {
      next = result.current.take(capture);
    });
    expect(next).toEqual({ clientId: expect.any(String), sent: IDEA });
    expect(next).not.toEqual(expect.objectContaining({ clientId: 'c1' }));
  });
});
