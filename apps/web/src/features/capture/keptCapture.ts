import { useEffect, useState } from 'react';
import { forgetSheetDraft, keepSheetDraft, sheetDraft } from '../../lib/sheetDrafts';
import { formFromDraft } from '../project/newTicketForm';
import { CAPTURE_DRAFT_ID, hasContent, newCaptureId, type CaptureValues } from './captureForm';

export interface KeptCapture {
  values: CaptureValues;
  projectKey: string | null;
  clientId: string | null;
}

const textOrNull = (value: unknown): string | null => (typeof value === 'string' ? value : null);

// Each opening starts from the text kept from the last one, so it outlives a reload. The text
// fields are New ticket's, read from storage the same way.
export function keptCapture(): KeptCapture {
  const kept = sheetDraft(CAPTURE_DRAFT_ID);
  const { title, description, priority } = formFromDraft(kept);
  return {
    values: { title, description, priority },
    projectKey: textOrNull(kept?.projectKey),
    clientId: textOrNull(kept?.clientId),
  };
}

export const forgetKeptCapture = (): void => forgetSheetDraft(CAPTURE_DRAFT_ID);

// Only an open sheet with text writes: closing it forgets the text, but a reload or a crash
// closes nothing, so it is still there when quick capture opens again.
export function useKeepCapture({ values, projectKey, clientId }: KeptCapture, open: boolean): void {
  useEffect(() => {
    if (!open) return;
    if (hasContent(values, 0)) {
      keepSheetDraft(CAPTURE_DRAFT_ID, { ...values, projectKey, clientId });
    } else {
      forgetKeptCapture();
    }
  }, [values, projectKey, clientId, open]);
}

// Stored before the request goes out, since the tab can be stopped any moment after it.
function keepCaptureId(clientId: string): void {
  const kept = sheetDraft(CAPTURE_DRAFT_ID);
  if (kept) keepSheetDraft(CAPTURE_DRAFT_ID, { ...kept, clientId });
}

export interface CaptureId {
  clientId: string | null;
  take: () => string;
}

// A capture's first Create gives it an id that every later Create sends, until it is created or
// waits offline and the kept capture is forgotten. The tracker answers a repeat with the ticket
// the first request made, so Create after a lost answer, a reload or a crash makes no second one.
export function useCaptureId(kept: string | null): CaptureId {
  const [clientId, setClientId] = useState(kept);
  const take = () => {
    if (clientId) return clientId;
    const made = newCaptureId();
    keepCaptureId(made);
    setClientId(made);
    return made;
  };
  return { clientId, take };
}
