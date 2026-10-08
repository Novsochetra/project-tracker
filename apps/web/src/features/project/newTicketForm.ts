import {
  createTicketInput,
  PRIORITIES,
  sortStatuses,
  type CreateTicketInput,
  type Priority,
  type Status,
} from '@tracker/shared';

export interface NewTicketForm {
  title: string;
  description: string;
  /** Null until the person picks one, so the sheet's default status applies. */
  statusId: string | null;
  priority: Priority;
  assignee: string;
  due: string;
}

export const TITLE_REQUIRED = 'Add a title to create the ticket.';
// The API's limit, so an overlong paste is cut short in the field instead of failing to create.
export const TITLE_MAX_LENGTH = createTicketInput.shape.title.maxLength ?? undefined;

export const blankForm = (): NewTicketForm => ({
  title: '',
  description: '',
  statusId: null,
  priority: 'medium',
  assignee: '',
  due: '',
});

export const newTicketDraftId = (projectKey: string): string => `new-ticket:${projectKey}`;

const textOf = (value: unknown): string => (typeof value === 'string' ? value : '');

const isPriority = (value: unknown): value is Priority =>
  typeof value === 'string' && (PRIORITIES as readonly string[]).includes(value);

// Kept fields come from storage, which an older build or another tab may have written.
export function formFromDraft(
  values: Readonly<Record<string, unknown>> | undefined,
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
  };
}

const hasText = (value: string): boolean => value.trim() !== '';

export function hasChanges(form: NewTicketForm, defaultStatus: string | undefined): boolean {
  const blank = blankForm();
  if (hasText(form.title) || hasText(form.description) || hasText(form.assignee)) return true;
  const statusPicked = form.statusId !== null && form.statusId !== defaultStatus;
  return statusPicked || form.priority !== blank.priority || form.due !== blank.due;
}

/** The group's status when opened from its "+", otherwise the first status. */
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
  };
}
