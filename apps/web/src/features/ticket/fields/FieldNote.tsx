import { UnsavedNote, type NoteAction } from './UnsavedNote';
import type { FieldDraftState } from './useFieldDraft';

export interface FieldNoteProps {
  draft: FieldDraftState;
  // What isn't saved, as it starts a sentence: "Title".
  subject: string;
  id: string;
}

function conflictActions(draft: FieldDraftState, field: string): NoteAction[] {
  return [
    { label: 'Save mine', name: `Save my ${field}`, onClick: draft.saveMine },
    { label: 'Use theirs', name: `Use the saved ${field}`, onClick: draft.discardMine },
  ];
}

export function FieldNote({ draft, subject, id }: FieldNoteProps) {
  const field = subject.toLowerCase();
  if (draft.conflict) {
    return (
      <UnsavedNote
        id={id}
        message={`${subject} changed elsewhere while yours wasn't saved.`}
        actions={conflictActions(draft, field)}
      />
    );
  }
  if (!draft.failed) return null;
  const retry = { label: 'Retry', name: `Retry saving ${field}`, onClick: draft.retry };
  return <UnsavedNote id={id} message={`${subject} isn't saved yet.`} actions={[retry]} />;
}
