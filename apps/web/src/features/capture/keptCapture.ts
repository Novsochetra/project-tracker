import { useEffect } from 'react';
import { forgetSheetDraft, keepSheetDraft, sheetDraft } from '../../lib/sheetDrafts';
import { formFromDraft } from '../project/newTicketForm';
import { CAPTURE_DRAFT_ID, hasContent, type CaptureValues } from './captureForm';

export interface KeptCapture {
  values: CaptureValues;
  projectKey: string | null;
}

// Each opening starts from the text kept from the last one, so it outlives a reload. The text
// fields are New ticket's, read from storage the same way.
export function keptCapture(): KeptCapture {
  const kept = sheetDraft(CAPTURE_DRAFT_ID);
  const { title, description, priority } = formFromDraft(kept);
  const projectKey = typeof kept?.projectKey === 'string' ? kept.projectKey : null;
  return { values: { title, description, priority }, projectKey };
}

export const forgetKeptCapture = (): void => forgetSheetDraft(CAPTURE_DRAFT_ID);

// Only an open sheet with text writes: closing it forgets the text, but a reload or a crash
// closes nothing, so it is still there when quick capture opens again.
export function useKeepCapture({ values, projectKey }: KeptCapture, open: boolean): void {
  useEffect(() => {
    if (!open) return;
    if (hasContent(values, 0)) keepSheetDraft(CAPTURE_DRAFT_ID, { ...values, projectKey });
    else forgetKeptCapture();
  }, [values, projectKey, open]);
}
