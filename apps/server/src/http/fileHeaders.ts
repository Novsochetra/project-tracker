import { attachmentKind } from '@tracker/shared';
import type { AttachmentRow } from '../db/schema';

const IMMUTABLE = 'private, max-age=31536000, immutable';

const LONE_SURROGATE = /\p{Surrogate}/gu;
const NOT_PLAIN_ASCII = /[^\x20-\x7e]|["\\]/gu;
// encodeURIComponent leaves these as they are, but RFC 5987 values may not contain them.
const NOT_ATTR_CHAR = /['()*]/g;

const percentEncode = (value: string): string =>
  encodeURIComponent(value).replace(
    NOT_ATTR_CHAR,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );

// RFC 6266 with an RFC 5987 `filename*`, and a plain ASCII `filename` for old clients.
export function contentDisposition(fileName: string): string {
  const name = fileName.replace(LONE_SURROGATE, '\uFFFD');
  const fallback = name.replace(NOT_PLAIN_ASCII, '_');
  return `inline; filename="${fallback}"; filename*=UTF-8''${percentEncode(name)}`;
}

export function fileHeaders(row: AttachmentRow): Record<string, string> {
  const isText = attachmentKind(row.mimeType) === 'text';
  const headers: Record<string, string> = {
    'Content-Type': isText ? `${row.mimeType}; charset=utf-8` : row.mimeType,
    'Content-Disposition': contentDisposition(row.fileName),
    'Accept-Ranges': 'bytes',
    'Cache-Control': IMMUTABLE,
    'X-Content-Type-Options': 'nosniff',
  };
  // Defense in depth for a text file opened on its own. Not for PDFs: Chrome refuses to show
  // a sandboxed PDF.
  if (isText) headers['Content-Security-Policy'] = 'sandbox';
  return headers;
}
