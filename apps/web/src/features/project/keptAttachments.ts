import { PENDING_ATTACHMENT_TTL_MS, type Attachment } from '@tracker/shared';

// The server deletes an upload no ticket uses after a day; one about that old may be gone, and
// creating the ticket with it would fail.
const KEEP_FOR_MS = PENDING_ATTACHMENT_TTL_MS - 60 * 60 * 1000;

const isText = (value: unknown): value is string => typeof value === 'string';
const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const isSize = (value: unknown): boolean => value === null || isNumber(value);

function isAttachment(value: unknown): value is Attachment {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    [entry.id, entry.fileName, entry.mimeType, entry.url].every(isText) &&
    isNumber(entry.size) &&
    isNumber(entry.createdAt) &&
    isSize(entry.width) &&
    isSize(entry.height)
  );
}

// Storage may hold what an older build wrote, so each entry is checked.
export function keptAttachments(value: unknown, now: number): Attachment[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isAttachment).filter((entry) => now - entry.createdAt < KEEP_FOR_MS);
}
