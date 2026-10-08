import {
  isPriority,
  sortStatuses,
  TICKET_TITLE_MAX,
  type Attachment,
  type CreateTicketInput,
  type Priority,
  type Status,
} from '@tracker/shared';
import { keptAttachments } from './keptAttachments';

export interface NewTicketForm {
  title: string;
  description: string;
  // Null until the person picks one, so the sheet's default status applies.
  statusId: string | null;
  priority: Priority;
  assignee: string;
  due: string;
  attachments: Attachment[];
}

export const TITLE_REQUIRED = 'Add a title to create the ticket.';
// The API's limit, so an overlong paste is cut short in the field instead of failing to create.
export const TITLE_MAX_LENGTH = TICKET_TITLE_MAX;

export const blankForm = (): NewTicketForm => ({
  title: '',
  description: '',
  statusId: null,
  priority: 'medium',
  assignee: '',
  due: '',
  attachments: [],
});

export const newTicketDraftId = (projectKey: string): string => `new-ticket:${projectKey}`;

const textOf = (value: unknown): string => (typeof value === 'string' ? value : '');

// Kept fields come from storage, which an older build or another tab may have written.
export function formFromDraft(
  values: Readonly<Record<string, unknown>> | undefined,
  now: number = Date.now(),
): NewTicketForm {
  const blank = blankForm();
  if (!values) return blank;
  return {
    title: textOf(values.title),
    description: textOf(values.description),
    statusId: typeof values.statusId === 'string' ? values.statusId : blank.statusId,
    priority: isPriority(values.priority) ? values.priority : blank.priority,
    assignee: textOf(values.assignee),
    due: textOf(values.due),
    attachments: keptAttachments(values.attachments, now),
  };
}

const hasText = (value: string): boolean => value.trim() !== '';

export function hasChanges(form: NewTicketForm, defaultStatus: string | undefined): boolean {
  const blank = blankForm();
  if (hasText(form.title) || hasText(form.description) || hasText(form.assignee)) return true;
  if (form.attachments.length > 0) return true;
  const statusPicked = form.statusId !== null && form.statusId !== defaultStatus;
  return statusPicked || form.priority !== blank.priority || form.due !== blank.due;
}

export function defaultStatusId(
  statuses: readonly Status[],
  requested: string | undefined,
): string | undefined {
  if (requested && statuses.some((status) => status.id === requested)) return requested;
  return sortStatuses(statuses)[0]?.id;
}

// A kept draft can name a status that was deleted since.
export function chosenStatusId(
  form: NewTicketForm,
  statuses: readonly Status[],
  requested: string | undefined,
): string | undefined {
  const picked = form.statusId;
  if (picked !== null && statuses.some((status) => status.id === picked)) return picked;
  return defaultStatusId(statuses, requested);
}

// Once the statuses are known, a kept one deleted since goes: the sheet shows the default status
// then, and an untouched-looking sheet must not count as changed.
export function withoutGoneStatus(form: NewTicketForm, statuses: readonly Status[]): NewTicketForm {
  const { statusId } = form;
  if (statusId === null || statuses.some((status) => status.id === statusId)) return form;
  return { ...form, statusId: null };
}

export function toCreateInput(
  form: NewTicketForm,
  statusId: string | undefined,
): CreateTicketInput {
  return {
    title: form.title.trim(),
    description: form.description.trim(),
    priority: form.priority,
    assignee: form.assignee.trim(),
    due: form.due,
    ...(statusId ? { statusId } : {}),
    ...(form.attachments.length > 0
      ? { attachmentIds: form.attachments.map((attachment) => attachment.id) }
      : {}),
  };
}
