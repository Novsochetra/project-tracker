import {
  ATTACHMENT_TYPES,
  MAX_NEW_ATTACHMENTS,
  checkAttachment,
  resolveAttachmentType,
  tooManyFilesMessage,
  type AttachmentKind,
  type AttachmentMimeType,
  type AttachmentOwner,
} from '@tracker/shared';

export interface AdmittedFile {
  file: File;
  kind: AttachmentKind;
  mimeType: AttachmentMimeType;
}

export interface RefusedFile {
  name: string;
  reason: string;
}

export interface Admission {
  admitted: AdmittedFile[];
  refused: RefusedFile[];
}

export interface FileRoom {
  room: number;
  reason: string;
}

export interface FileLimit {
  owner: AttachmentOwner;
  attached: number;
}

const UNLIMITED: FileRoom = { room: Infinity, reason: '' };

export function roomFor(limit: FileLimit | undefined, uploading: number): FileRoom {
  if (!limit) return UNLIMITED;
  return {
    room: MAX_NEW_ATTACHMENTS - limit.attached - uploading,
    reason: tooManyFilesMessage(limit.owner),
  };
}

function check(file: File) {
  const type = resolveAttachmentType(file.type, file.name);
  // Photos are scaled down before they go, which brings most large ones under the limit, so their
  // size is checked once they are prepared (lib/uploads).
  const scaled = type !== null && ATTACHMENT_TYPES[type].kind === 'image';
  return checkAttachment(scaled ? { type: file.type, name: file.name, size: 0 } : file);
}

export function admitFiles(files: Iterable<File>, { room, reason } = UNLIMITED): Admission {
  const admitted: AdmittedFile[] = [];
  const refused: RefusedFile[] = [];
  for (const file of files) {
    const result = check(file);
    const name = file.name || 'A file';
    if (!result.ok) refused.push({ name, reason: result.message });
    else if (admitted.length >= room) refused.push({ name, reason });
    else admitted.push({ file, kind: result.kind, mimeType: result.mimeType });
  }
  return { admitted, refused };
}

export function filesOf(data: DataTransfer | null): File[] {
  if (!data) return [];
  if (data.files.length > 0) return Array.from(data.files);
  return Array.from(data.items).flatMap((item) => {
    const file = item.kind === 'file' ? item.getAsFile() : null;
    return file ? [file] : [];
  });
}

export const carriesFiles = (data: DataTransfer | null): boolean =>
  data !== null && Array.from(data.types).includes('Files');
