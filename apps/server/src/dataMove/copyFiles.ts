import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { attachmentKind, type AttachmentMimeType } from '@tracker/shared';
import { compressImage } from '../images/compressImage';
import type { FileStorage } from '../storage/fileStorage';
import { movedAttachmentRow, type CompressedFile, type MovedAttachment } from './movedAttachment';
import type { SourceFile } from './sourceFiles';

interface PreparedFile {
  moved: MovedAttachment;
  body: () => ReadableStream<Uint8Array>;
}

const streamOf = (path: string) =>
  Readable.toWeb(createReadStream(path)) as ReadableStream<Uint8Array>;

// The same compression a new upload gets (images/compressImage), so only the compressed copy goes
// online. An image it keeps as it came keeps its row as it is, whatever dimensions it reads.
async function prepareImage(file: SourceFile): Promise<PreparedFile> {
  const original = await readFile(file.path);
  const image = await compressImage(original, file.row.mimeType as AttachmentMimeType);
  const { mimeType, width, height } = image;
  const kept = mimeType === file.row.mimeType && Buffer.compare(original, image.bytes) === 0;
  const compressed: CompressedFile | null = kept
    ? null
    : { mimeType, width, height, size: image.bytes.byteLength };
  return {
    moved: {
      before: file.row,
      after: movedAttachmentRow(file.row, compressed),
      compressed: compressed !== null,
    },
    body: () => new Blob([image.bytes]).stream(),
  };
}

function prepareFile(file: SourceFile): Promise<PreparedFile> | PreparedFile {
  if (attachmentKind(file.row.mimeType) === 'image') return prepareImage(file);
  const moved = { before: file.row, after: movedAttachmentRow(file.row, null), compressed: false };
  return { moved, body: () => streamOf(file.path) };
}

// One file at a time, so memory holds at most one image (15 MB) and its compressed copy; videos
// stream from disk. Without storage (a dry run) files are only read and compressed.
export async function copyFiles(
  files: readonly SourceFile[],
  storage: FileStorage | null,
  onCopied: (count: number) => void = () => {},
): Promise<MovedAttachment[]> {
  const moved: MovedAttachment[] = [];
  for (const file of files) {
    const prepared = await prepareFile(file);
    if (storage) await storage.write(prepared.moved.after.storageKey, prepared.body());
    moved.push(prepared.moved);
    onCopied(moved.length);
  }
  return moved;
}
