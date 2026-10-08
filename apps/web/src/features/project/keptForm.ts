import { useEffect } from 'react';
import { forgetSheetDraft, keepSheetDraft, sheetDraft } from '../../lib/sheetDrafts';
import { formFromDraft, newTicketDraftId, type NewTicketForm } from './newTicketForm';

// Each opening starts from the fields kept for the project, so typed text outlives a reload.
export const keptForm = (projectKey: string): NewTicketForm =>
  formFromDraft(sheetDraft(newTicketDraftId(projectKey)));

export const forgetKeptForm = (projectKey: string): void =>
  forgetSheetDraft(newTicketDraftId(projectKey));

export interface KeepForm {
  projectKey: string;
  form: NewTicketForm;
  open: boolean;
  changed: boolean;
}

// Only an open sheet writes: closing it forgets the fields, but a reload or a crash closes
// nothing, so they are still there when New ticket opens again.
export function useKeepForm({ projectKey, form, open, changed }: KeepForm): void {
  useEffect(() => {
    if (!open) return;
    if (changed) keepSheetDraft(newTicketDraftId(projectKey), { ...form });
    else forgetKeptForm(projectKey);
  }, [projectKey, form, open, changed]);
}
