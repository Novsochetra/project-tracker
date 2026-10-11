import { INVITE_LINK_FAILED, type CreatedInvite, type Invite } from '@tracker/shared';
import type { InviteRow } from '../db/authTables';
import type { Db } from '../db/schema';
import { notFound } from '../errors';
import { deleteOpenInvite, listOpenInviteRows } from '../repositories/invites';
import { insertLink, requireUsableLink, type LinkMessages } from './links';

// Long enough to reach someone who reads mail weekly; a link that leaks is good for a week at most.
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const INVITE_EXPIRED = 'This invite has expired. Ask for a new one.';
export const INVITE_USED = 'This invite was already used. Sign in instead.';

const INVITE_MESSAGES: LinkMessages = {
  failed: INVITE_LINK_FAILED,
  used: INVITE_USED,
  expired: INVITE_EXPIRED,
};

const toInvite = ({ id, createdAt, expiresAt }: InviteRow): Invite => ({
  id,
  createdAt,
  expiresAt,
});

export async function createInvite(db: Db, ownerId: string, now: number): Promise<CreatedInvite> {
  const link = { kind: 'invite' as const, createdBy: ownerId, userId: null, ttlMs: INVITE_TTL_MS };
  const { row, secret } = await insertLink(db, link, now);
  return { invite: toInvite(row), secret };
}

export const listOpenInvites = async (db: Db, ownerId: string, now: number): Promise<Invite[]> =>
  (await listOpenInviteRows(db, ownerId, now)).map(toInvite);

export async function revokeInvite(db: Db, ownerId: string, id: string): Promise<void> {
  if ((await deleteOpenInvite(db, ownerId, id)) === 0) throw notFound('That invite was not found.');
}

export const requireUsableInvite = (db: Db, secret: string, now: number): Promise<InviteRow> =>
  requireUsableLink(db, { kind: 'invite', secret, messages: INVITE_MESSAGES }, now);
