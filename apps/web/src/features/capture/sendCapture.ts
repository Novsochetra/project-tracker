import { ApiError } from '@tracker/client';
import type { CreatedTicket, Ticket, UpdateTicketInput } from '@tracker/shared';
import { isNetworkError } from '../../api';
import { textNotSaved } from './captureForm';
import type { CaptureText } from './captureText';

export interface SentCapture extends CaptureText {
  // The text the capture's first create sent; missing when nothing changed since.
  sent?: CaptureText;
}

export interface CaptureSteps {
  create: () => Promise<CreatedTicket>;
  update: (ticketKey: string, input: UpdateTicketInput) => Promise<Ticket>;
}

// The ticket exists, with the text of an earlier create; only the person's later text is missing.
export class TextNotSavedError extends ApiError {
  readonly ticketKey: string;

  constructor(error: ApiError, ticketKey: string) {
    super(error.status, error.code, textNotSaved(ticketKey));
    this.name = 'TextNotSavedError';
    this.ticketKey = ticketKey;
  }
}

// What the person changed since the capture's first create and the ticket doesn't say yet. The
// answer to a repeated client id is the ticket as it is now: a field the person left alone may
// hold someone else's later edit, and that edit stays.
export function laterText(ticket: CaptureText, capture: SentCapture): UpdateTicketInput | null {
  const sent = capture.sent ?? capture;
  const changed = (field: keyof CaptureText) =>
    capture[field] !== sent[field] && capture[field] !== ticket[field];
  const changes: UpdateTicketInput = {};
  if (changed('title')) changes.title = capture.title;
  if (changed('description')) changes.description = capture.description;
  if (changed('priority')) changes.priority = capture.priority;
  return Object.keys(changes).length > 0 ? changes : null;
}

// The tracker's own words would be about an edit the person never asked for. A network failure
// stays as it is, so a text-only capture still waits offline and its sync saves the text later.
function plainly(error: unknown, ticketKey: string): unknown {
  if (!(error instanceof ApiError) || isNetworkError(error)) return error;
  return new TextNotSavedError(error, ticketKey);
}

// The capture stays one ticket and the person's later text wins: when a create gets back the
// ticket an earlier Create made, what the person changed since is saved to it as an ordinary edit.
export async function sendCapture(
  capture: SentCapture,
  steps: CaptureSteps,
): Promise<CreatedTicket> {
  const ticket = await steps.create();
  const changes = laterText(ticket, capture);
  if (!changes) return ticket;
  try {
    const updated = await steps.update(ticket.key, changes);
    // The files the create left out are still to be told.
    const { leftOutAttachmentIds } = ticket;
    return leftOutAttachmentIds ? { ...updated, leftOutAttachmentIds } : updated;
  } catch (error) {
    throw plainly(error, ticket.key);
  }
}
