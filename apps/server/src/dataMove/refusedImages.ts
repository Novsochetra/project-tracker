import { formatBytes, formatTicketKey } from '@tracker/shared';
import type { AttachmentRow } from '../db/schema';
import type { MovedAttachment } from './movedAttachment';
import type { TableRows } from './rows';

// Where the user finds an attachment in the local tracker: its ticket's key, never its text.
export function placeOf(rows: TableRows): (row: AttachmentRow) => string {
  const keys = new Map(rows.projects.map((project) => [project.id, project.key]));
  const tickets = new Map(
    rows.tickets.map((ticket) => [
      ticket.id,
      formatTicketKey(keys.get(ticket.projectId) ?? '?', ticket.num),
    ]),
  );
  return (row) => {
    const key = row.ticketId ? tickets.get(row.ticketId) : undefined;
    if (!key) return 'not on a ticket yet';
    return row.activityId ? `a comment on ${key}` : key;
  };
}

// Stored as they are, these would go online with their metadata (a photo's location, the camera),
// which compressImage could not remove; the user decides, so the move names them and stops.
export function refusedImageProblems(
  moved: readonly MovedAttachment[],
  place: (row: AttachmentRow) => string,
): string[] {
  const refused = moved.filter((file) => file.refusal !== null);
  if (refused.length === 0) return [];
  return [
    `${refused.length} image(s) can't go online as they are: their metadata (such as where a ` +
      'photo was taken) can’t be removed. In the local tracker, delete each from the ticket or ' +
      'comment named below (and attach a copy saved again if you need it), then run the move ' +
      'again:',
    ...refused.map(
      ({ before, refusal }) =>
        `  - ${before.id} (${place(before)}, ${before.fileName}, ${formatBytes(before.size)}): ` +
        `${refusal}`,
    ),
  ];
}
