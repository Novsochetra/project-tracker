import type { Db } from '../db/schema';
import { invalidInput } from '../errors';
import { linkAttachments } from '../repositories/attachments';

export async function attachUploads(
  db: Db,
  ids: readonly string[],
  target: { ticketId: string; activityId: string | null },
): Promise<void> {
  const unique = [...new Set(ids)];
  const linked = await linkAttachments(db, unique, target);
  if (linked !== unique.length) {
    throw invalidInput('Some images could not be attached. Upload them again.');
  }
}
