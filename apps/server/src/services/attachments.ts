import { randomUUID } from 'node:crypto';
import { imageSize } from 'image-size';
import {
  MAX_ATTACHMENT_BYTES,
  PENDING_ATTACHMENT_TTL_MS,
  checkAttachment,
  storedExtension,
  type Attachment,
  type AttachmentKind,
} from '@tracker/shared';
import type { AttachmentRow, Db } from '../db/schema';
import { invalidInput, notFound } from '../errors';
import {
  deleteAttachmentRows,
  findAttachmentById,
  insertAttachment,
  listPendingBefore,
} from '../repositories/attachments';
import { findTicketById, updateTicketRow } from '../repositories/tickets';
import { removeFiles, type ByteRange, type FileStorage } from '../storage/fileStorage';
import { inTransaction, notify, type ServiceContext } from './context';
import { requireTicket, type TicketRef } from './lookups';
import { toAttachment } from './mappers';

export const TOO_LARGE_MESSAGE = `Files can be up to ${MAX_ATTACHMENT_BYTES / (1024 * 1024)} MB.`;

const NOT_FOUND_MESSAGE = 'Attachment was not found.';

export const PENDING_TTL_MS = PENDING_ATTACHMENT_TTL_MS;

const MAX_NAME_LENGTH = 200;

interface Dimensions {
  width: number | null;
  height: number | null;
}

async function dimensions(file: Blob, kind: AttachmentKind): Promise<Dimensions> {
  if (kind !== 'image') return { width: null, height: null };
  try {
    const { width, height } = imageSize(new Uint8Array(await file.arrayBuffer()));
    return { width: width || null, height: height || null };
  } catch {
    return { width: null, height: null };
  }
}

// Cut by code points: half of a surrogate pair can't be encoded in a download header.
const fileNameOf = (file: File, extension: string): string =>
  Array.from(file.name.trim()).slice(0, MAX_NAME_LENGTH).join('') || `attachment.${extension}`;

export interface UploadInput {
  file: File;
  ticketKey?: string;
}

async function storeFile(ctx: ServiceContext, file: File, ref: TicketRef | null) {
  const check = checkAttachment(file);
  if (!check.ok) throw invalidInput(check.message);
  const id = randomUUID();
  const extension = storedExtension(check.mimeType);
  const row: AttachmentRow = {
    id,
    ticketId: ref?.ticket.id ?? null,
    activityId: null,
    fileName: fileNameOf(file, extension),
    mimeType: check.mimeType,
    size: file.size,
    ...(await dimensions(file, check.kind)),
    storageKey: `${id}.${extension}`,
    createdAt: ctx.now(),
  };
  await ctx.storage.write(row.storageKey, file);
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
  // Pending uploads belong to no ticket yet, so no open screen needs to refresh.
  if (ref) notify(ctx, ref.project.id, ref.ticket.id);
  return toAttachment(row);
}

export async function requireAttachment(ctx: ServiceContext, id: string): Promise<AttachmentRow> {
  const row = await findAttachmentById(ctx.db, id);
  if (!row) throw notFound(NOT_FOUND_MESSAGE);
  return row;
}

export async function readAttachmentFile(
  ctx: ServiceContext,
  row: AttachmentRow,
  range?: ByteRange,
): Promise<ReadableStream<Uint8Array>> {
  const body = await ctx.storage.read(row.storageKey, range);
  if (!body) throw notFound(NOT_FOUND_MESSAGE);
  return body;
}

export async function deleteAttachment(ctx: ServiceContext, id: string): Promise<void> {
  const removed = await inTransaction(ctx, async (trx) => {
    const found = await findAttachmentById(trx, id);
    if (!found) throw notFound(NOT_FOUND_MESSAGE);
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
