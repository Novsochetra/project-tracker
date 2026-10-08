import type { Db } from '../db/schema';
import { invalidInput } from '../errors';
import {
  existingAttachmentIds,
  linkAttachments,
  listTicketAttachments,
  nextTicketPosition,
} from '../repositories/attachments';

interface LinkTarget {
  ticketId: string;
  activityId: string | null;
}

export async function attachUploads(
  db: Db,
  ids: readonly string[],
  target: LinkTarget,
  firstPosition = 0,
): Promise<void> {
  const unique = [...new Set(ids)];
  const linked = await linkAttachments(db, unique, target, firstPosition);
  if (linked !== unique.length) {
    throw invalidInput('Some files could not be attached. Upload them again.');
  }
}

// A repeated create may name files chosen after the first one, when its answer was lost; they go
// after the ticket's other files, as a file uploaded to it later would. It also names the files the
// first one attached, and one removed from the ticket since is gone: a file that is gone is left
// out instead of refusing the rest. One that can't be attached otherwise (on another ticket or a
// comment) refuses the repeat, as it would a create.
export async function attachLaterUploads(
  db: Db,
  ticketId: string,
  ids: readonly string[],
): Promise<boolean> {
  const own = await listTicketAttachments(db, ticketId);
  const attached = new Set(own.filter((row) => row.activityId === null).map((row) => row.id));
  const existing = await existingAttachmentIds(db, ids);
  const later = ids.filter((id) => existing.has(id) && !attached.has(id));
  if (later.length === 0) return false;
  const target = { ticketId, activityId: null };
  await attachUploads(db, later, target, await nextTicketPosition(db, ticketId));
  return true;
}
