import { TICKET_DESCRIPTION_MAX, type CreateTicketInput, type Priority } from '@tracker/shared';
import type { QueuedCapture } from './captureQueue';
import type { CaptureText } from './captureText';
import { clipTitle } from './clipTitle';

export interface CaptureValues {
  title: string;
  description: string;
  priority: Priority;
}

export const BLANK_CAPTURE: CaptureValues = { title: '', description: '', priority: 'medium' };

export const CAPTURE_DRAFT_ID = 'capture';
// Long enough for a slow but working connection; after it the capture waits on the phone.
export const CAPTURE_TIMEOUT_MS = 8_000;
// Toasts can wrap, but a short one is read at a glance: clipped to this width it fits one line
// at 375px.
const DROPPED_TITLE_WIDTH = 24;

export const DESCRIPTION_MAX_LENGTH = TICKET_DESCRIPTION_MAX;

export const TITLE_REQUIRED = 'Add a title to create the ticket.';
export const NO_PROJECTS = 'Create a project first.';
export const FILES_NEED_CONNECTION =
  "Files need a connection. Try again once you're online, or remove them to save the text on this phone.";
export const SAVED_ON_PHONE = "Saved offline. It'll sync later.";
export const textNotSaved = (ticketKey: string): string =>
  `${ticketKey} was created with your earlier text, and this text couldn't be saved to it. Try again.`;

export const createdToast = (ticketKey: string): string => `${ticketKey} created`;

export const earlierTextToast = (ticketKey: string): string =>
  `${ticketKey} created with your earlier text`;

export const addedToast = (count: number): string =>
  `${count} ${count === 1 ? 'ticket' : 'tickets'} added`;

export const droppedToast = (title: string): string =>
  `Couldn't add “${clipTitle(title, DROPPED_TITLE_WIDTH)}”`;

export const hasContent = (values: CaptureValues, fileCount: number): boolean =>
  values.title.trim() !== '' || values.description.trim() !== '' || fileCount > 0;

export const captureTextOf = (values: CaptureValues): CaptureText => ({
  title: values.title.trim(),
  description: values.description.trim(),
  priority: values.priority,
});

export interface NewCapture {
  id: string;
  projectKey: string;
  values: CaptureValues;
  capturedAt: number;
  sent: CaptureText;
}

export const toQueuedCapture = ({
  id,
  projectKey,
  values,
  capturedAt,
  sent,
}: NewCapture): QueuedCapture => ({
  id,
  projectKey,
  ...captureTextOf(values),
  capturedAt,
  sent,
});

// No statusId: the server puts a new ticket in the project's first status. Every request for a
// capture carries its id, so the tracker makes one ticket of it however often it is sent.
export const createInputOf = (
  capture: Pick<QueuedCapture, 'id' | 'title' | 'description' | 'priority'>,
  attachmentIds: readonly string[] = [],
): CreateTicketInput => ({
  title: capture.title,
  description: capture.description,
  priority: capture.priority,
  ...(attachmentIds.length > 0 ? { attachmentIds: [...attachmentIds] } : {}),
  clientId: capture.id,
});

const hex = (byte: number): string => byte.toString(16).padStart(2, '0');

// randomUUID needs a secure context, which a phone reaching the dev server over plain http lacks.
export function newCaptureId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), hex).join('');
}
