import { randomUUID } from 'node:crypto';
import type { acceptInviteInput } from '@tracker/shared';
import type { z } from 'zod';
import type { UserRow } from '../db/authTables';
import { isUniqueViolation } from '../db/errors';
import type { Db } from '../db/schema';
import { conflict, notFound } from '../errors';
import { useLinkRow } from '../repositories/invites';
import { findUserByEmail, insertUser } from '../repositories/users';
import { INVITE_USED, requireUsableInvite } from './invites';
import type { SignedInUser } from './login';
import { hashPassword, type ScryptParams } from './passwords';

type AcceptValues = z.output<typeof acceptInviteInput>;

const EMAIL_TAKEN = 'An account with this email already exists. Sign in instead.';

async function addInvitedUser(trx: Db, row: UserRow, inviteId: string): Promise<void> {
  if (await findUserByEmail(trx, row.email)) throw conflict(EMAIL_TAKEN);
  await insertUser(trx, row);
  // Another accept may have used it since it was checked; then this one keeps nothing.
  const used = await useLinkRow(trx, inviteId, { usedBy: row.id, usedAt: row.createdAt });
  if (!used) throw notFound(INVITE_USED);
}

// The invite is checked before the password is hashed, so a bad link costs no hashing.
export async function acceptInvite(
  db: Db,
  input: AcceptValues,
  now: number,
  params?: ScryptParams,
): Promise<SignedInUser> {
  const invite = await requireUsableInvite(db, input.secret, now);
  const passwordHash = await hashPassword(input.password, params);
  const user = { id: randomUUID(), email: input.email, name: input.name, role: 'user' as const };
  const row: UserRow = { ...user, passwordHash, createdAt: now, updatedAt: now };
  try {
    await db.transaction().execute((trx) => addInvitedUser(trx, row, invite.id));
  } catch (error) {
    // Two accepts with one email at once on Postgres: the unique index refuses the second.
    if (isUniqueViolation(error)) throw conflict(EMAIL_TAKEN);
    throw error;
  }
  return user;
}
