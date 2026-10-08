import type { Attachment } from '@tracker/shared';
import { isEntry, isList } from '../../lib/entries';

// A tile reads the file's id (what Remove sends), type (which kind of tile), name (a file tile
// splits it) and address. The file lists leave out an entry without them, so it can't fail the
// Ticket screen or a comment card, and the cache keeps it as it came.
function isReadableFile(entry: unknown): entry is Attachment {
  if (!isEntry(entry)) return false;
  const { id, mimeType, fileName, url } = entry as Record<string, unknown>;
  return [id, mimeType, fileName, url].every((value) => typeof value === 'string');
}

export const readableFiles = (files: readonly Attachment[] | null | undefined): Attachment[] =>
  isList(files) ? files.filter(isReadableFile) : [];

// A file is a comment's only when it names one, so a file the tracker sent without an activityId
// shows with the ticket's instead of nowhere.
export const ticketFiles = (files: readonly Attachment[] | null | undefined): Attachment[] =>
  readableFiles(files).filter((file) => typeof file.activityId !== 'string');
