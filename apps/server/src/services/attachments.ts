import { randomUUID } from 'node:crypto';
import { imageSize } from 'image-size';
import {
  ATTACHMENT_KINDS,
  PENDING_ATTACHMENT_TTL_MS,
  checkAttachment,
  storedExtension,
  tooLargeMessage,
  type Attachment,
  type AttachmentKind,
  type AttachmentMimeType,
} from '@tracker/shared';
import type { AttachmentRow, Db } from '../db/schema';
import { invalidInput, notFound } from '../errors';
import {
  deleteAttachmentRows,
  findAttachmentById,
  insertAttachment,
  listPendingBefore,
  nextTicketPosition,
} from '../repositories/attachments';
import { findTicketById, updateTicketRow } from '../repositories/tickets';
import { removeFiles, type ByteRange, type FileStorage } from '../storage/fileStorage';
import { inTransaction, notify, type ServiceContext } from './context';
import { requireTicket, type TicketRef } from './lookups';
import { toAttachment } from './mappers';
import { IMAGE_HEAD_BYTES, measureUpload } from './uploadStream';

const NOT_FOUND_MESSAGE = 'Attachment was not found.';

const INCOMPLETE_MESSAGE = 'The file did not arrive whole. Try again.';

// Pages from before uploads were sent as the file itself still post forms until they reload.
const FORM_MESSAGE = 'Reload the page and add the file again.';

export const PENDING_TTL_MS = PENDING_ATTACHMENT_TTL_MS;

const MAX_NAME_LENGTH = 200;

interface Dimensions {
  width: number | null;
  height: number | null;
}

function dimensions(head: Uint8Array, kind: AttachmentKind): Dimensions {
  if (kind !== 'image') return { width: null, height: null };
  try {
    const { width, height } = imageSize(head);
    return { width: width || null, height: height || null };
  } catch {
    return { width: null, height: null };
  }
}

const TABS_AND_LINE_BREAKS = /[\t\n\v\f\r]+/g;

// Postgres refuses a NUL in text, and no control character (C0, DEL or C1) means anything in a
// name.
const CONTROL_CHARACTERS = /\p{Cc}/gu;

// A tab or line break becomes a space so the words around it stay apart. Cut by code points: half
// of a surrogate pair can't be encoded in a download header.
function fileNameOf(name: string, extension: string): string {
  const plain = name.replace(TABS_AND_LINE_BREAKS, ' ').replace(CONTROL_CHARACTERS, '').trim();
  return Array.from(plain).slice(0, MAX_NAME_LENGTH).join('') || `attachment.${extension}`;
}

export interface UploadInput {
  body: ReadableStream<Uint8Array> | null;
  name: string;
  type: string;
  size: number | null;
  ticketKey?: string | undefined;
}

interface CheckedUpload {
  mimeType: AttachmentMimeType;
  kind: AttachmentKind;
}

type StoredFile = Omit<AttachmentRow, 'ticketId' | 'activityId' | 'position' | 'createdAt'>;

function checkUpload(input: UploadInput): CheckedUpload {
  if (input.type.toLowerCase().startsWith('multipart/form-data')) throw invalidInput(FORM_MESSAGE);
  const check = checkAttachment({ type: input.type, name: input.name, size: input.size ?? 0 });
  if (!check.ok) throw invalidInput(check.message);
  return check;
}

async function storeFile(
  ctx: ServiceContext,
  input: UploadInput,
  { mimeType, kind }: CheckedUpload,
): Promise<StoredFile> {
  const id = randomUUID();
  const extension = storedExtension(mimeType);
  const storageKey = `${id}.${extension}`;
  const upload = measureUpload(input.body ?? new Blob([]).stream(), {
    maxBytes: ATTACHMENT_KINDS[kind].maxBytes,
    expectedBytes: input.size,
    headBytes: kind === 'image' ? IMAGE_HEAD_BYTES : 0,
    tooLarge: () => invalidInput(tooLargeMessage(kind)),
    incomplete: () => invalidInput(INCOMPLETE_MESSAGE),
  });
  await ctx.storage.write(storageKey, upload.body);
  return {
    id,
    fileName: fileNameOf(input.name, extension),
    mimeType,
    size: upload.size(),
    ...dimensions(upload.head(), kind),
    storageKey,
  };
}

async function insertUploaded(
  ctx: ServiceContext,
  file: StoredFile,
  ref: TicketRef | null,
): Promise<AttachmentRow> {
  return inTransaction(ctx, async (trx) => {
    const row: AttachmentRow = {
      ...file,
      ticketId: ref?.ticket.id ?? null,
      activityId: null,
      position: ref ? await nextTicketPosition(trx, ref.ticket.id) : 0,
      createdAt: ctx.now(),
    };
    await insertAttachment(trx, row);
    if (ref) await updateTicketRow(trx, ref.ticket.id, { updatedAt: row.createdAt });
    return row;
  });
}

// Streamed rather than read whole first: reading a 95 MB video whole took the server from 76 MB
// to 660 MB.
export async function uploadAttachment(
  ctx: ServiceContext,
  input: UploadInput,
): Promise<Attachment> {
  const check = checkUpload(input);
  const ref = input.ticketKey ? await requireTicket(ctx.db, input.ticketKey) : null;
  const file = await storeFile(ctx, input, check);
  let row: AttachmentRow;
  try {
    row = await insertUploaded(ctx, file, ref);
  } catch (error) {
    await ctx.storage.remove(file.storageKey);
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
