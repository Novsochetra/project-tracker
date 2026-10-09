import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

// Agents' tokens start with this, so they are easy to spot in a config file or a leak scanner.
export const API_TOKEN_PREFIX = 'trk_';

const SECRET_BYTES = 32;

export const newSecret = (prefix = ''): string =>
  `${prefix}${randomBytes(SECRET_BYTES).toString('base64url')}`;

// Secrets are 256 random bits, so a fast hash is enough: nobody can guess one to match a hash.
export const hashSecret = (secret: string): string =>
  createHash('sha256').update(secret).digest('hex');

// Hashing first gives equal-length buffers, which timingSafeEqual requires.
const digest = (value: string): Buffer => createHash('sha256').update(value).digest();

export const safeEqual = (a: string, b: string): boolean => timingSafeEqual(digest(a), digest(b));
