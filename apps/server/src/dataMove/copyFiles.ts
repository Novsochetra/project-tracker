import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { attachmentKind, type AttachmentMimeType } from '@tracker/shared';
import { compressImage } from '../images/compressImage';
import type { AttachmentRow } from '../db/schema';
import type { FileStorage } from '../storage/fileStorage';
import { movedAttachmentRow, type CompressedFile, type MovedAttachment } from './movedAttachment';
import type { SourceFile } from './sourceFiles';

interface PreparedFile {
  moved: MovedAttachment;
  body: () => ReadableStream<Uint8Array>;
}

const streamOf = (path: string) =>
  Readable.toWeb(createReadStream(path)) as ReadableStream<Uint8Array>;

const unchanged = (row: AttachmentRow): MovedAttachment => ({
  before: row,
  after: movedAttachmentRow(row, null),
  compressed: false,
  refusal: null,
});

// The same work a new upload gets (images/compressImage), so only what it would store goes
// online: compressed, or stripped of its metadata, typed by its bytes rather than its old type.
async function prepareImage(file: SourceFile): Promise<PreparedFile> {
  const original = await readFile(file.path);
  const image = await compressImage(original, file.row.mimeType as AttachmentMimeType);
  const body = () => new Blob([image.bytes]).stream();
  if (image.refusal) return { moved: { ...unchanged(file.row), refusal: image.refusal }, body };
  const { mimeType, width, height } = image;
  const kept = mimeType === file.row.mimeType && Buffer.compare(original, image.bytes) === 0;
  if (kept) return { moved: unchanged(file.row), body };
  const compressed: CompressedFile = { mimeType, width, height, size: image.bytes.byteLength };
  const after = movedAttachmentRow(file.row, compressed);
  return { moved: { before: file.row, after, compressed: true, refusal: null }, body };
}

function prepareFile(file: SourceFile): Promise<PreparedFile> | PreparedFile {
  if (attachmentKind(file.row.mimeType) === 'image') return prepareImage(file);
  return { moved: unchanged(file.row), body: () => streamOf(file.path) };
}

// One file at a time, so memory holds at most one image (15 MB) and its compressed copy; videos
// stream from disk. Without storage (the check before a move, and a dry run) files are only read
// and compressed. An image that can't be stored is never written: the check before has refused
// the move, so meeting one here stops it before any row.
export async function copyFiles(
  files: readonly SourceFile[],
  storage: FileStorage | null,
  onCopied: (count: number) => void = () => {},
): Promise<MovedAttachment[]> {
  const moved: MovedAttachment[] = [];
  for (const file of files) {
    const prepared = await prepareFile(file);
    const { after, refusal } = prepared.moved;
    if (storage && refusal) throw new Error(`Attachment ${after.id} can't be stored: ${refusal}`);
    if (storage) await storage.write(after.storageKey, prepared.body());
    moved.push(prepared.moved);
    onCopied(moved.length);
  }
  return moved;
}
