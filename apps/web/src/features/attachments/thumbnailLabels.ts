import { attachmentKind, type Attachment, type AttachmentKind } from '@tracker/shared';

type Labelled = Pick<Attachment, 'fileName' | 'mimeType'>;

// Images and videos are numbered within their kind because the image viewer counts the same way.
export function thumbnailLabels(attachments: readonly Labelled[]): string[] {
  const counts = { image: 0, video: 0 };
  return attachments.map(({ fileName, mimeType }) => {
    const kind = attachmentKind(mimeType);
    if (kind !== 'image' && kind !== 'video') return fileName;
    counts[kind] += 1;
    return `${kind} ${counts[kind]}`;
  });
}

// Text files and PDFs show their name and size, so they need the wide tile.
export const isWide = (kind: AttachmentKind | null): boolean =>
  kind !== 'image' && kind !== 'video';

export const capitalized = (label: string): string =>
  label.charAt(0).toUpperCase() + label.slice(1);

// Characters before the extension that stay with it, enough to tell "crash-report-1.log" from
// "crash-report-2.log" when a small tile has room for neither name.
const KEPT_BEFORE_EXTENSION = 4;

export interface NameParts {
  head: string;
  tail: string;
}

// By code points, so an emoji in a name is never split.
export function splitFileName(name: string): NameParts {
  const characters = Array.from(name);
  const dot = characters.lastIndexOf('.');
  const extension = dot > 0 ? dot : characters.length;
  const cut = Math.max(0, extension - KEPT_BEFORE_EXTENSION);
  return { head: characters.slice(0, cut).join(''), tail: characters.slice(cut).join('') };
}

const pad = (value: number): string => String(value).padStart(2, '0');

export function formatDuration(seconds: number): string | null {
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = pad(total % 60);
  return hours > 0 ? `${hours}:${pad(minutes)}:${rest}` : `${minutes}:${rest}`;
}
