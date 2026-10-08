import { createHash } from 'node:crypto';

export const etagOf = (bytes: Uint8Array): string =>
  `W/"${createHash('sha256').update(bytes).digest('base64url')}"`;

const opaquePart = (tag: string) => tag.trim().replace(/^W\//, '');

// If-None-Match compares weakly (RFC 9110, 13.1.2), so "abc" matches W/"abc".
export const etagMatches = (ifNoneMatch: string | undefined, etag: string): boolean =>
  ifNoneMatch?.trim() === '*' ||
  (ifNoneMatch ?? '').split(',').some((tag) => opaquePart(tag) === opaquePart(etag));
