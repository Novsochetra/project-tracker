import { randomUUID } from 'node:crypto';
import type { InviteRow, LinkKind } from '../db/authTables';
import type { Db } from '../db/schema';
import { notFound } from '../errors';
import { findLinkByHash, insertInvite } from '../repositories/invites';
import { hashSecret, newSecret } from './secrets';

export interface LinkMessages {
  failed: string;
  used: string;
  expired: string;
}

export interface NewLink {
  kind: LinkKind;
  createdBy: string;
  userId: string | null;
  ttlMs: number;
}

export async function insertLink(
  db: Db,
  link: NewLink,
  now: number,
): Promise<{ row: InviteRow; secret: string }> {
  const secret = newSecret();
  const { kind, createdBy, userId, ttlMs } = link;
  const row: InviteRow = {
    id: randomUUID(),
    kind,
    userId,
    tokenHash: hashSecret(secret),
    createdBy,
    createdAt: now,
    expiresAt: now + ttlMs,
    usedAt: null,
    usedBy: null,
  };
  await insertInvite(db, row);
  return { row, secret };
}

// The secret is 256 random bits, so telling a used or expired link from an unknown one gives a
// guesser nothing, and the person holding the link learns what to do.
export function linkProblem(row: InviteRow, now: number, messages: LinkMessages): string | null {
  if (row.usedAt !== null) return messages.used;
  if (row.expiresAt <= now) return messages.expired;
  return null;
}

export interface LinkUse {
  kind: LinkKind;
  secret: string;
  messages: LinkMessages;
}

export async function requireUsableLink(
  db: Db,
  { kind, secret, messages }: LinkUse,
  now: number,
): Promise<InviteRow> {
  const row = await findLinkByHash(db, kind, hashSecret(secret));
  if (!row) throw notFound(messages.failed);
  const problem = linkProblem(row, now, messages);
  if (problem) throw notFound(problem);
  return row;
}
