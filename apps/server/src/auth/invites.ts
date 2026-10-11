import { randomUUID } from 'node:crypto';
import { INVITE_LINK_FAILED, type CreatedInvite, type Invite } from '@tracker/shared';
import type { InviteRow } from '../db/authTables';
import type { Db } from '../db/schema';
import { notFound } from '../errors';
import {
  deleteOpenInvite,
  findInviteByHash,
  insertInvite,
  listOpenInviteRows,
} from '../repositories/invites';
import { hashSecret, newSecret } from './secrets';

// Long enough to reach someone who reads mail weekly; a link that leaks is good for a week at most.
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const INVITE_EXPIRED = 'This invite has expired. Ask for a new one.';
export const INVITE_USED = 'This invite was already used. Sign in instead.';

const toInvite = ({ id, createdAt, expiresAt }: InviteRow): Invite => ({
  id,
  createdAt,
  expiresAt,
});

export async function createInvite(db: Db, ownerId: string, now: number): Promise<CreatedInvite> {
  const secret = newSecret();
  const row: InviteRow = {
    id: randomUUID(),
    tokenHash: hashSecret(secret),
    createdBy: ownerId,
    createdAt: now,
    expiresAt: now + INVITE_TTL_MS,
    usedAt: null,
    usedBy: null,
  };
  await insertInvite(db, row);
  return { invite: toInvite(row), secret };
}

export const listOpenInvites = async (db: Db, ownerId: string, now: number): Promise<Invite[]> =>
  (await listOpenInviteRows(db, ownerId, now)).map(toInvite);

export async function revokeInvite(db: Db, ownerId: string, id: string): Promise<void> {
  if ((await deleteOpenInvite(db, ownerId, id)) === 0) throw notFound('That invite was not found.');
}

// The secret is 256 random bits, so telling a used or expired invite from an unknown one gives a
// guesser nothing, and the person holding the link learns what to do.
export function inviteProblem(row: InviteRow, now: number): string | null {
  if (row.usedAt !== null) return INVITE_USED;
  if (row.expiresAt <= now) return INVITE_EXPIRED;
  return null;
}

export async function requireUsableInvite(db: Db, secret: string, now: number): Promise<InviteRow> {
  const row = await findInviteByHash(db, hashSecret(secret));
  if (!row) throw notFound(INVITE_LINK_FAILED);
  const problem = inviteProblem(row, now);
  if (problem) throw notFound(problem);
  return row;
}
