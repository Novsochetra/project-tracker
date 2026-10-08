import {
  ATTACHMENT_TYPES,
  checkAttachment,
  resolveAttachmentType,
  type AttachmentKind,
  type AttachmentMimeType,
} from '@tracker/shared';

export interface AdmittedFile {
  file: File;
  kind: AttachmentKind;
  mimeType: AttachmentMimeType;
}

export interface Admission {
  admitted: AdmittedFile[];
  refusal: string | null;
}

function check(file: File) {
  const type = resolveAttachmentType(file.type, file.name);
  // Photos are scaled down before they go, which brings most large ones under the limit, so their
  // size is checked once they are prepared (lib/uploads).
  const scaled = type !== null && ATTACHMENT_TYPES[type].kind === 'image';
  return checkAttachment(scaled ? { type: file.type, name: file.name, size: 0 } : file);
}

export function admitFiles(files: Iterable<File>): Admission {
  const admitted: AdmittedFile[] = [];
  let refusal: string | null = null;
  for (const file of files) {
    const result = check(file);
    if (result.ok) admitted.push({ file, kind: result.kind, mimeType: result.mimeType });
    else refusal ??= result.message;
  }
  return { admitted, refusal };
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
