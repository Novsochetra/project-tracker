const MB = 1024 * 1024;

export const ATTACHMENT_KINDS = {
  image: { maxBytes: 15 * MB, label: 'Images' },
  video: { maxBytes: 100 * MB, label: 'Videos' },
  text: { maxBytes: 5 * MB, label: 'Text files' },
  pdf: { maxBytes: 25 * MB, label: 'PDFs' },
} as const;

export type AttachmentKind = keyof typeof ATTACHMENT_KINDS;

interface AttachmentType {
  kind: AttachmentKind;
  /** The first extension is the one stored files get. */
  extensions: readonly [string, ...string[]];
}

// No SVG or HTML: opened from the tracker's address they could run script.
export const ATTACHMENT_TYPES = {
  'image/png': { kind: 'image', extensions: ['png'] },
  'image/jpeg': { kind: 'image', extensions: ['jpg', 'jpeg'] },
  'image/gif': { kind: 'image', extensions: ['gif'] },
  'image/webp': { kind: 'image', extensions: ['webp'] },
  'image/heic': { kind: 'image', extensions: ['heic'] },
  'image/heif': { kind: 'image', extensions: ['heif'] },
  'video/mp4': { kind: 'video', extensions: ['mp4'] },
  'video/quicktime': { kind: 'video', extensions: ['mov'] },
  'video/webm': { kind: 'video', extensions: ['webm'] },
  'text/plain': { kind: 'text', extensions: ['txt', 'log'] },
  'text/markdown': { kind: 'text', extensions: ['md'] },
  'text/csv': { kind: 'text', extensions: ['csv'] },
  'application/json': { kind: 'text', extensions: ['json'] },
  'application/pdf': { kind: 'pdf', extensions: ['pdf'] },
} as const satisfies Record<string, AttachmentType>;

export type AttachmentMimeType = keyof typeof ATTACHMENT_TYPES;

const TYPES = new Map<string, AttachmentType>(Object.entries(ATTACHMENT_TYPES));

const TYPE_OF_EXTENSION = new Map<string, AttachmentMimeType>(
  Object.entries(ATTACHMENT_TYPES).flatMap(([type, { extensions }]) =>
    extensions.map((extension) => [extension, type as AttachmentMimeType] as const),
  ),
);

// Browsers send these for files they don't know (often .log and .md); Windows labels .csv files
// as Excel's type and some systems use the older Markdown type. For these the name decides.
const UNCLEAR_TYPES = new Set([
  '',
  'application/octet-stream',
  'application/vnd.ms-excel',
  'text/x-markdown',
]);

export const MAX_ATTACHMENT_BYTES = Math.max(
  ...Object.values(ATTACHMENT_KINDS).map((kind) => kind.maxBytes),
);

/** How long an upload waits for a ticket or comment to use it before the server deletes it. */
export const PENDING_ATTACHMENT_TTL_MS = 24 * 60 * 60 * 1000;

/** For file inputs: every type and extension, since some systems give .log or .md no type. */
export const ATTACHMENT_ACCEPT = [
  ...Object.keys(ATTACHMENT_TYPES),
  ...[...TYPE_OF_EXTENSION.keys()].map((extension) => `.${extension}`),
].join(',');

export const UNSUPPORTED_ATTACHMENT_MESSAGE =
  'Only images (PNG, JPEG, GIF, WebP, HEIC), videos (MP4, MOV, WebM), text files ' +
  '(TXT, LOG, MD, CSV, JSON) and PDFs can be attached.';

export function tooLargeMessage(kind: AttachmentKind): string {
  const { label, maxBytes } = ATTACHMENT_KINDS[kind];
  return `${label} can be up to ${maxBytes / MB} MB.`;
}

const bareType = (type: string): string => (type.split(';')[0] ?? '').trim().toLowerCase();

export const attachmentKind = (mimeType: string): AttachmentKind | null =>
  TYPES.get(bareType(mimeType))?.kind ?? null;

export const storedExtension = (mimeType: AttachmentMimeType): string =>
  ATTACHMENT_TYPES[mimeType].extensions[0];

export function typeFromFileName(fileName: string): AttachmentMimeType | null {
  const extension = /\.([^.]+)$/.exec(fileName.trim())?.[1]?.toLowerCase() ?? '';
  return TYPE_OF_EXTENSION.get(extension) ?? null;
}

/** The allowed type of a file, or null. The browser's type wins, so an SVG named x.png stays out. */
export function resolveAttachmentType(type: string, fileName: string): AttachmentMimeType | null {
  const declared = bareType(type);
  if (TYPES.has(declared)) return declared as AttachmentMimeType;
  return UNCLEAR_TYPES.has(declared) ? typeFromFileName(fileName) : null;
}

export interface FileFacts {
  type: string;
  name: string;
  size: number;
}

export type AttachmentCheck =
  { ok: true; mimeType: AttachmentMimeType; kind: AttachmentKind } | { ok: false; message: string };

/** Whether a file can be attached; `File` objects fit `FileFacts`. */
export function checkAttachment(file: FileFacts): AttachmentCheck {
  const mimeType = resolveAttachmentType(file.type, file.name);
  if (!mimeType) return { ok: false, message: UNSUPPORTED_ATTACHMENT_MESSAGE };
  const { kind } = ATTACHMENT_TYPES[mimeType];
  if (file.size > ATTACHMENT_KINDS[kind].maxBytes) {
    return { ok: false, message: tooLargeMessage(kind) };
  }
  return { ok: true, mimeType, kind };
}

export interface Attachment {
  id: string;
  ticketId: string | null;
  activityId: string | null;
  fileName: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  url: string;
  createdAt: number;
}
