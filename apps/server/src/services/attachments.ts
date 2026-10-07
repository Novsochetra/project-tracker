import { randomUUID } from 'node:crypto';
import { imageSize } from 'image-size';
import { MAX_ATTACHMENT_BYTES, type Attachment, type IMAGE_MIME_TYPES } from '@tracker/shared';
import type { AttachmentRow, Db } from '../db/schema';
import { invalidInput, notFound } from '../errors';
import {
  deleteAttachmentRows,
  findAttachmentById,
  insertAttachment,
  listPendingBefore,
} from '../repositories/attachments';
import { findTicketById, updateTicketRow } from '../repositories/tickets';
import { removeFiles, type FileStorage } from '../storage/fileStorage';
import { inTransaction, notify, type ServiceContext } from './context';
import { requireTicket, type TicketRef } from './lookups';
import { toAttachment } from './mappers';

export const TOO_LARGE_MESSAGE = 'Images can be up to 15 MB.';

export const PENDING_TTL_MS = 24 * 60 * 60 * 1000;

const EXTENSIONS: Record<(typeof IMAGE_MIME_TYPES)[number], string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
};

const isImageType = (type: string): type is keyof typeof EXTENSIONS => type in EXTENSIONS;

function dimensions(bytes: Uint8Array): { width: number | null; height: number | null } {
  try {
    const { width, height } = imageSize(bytes);
    return { width: width || null, height: height || null };
  } catch {
    return { width: null, height: null };
  }
}

export interface UploadInput {
  file: File;
  ticketKey?: string;
}

async function storeFile(ctx: ServiceContext, file: File, ref: TicketRef | null) {
  const mimeType = file.type.split(';')[0]?.trim().toLowerCase() ?? '';
  if (!isImageType(mimeType))
    throw invalidInput('Only PNG, JPEG, GIF, WebP and HEIC images can be attached.');
  if (file.size > MAX_ATTACHMENT_BYTES) throw invalidInput(TOO_LARGE_MESSAGE);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const id = randomUUID();
  const row: AttachmentRow = {
    id,
    ticketId: ref?.ticket.id ?? null,
    activityId: null,
    fileName: (file.name || 'image').slice(0, 200),
    mimeType,
    size: bytes.byteLength,
    ...dimensions(bytes),
    storageKey: `${id}.${EXTENSIONS[mimeType]}`,
    createdAt: ctx.now(),
  };
  await ctx.storage.write(row.storageKey, bytes);
  return row;
}

export async function uploadAttachment(
  ctx: ServiceContext,
  input: UploadInput,
): Promise<Attachment> {
  const ref = input.ticketKey ? await requireTicket(ctx.db, input.ticketKey) : null;
  const row = await storeFile(ctx, input.file, ref);
  try {
    await inTransaction(ctx, async (trx) => {
      await insertAttachment(trx, row);
      if (ref) await updateTicketRow(trx, ref.ticket.id, { updatedAt: row.createdAt });
    });
  } catch (error) {
    await ctx.storage.remove(row.storageKey);
    throw error;
  }
  // Pending images belong to no ticket yet, so no open screen needs to refresh.
  if (ref) notify(ctx, ref.project.id, ref.ticket.id);
  return toAttachment(row);
}

export async function openAttachment(ctx: ServiceContext, id: string) {
  const row = await findAttachmentById(ctx.db, id);
  const body = row ? await ctx.storage.read(row.storageKey) : null;
  if (!row || !body) throw notFound('Image was not found.');
  return { row, body };
}

export async function deleteAttachment(ctx: ServiceContext, id: string): Promise<void> {
  const removed = await inTransaction(ctx, async (trx) => {
    const found = await findAttachmentById(trx, id);
    if (!found) throw notFound('Image was not found.');
    const owner = found.ticketId ? await findTicketById(trx, found.ticketId) : undefined;
    await deleteAttachmentRows(trx, [id]);
    if (owner) await updateTicketRow(trx, owner.id, { updatedAt: ctx.now() });
    return { storageKey: found.storageKey, owner };
  });
  await ctx.storage.remove(removed.storageKey);
  if (removed.owner) notify(ctx, removed.owner.projectId, removed.owner.id);
}

export async function removeStalePendingAttachments(
  deps: { db: Db; storage: FileStorage },
  now: number,
): Promise<number> {
  const stale = await listPendingBefore(deps.db, now - PENDING_TTL_MS);
  await deleteAttachmentRows(
    deps.db,
    stale.map((row) => row.id),
  );
  await removeFiles(
    deps.storage,
    stale.map((row) => row.storageKey),
  );
  return stale.length;
}
