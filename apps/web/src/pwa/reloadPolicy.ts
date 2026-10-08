import { hasDrafts } from '../lib/drafts';
import { isEditable } from '../lib/editable';
import { hasPendingWrites } from '../lib/pendingWrites';

const OPEN_DIALOG = '[role="dialog"], [role="alertdialog"], dialog[open]';

// A hidden page waits too: phones hide the app mid-task, and sheets keep their text nowhere else.
export function isSafeToReload(doc: Document): boolean {
  return (
    !isEditable(doc.activeElement) &&
    doc.querySelector(OPEN_DIALOG) === null &&
    !hasDrafts() &&
    !hasPendingWrites()
  );
}
