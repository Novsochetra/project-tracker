import { ApiError } from '@tracker/client';
import type { Ticket, UpdateTicketInput } from '@tracker/shared';
import { isNetworkError } from '../../api';
import { textNotSaved } from './captureForm';

type CaptureText = Pick<Ticket, 'title' | 'description' | 'priority'>;

export interface CaptureSteps {
  create: () => Promise<Ticket>;
  update: (ticketKey: string, input: UpdateTicketInput) => Promise<Ticket>;
}

// What the capture says and its ticket doesn't. The answer to a repeated client id is the ticket
// the first create made, so it has the text of that create, not what the person changed since.
export function laterText(ticket: CaptureText, capture: CaptureText): UpdateTicketInput | null {
  const changes: UpdateTicketInput = {};
  if (capture.title !== ticket.title) changes.title = capture.title;
  if (capture.description !== ticket.description) changes.description = capture.description;
  if (capture.priority !== ticket.priority) changes.priority = capture.priority;
  return Object.keys(changes).length > 0 ? changes : null;
}

// The tracker's own words would be about an edit the person never asked for. A network failure
// stays as it is, so a text-only capture still waits offline and its sync saves the text later.
function plainly(error: unknown, ticketKey: string): unknown {
  if (!(error instanceof ApiError) || isNetworkError(error)) return error;
  return new ApiError(error.status, error.code, textNotSaved(ticketKey));
}

// The person's latest text wins and the capture stays one ticket: when a create gets back the
// ticket an earlier Create made, the text changed since is saved to it as an ordinary edit.
export async function sendCapture(capture: CaptureText, steps: CaptureSteps): Promise<Ticket> {
  const ticket = await steps.create();
  const changes = laterText(ticket, capture);
  if (!changes) return ticket;
  try {
    return await steps.update(ticket.key, changes);
  } catch (error) {
    throw plainly(error, ticket.key);
  }
}
