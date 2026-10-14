export const NO_CHANGES_TITLE = 'No changes';
export const NO_CHANGES_TEXT = 'Claude changed no files in this run.';
export const APPROVED_TOAST = 'Approved the changes.';
export const ASKED_TOAST = 'Asked for changes. Claude gets your line comments on its next run.';

export const lineCommentsNote = (count: number): string =>
  count === 1
    ? '1 line comment goes to Claude on its next run.'
    : `${count} line comments go to Claude on its next run.`;
