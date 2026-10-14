import type { DiffFileStatus } from '@tracker/shared';

export const viewedLabel = (count: number, total: number): string => `${count} of ${total} viewed`;

export const STATUS_WORDS: Record<DiffFileStatus, string | null> = {
  added: 'New',
  deleted: 'Deleted',
  renamed: 'Renamed',
  modified: null,
};

export const BINARY_NOTE = "A binary file: its change can't be shown.";
export const NO_LINES_NOTE = 'No lines changed.';
export const CUT_NOTE = 'This change is too large to show whole, so its last files are left out.';
