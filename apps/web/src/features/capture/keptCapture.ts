import { useEffect, useState } from 'react';
import {
  forgetSheetDraft,
  keepSheetDraft,
  sheetDraft,
  type SheetValues,
} from '../../lib/sheetDrafts';
import { formFromDraft } from '../project/newTicketForm';
import {
  CAPTURE_DRAFT_ID,
  captureTextOf,
  hasContent,
  newCaptureId,
  type CaptureValues,
} from './captureForm';
import { parseCaptureText, type CaptureText } from './captureText';

export interface CaptureIdentity {
  clientId: string;
  // The text the first Create sent with the id. Only what changes after it is saved to the ticket.
  sent: CaptureText;
}

export interface KeptCapture {
  values: CaptureValues;
  projectKey: string | null;
  identity: CaptureIdentity | null;
}

const textOrNull = (value: unknown): string | null => (typeof value === 'string' ? value : null);

// A capture kept before the sent text was kept too had its text kept just before its Create.
function identityOf(kept: SheetValues | undefined, values: CaptureValues): CaptureIdentity | null {
  const clientId = textOrNull(kept?.clientId);
  if (!clientId) return null;
  return { clientId, sent: parseCaptureText(kept?.sent) ?? captureTextOf(values) };
}

// Each opening starts from the text kept from the last one, so it outlives a reload. The text
// fields are New ticket's, read from storage the same way.
export function keptCapture(): KeptCapture {
  const kept = sheetDraft(CAPTURE_DRAFT_ID);
  const { title, description, priority } = formFromDraft(kept);
  const values = { title, description, priority };
  return {
    values,
    projectKey: textOrNull(kept?.projectKey),
    identity: identityOf(kept, values),
  };
}

export const forgetKeptCapture = (): void => forgetSheetDraft(CAPTURE_DRAFT_ID);

const keepCapture = ({ values, projectKey, identity }: KeptCapture): void =>
  keepSheetDraft(CAPTURE_DRAFT_ID, {
    ...values,
    projectKey,
    clientId: identity?.clientId ?? null,
    sent: identity?.sent ?? null,
  });

// Only an open sheet with text writes: closing it forgets the text, but a reload or a crash
// closes nothing, so it is still there when quick capture opens again.
export function useKeepCapture({ values, projectKey, identity }: KeptCapture, open: boolean): void {
  useEffect(() => {
    if (!open) return;
    if (hasContent(values, 0)) {
      keepCapture({ values, projectKey, identity });
    } else {
      forgetKeptCapture();
    }
  }, [values, projectKey, identity, open]);
}

export interface CaptureId {
  identity: CaptureIdentity | null;
  take: (capture: Omit<KeptCapture, 'identity'>) => CaptureIdentity;
}

// A capture's first Create gives it an id that every later Create sends, until it is created or
// waits offline and the kept capture is forgotten. The tracker answers a repeat with the ticket
// the first request made, so Create after a lost answer, a reload or a crash makes no second one.
// Emptied of text and files, the capture is over: what is typed next is a new one, with a new id.
export function useCaptureId(kept: CaptureIdentity | null, empty: boolean): CaptureId {
  const [identity, setIdentity] = useState(kept);
  if (empty && identity !== null) setIdentity(null);
  const take = (capture: Omit<KeptCapture, 'identity'>) => {
    if (identity) return identity;
    const made = { clientId: newCaptureId(), sent: captureTextOf(capture.values) };
    // Stored before the request goes out, since the tab can be stopped any moment after it.
    keepCapture({ ...capture, identity: made });
    setIdentity(made);
    return made;
  };
  return { identity, take };
}
