import type { UserScope } from '../auth/scope';
import type { Db } from '../db/schema';
import { invalidInput } from '../errors';
import {
  reachableAttachmentIds,
  linkAttachments,
  listTicketAttachments,
  nextTicketPosition,
} from '../repositories/attachments';

// The uploader is whose files on no ticket yet may be attached.
export interface LinkTarget {
  ticketId: string;
  activityId: string | null;
  uploader: UserScope;
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

export interface LaterUploads {
  attached: boolean;
  // Named files that are gone, in the order named.
  leftOut: string[];
}

// A repeated create may name files chosen after the first one, when its answer was lost; they go
// after the ticket's other files, as a file uploaded to it later would. It also names the files the
// first one attached, and one removed from the ticket since is gone, as is a later upload that
// expired: a file that is gone is left out instead of refusing the rest, and the answer says so.
// One that can't be attached otherwise (on another ticket or a comment) refuses the repeat, as it
// would a create.
export async function attachLaterUploads(
  db: Db,
  { ticketId, uploader }: Pick<LinkTarget, 'ticketId' | 'uploader'>,
  ids: readonly string[],
): Promise<LaterUploads> {
  const own = await listTicketAttachments(db, ticketId);
  const attached = new Set(own.filter((row) => row.activityId === null).map((row) => row.id));
  const named = [...new Set(ids)];
  const existing = await reachableAttachmentIds(db, named, uploader);
  const leftOut = named.filter((id) => !existing.has(id));
  const later = named.filter((id) => existing.has(id) && !attached.has(id));
  if (later.length === 0) return { attached: false, leftOut };
  const target = { ticketId, activityId: null, uploader };
  await attachUploads(db, later, target, await nextTicketPosition(db, ticketId));
  return { attached: true, leftOut };
}
