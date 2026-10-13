import { UsageParts } from '../claude/UsageParts';
import type { UsageNote } from './projectOptions';

export function UsageNoteText({ note }: { note: UsageNote }) {
  return (
    <>
      {note.label} <UsageParts parts={note.parts} />
    </>
  );
}
