import { labelsOf, type Label } from '@tracker/shared';
import type { NewTicketForm } from './newTicketForm';

// Apart from newTicketForm, which quick capture loads at start, so labels load with the sheet.

// Kept labels deleted since go, as a kept status does.
export function withoutGoneLabels(form: NewTicketForm, labels: readonly Label[]): NewTicketForm {
  const known = form.labelIds.filter((id) => labels.some((label) => label.id === id));
  return known.length === form.labelIds.length ? form : { ...form, labelIds: known };
}

// A label picked for a new ticket starts its description from the label's template, but only
// while the description is empty: typed text is never replaced.
export function withLabels(
  form: NewTicketForm,
  labelIds: string[],
  labels: readonly Label[],
): Partial<NewTicketForm> {
  const added = labelsOf(labels, labelIds).filter((label) => !form.labelIds.includes(label.id));
  const template = added.find((label) => label.template.trim())?.template;
  if (!template || form.description.trim()) return { labelIds };
  return { labelIds, description: template };
}
