import {
  attachmentKind,
  storedExtension,
  typeFromFileName,
  type AttachmentMimeType,
} from '@tracker/shared';

// "IMG_0042.JPG" stored as WebP downloads as "IMG_0042.webp", so it opens as what it is.
export function renamedFor(name: string, from: AttachmentMimeType, to: AttachmentMimeType): string {
  const trimmed = name.trimEnd();
  if (from === to || !trimmed.trim()) return name;
  const named = typeFromFileName(trimmed);
  const stem =
    named && attachmentKind(named) === 'image'
      ? trimmed.slice(0, trimmed.lastIndexOf('.'))
      : trimmed;
  return `${stem}.${storedExtension(to)}`;
}
