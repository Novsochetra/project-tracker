import { RESET_LINK_FAILED, type CreatedResetLink, type ResetLinkCheck } from '@tracker/shared';
import type { InviteRow, UserRow } from '../db/authTables';
import type { Db } from '../db/schema';
import { notFound } from '../errors';
import { deleteOpenResets } from '../repositories/invites';
import { findUserById } from '../repositories/users';
import { insertLink, requireUsableLink, type LinkMessages } from './links';

// The owner sends it while the person waits to get back in; one that leaks is good for a day.
export const RESET_TTL_MS = 24 * 60 * 60 * 1000;

export const RESET_USED =
  'This reset link was already used. Sign in, or ask the owner for a new one.';

const RESET_MESSAGES: LinkMessages = {
  failed: RESET_LINK_FAILED,
  used: RESET_USED,
  expired: 'This reset link has expired. Ask the owner for a new one.',
};

// The owner changes their own password in the app or with owner:set, never with a link.
async function requireInvitedUser(db: Db, userId: string): Promise<UserRow> {
  const user = await findUserById(db, userId);
  if (user?.role !== 'user') throw notFound('That account was not found.');
  return user;
}

// One open link per account: a new one replaces the last, so only the link sent last works.
export async function createResetLink(
  db: Db,
  ownerId: string,
  userId: string,
  now: number,
): Promise<CreatedResetLink> {
  await requireInvitedUser(db, userId);
  const link = { kind: 'reset' as const, createdBy: ownerId, userId, ttlMs: RESET_TTL_MS };
  return db.transaction().execute(async (trx) => {
    await deleteOpenResets(trx, userId);
    const { row, secret } = await insertLink(trx, link, now);
    return { expiresAt: row.expiresAt, secret };
  });
}

export async function cancelResetLink(db: Db, userId: string): Promise<void> {
  if ((await deleteOpenResets(db, userId)) === 0) throw notFound('That reset link was not found.');
}

export const requireUsableReset = (db: Db, secret: string, now: number): Promise<InviteRow> =>
  requireUsableLink(db, { kind: 'reset', secret, messages: RESET_MESSAGES }, now);

// The email lets the page say whose password it sets, and a password manager save it there.
export async function checkResetLink(db: Db, secret: string, now: number): Promise<ResetLinkCheck> {
  const link = await requireUsableReset(db, secret, now);
  const user = await findUserById(db, link.userId ?? '');
  if (!user) throw notFound(RESET_LINK_FAILED);
  return { email: user.email, expiresAt: link.expiresAt };
}
