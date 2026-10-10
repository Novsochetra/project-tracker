import { randomUUID } from 'node:crypto';
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
import { compressImage } from '../images/compressImage';
import { renamedFor } from '../images/imageFileName';
import {
  deleteAttachmentRows,
  findAttachmentById,
  finishAttachmentRow,
  insertAttachment,
  listPendingBefore,
  nextTicketPosition,
} from '../repositories/attachments';
import { findTicketById, updateTicketRow } from '../repositories/tickets';
import { removeFiles, type ByteRange, type FileStorage } from '../storage/fileStorage';
import { inTransaction, notify, type ServiceContext } from './context';
import { requireTicket, type TicketRef } from './lookups';
import { toAttachment } from './mappers';
import { measureUpload, readWhole, type MeasuredUpload } from './uploadStream';

const NOT_FOUND_MESSAGE = 'Attachment was not found.';

const INCOMPLETE_MESSAGE = 'The file did not arrive whole. Try again.';

// Pages from before uploads were sent as the file itself still post forms until they reload.
const FORM_MESSAGE = 'Reload the page and add the file again.';

export const PENDING_TTL_MS = PENDING_ATTACHMENT_TTL_MS;

const MAX_NAME_LENGTH = 200;

const NAME_EXTENSION = /\.[^.\s]{1,10}$/u;

const TABS_AND_LINE_BREAKS = /[\t\n\v\f\r]+/g;

// Postgres refuses a NUL in text, and no control character (C0, DEL or C1) means anything in a
// name.
const CONTROL_CHARACTERS = /\p{Cc}/gu;

// A tab or line break becomes a space so the words around it stay apart. Cut by code points: half
// of a surrogate pair can't be encoded in a download header.
export function fileNameOf(name: string, extension: string): string {
  const plain = name.replace(TABS_AND_LINE_BREAKS, ' ').replace(CONTROL_CHARACTERS, '').trim();
  const characters = Array.from(plain);
  if (characters.length <= MAX_NAME_LENGTH) return plain || `attachment.${extension}`;
  // The extension is what opens the file, so a long name loses the end of its stem instead.
  const ending = Array.from(NAME_EXTENSION.exec(plain)?.[0] ?? '');
  return characters.slice(0, MAX_NAME_LENGTH - ending.length).join('') + ending.join('');
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

// What is stored: the upload as it streams in, or, for an image, what compressImage made of it.
interface UploadContent {
  storageKey: string;
  mimeType: AttachmentMimeType;
  width: number | null;
  height: number | null;
  body: ReadableStream<Uint8Array>;
  size: () => number;
}

function checkUpload(input: UploadInput): CheckedUpload {
  if (input.type.toLowerCase().startsWith('multipart/form-data')) throw invalidInput(FORM_MESSAGE);
  const check = checkAttachment({ type: input.type, name: input.name, size: input.size ?? 0 });
  if (!check.ok) throw invalidInput(check.message);
  return check;
}

// Images are read whole (up to their 15 MB) to be turned upright, stripped of their metadata and
// made smaller, and only what comes out is stored (images/compressImage).
async function contentOf(
  id: string,
  upload: MeasuredUpload,
  { mimeType, kind }: CheckedUpload,
): Promise<UploadContent> {
  if (kind !== 'image') {
    const storageKey = `${id}.${storedExtension(mimeType)}`;
    return {
      storageKey,
      mimeType,
      width: null,
      height: null,
      body: upload.body,
      size: upload.size,
    };
  }
  const image = await compressImage(await readWhole(upload.body), mimeType);
  if (image.refusal) throw invalidInput(image.refusal);
  return {
    storageKey: `${id}.${storedExtension(image.mimeType)}`,
    mimeType: image.mimeType,
    width: image.width,
    height: image.height,
    body: new Blob([image.bytes]).stream(),
    size: () => image.bytes.byteLength,
  };
}

function pendingRow(ctx: ServiceContext, id: string, fileName: string, content: UploadContent) {
  const { storageKey, mimeType, width, height } = content;
  return {
    id,
    fileName,
    mimeType,
    size: 0,
    width,
    height,
    storageKey,
    ticketId: null,
    activityId: null,
    position: 0,
    createdAt: ctx.now(),
  } satisfies AttachmentRow;
}

async function finishUpload(
  ctx: ServiceContext,
  row: AttachmentRow,
  size: number,
  ref: TicketRef | null,
): Promise<AttachmentRow> {
  return inTransaction(ctx, async (trx) => {
    const done = {
      size,
      ticketId: ref?.ticket.id ?? null,
      position: ref ? await nextTicketPosition(trx, ref.ticket.id) : 0,
    };
    await finishAttachmentRow(trx, row.id, done);
    if (ref) await updateTicketRow(trx, ref.ticket.id, { updatedAt: ctx.now() });
    return { ...row, ...done };
  });
}

// The row goes in before the file, as a pending upload: if the file is cut off or the server
// stops half way, the pending clean-up (removeStalePendingAttachments) finds the key in this
// database and removes both. No file is ever stored without a row naming it, so nothing has to
// guess from a listing which files are whose (PT-133).
async function storeUpload(
  ctx: ServiceContext,
  row: AttachmentRow,
  content: UploadContent,
  ref: TicketRef | null,
): Promise<AttachmentRow> {
  await insertAttachment(ctx.db, row);
  try {
    await ctx.storage.write(row.storageKey, content.body);
    return await finishUpload(ctx, row, content.size(), ref);
  } catch (error) {
    await deleteAttachmentRows(ctx.db, [row.id]).catch(() => undefined);
    await removeFiles(ctx.storage, [row.storageKey]);
    throw error;
  }
}

// Streamed rather than read whole first: reading a 95 MB video whole took the server from 76 MB
// to 660 MB.
export async function uploadAttachment(
  ctx: ServiceContext,
  input: UploadInput,
): Promise<Attachment> {
  const check = checkUpload(input);
  const ref = input.ticketKey ? await requireTicket(ctx.db, input.ticketKey) : null;
  const id = randomUUID();
  const upload = measureUpload(input.body ?? new Blob([]).stream(), {
    maxBytes: ATTACHMENT_KINDS[check.kind].maxBytes,
    expectedBytes: input.size,
    tooLarge: () => invalidInput(tooLargeMessage(check.kind)),
    incomplete: () => invalidInput(INCOMPLETE_MESSAGE),
  });
  const content = await contentOf(id, upload, check);
  const name = renamedFor(input.name, check.mimeType, content.mimeType);
  const fileName = fileNameOf(name, storedExtension(content.mimeType));
  const row = await storeUpload(ctx, pendingRow(ctx, id, fileName, content), content, ref);
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

// For HEAD: asks storage whether the file is there without opening it, which on S3 would start a
// download only to drop it.
export async function requireAttachmentFile(
  ctx: ServiceContext,
  row: AttachmentRow,
): Promise<void> {
  if (!(await ctx.storage.stat(row.storageKey))) throw notFound(NOT_FOUND_MESSAGE);
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
  await removeFiles(ctx.storage, [removed.storageKey]);
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
