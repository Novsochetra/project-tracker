import { sortStatuses, type CreateTicketInput, type Priority, type Status } from '@tracker/shared';

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

export const blankForm = (): NewTicketForm => ({
  title: '',
  description: '',
  statusId: null,
  priority: 'medium',
  assignee: '',
  due: '',
});

/** The group's status when opened from its "+", otherwise the first status. */
export function defaultStatusId(
  statuses: readonly Status[],
  requested: string | undefined,
): string | undefined {
  if (requested && statuses.some((status) => status.id === requested)) return requested;
  return sortStatuses(statuses)[0]?.id;
}

export function chosenStatusId(
  form: NewTicketForm,
  statuses: readonly Status[],
  requested: string | undefined,
): string | undefined {
  return form.statusId ?? defaultStatusId(statuses, requested);
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
