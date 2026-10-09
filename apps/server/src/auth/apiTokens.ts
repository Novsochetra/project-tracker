import { randomUUID } from 'node:crypto';
import type { ApiToken, CreatedApiToken } from '@tracker/shared';
import type { ApiTokenRow } from '../db/authTables';
import type { Db } from '../db/schema';
import { notFound } from '../errors';
import {
  deleteApiTokenRow,
  findApiTokenByHash,
  insertApiToken,
  listApiTokenRows,
  touchApiToken,
} from '../repositories/apiTokens';
import { API_TOKEN_PREFIX, hashSecret, newSecret } from './secrets';

// An agent makes many requests a minute; "last used" needs no finer grain than this.
const TOUCH_AFTER_MS = 60_000;
const HINT_CHARS = 4;

export interface TokenOwner {
  tokenId: string;
  userId: string;
}

const toApiToken = ({ id, name, hint, createdAt, lastUsedAt }: ApiTokenRow): ApiToken => ({
  id,
  name,
  hint,
  createdAt,
  lastUsedAt,
});

export async function createApiToken(
  db: Db,
  userId: string,
  name: string,
  now: number,
): Promise<CreatedApiToken> {
  const secret = newSecret(API_TOKEN_PREFIX);
  const row: ApiTokenRow = {
    id: randomUUID(),
    userId,
    name,
    hint: secret.slice(0, API_TOKEN_PREFIX.length + HINT_CHARS),
    tokenHash: hashSecret(secret),
    createdAt: now,
    lastUsedAt: null,
  };
  await insertApiToken(db, row);
  return { token: toApiToken(row), secret };
}

export const listApiTokens = async (db: Db, userId: string): Promise<ApiToken[]> =>
  (await listApiTokenRows(db, userId)).map(toApiToken);

export async function revokeApiToken(db: Db, userId: string, id: string): Promise<void> {
  if ((await deleteApiTokenRow(db, id, userId)) === 0) {
    throw notFound('That token was already revoked.');
  }
}

export async function authenticateApiToken(
  db: Db,
  secret: string,
  now: number,
): Promise<TokenOwner | null> {
  const row = await findApiTokenByHash(db, hashSecret(secret));
  if (!row) return null;
  if (row.lastUsedAt === null || now - row.lastUsedAt >= TOUCH_AFTER_MS) {
    await touchApiToken(db, row.id, now);
  }
  return { tokenId: row.id, userId: row.userId };
}
