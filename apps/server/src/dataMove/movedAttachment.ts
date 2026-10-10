import { storedExtension, type AttachmentMimeType } from '@tracker/shared';
import type { AttachmentRow } from '../db/schema';
import { renamedFor } from '../images/imageFileName';
import { storableDimension } from '../repositories/attachments';
import { fileNameOf } from '../services/attachments';

export interface CompressedFile {
  mimeType: AttachmentMimeType;
  size: number;
  width: number | null;
  height: number | null;
}

export interface MovedAttachment {
  before: AttachmentRow;
  after: AttachmentRow;
  // Stored as other bytes than the source's: compressed, or kept without its metadata.
  compressed: boolean;
  // Why the image can't be stored at all (compressImage's refusal: a TIFF, or one cut off before
  // its picture, whose metadata can't be removed); null for every other file.
  refusal: string | null;
}

// The id stays, so links to the file (/api/attachments/<id>/file) and its place among its ticket's
// or comment's files stay too. A compressed image takes the stored file's type, size, key and name,
// as a new upload does ("IMG_0042.JPG" becomes "IMG_0042.webp").
export function movedAttachmentRow(
  row: AttachmentRow,
  compressed: CompressedFile | null,
): AttachmentRow {
  const width = storableDimension(compressed ? compressed.width : row.width);
  const height = storableDimension(compressed ? compressed.height : row.height);
  if (!compressed) return { ...row, width, height };
  const extension = storedExtension(compressed.mimeType);
  const name = renamedFor(row.fileName, row.mimeType as AttachmentMimeType, compressed.mimeType);
  return {
    ...row,
    fileName: fileNameOf(name, extension),
    mimeType: compressed.mimeType,
    size: compressed.size,
    width,
    height,
    storageKey: `${row.id}.${extension}`,
  };
}

export const isRenamed = ({ before, after }: MovedAttachment): boolean =>
  before.fileName !== after.fileName || before.storageKey !== after.storageKey;

// A text that names a file as it was ("IMG_0042.JPG", or its old key) still reads the same, but no
// longer matches the name the tile shows. Nothing links by name, so it is counted, not rewritten.
export function textsNamingOldFiles(
  texts: readonly string[],
  moved: readonly MovedAttachment[],
): number {
  const oldNames = moved
    .filter(isRenamed)
    .flatMap(({ before }) => [before.fileName, before.storageKey])
    .filter((name) => name.trim().length > 0);
  return texts.filter((text) => oldNames.some((name) => text.includes(name))).length;
}
