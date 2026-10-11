import type { InvitedUser } from '@tracker/shared';
import type { Db } from '../db/schema';
import { listOpenResetRows } from '../repositories/invites';
import { listUsersWithRole } from '../repositories/users';

export async function listInvitedUsers(db: Db, now: number): Promise<InvitedUser[]> {
  const users = await listUsersWithRole(db, 'user');
  const resets = await listOpenResetRows(db, now);
  const resetEnds = new Map(resets.map((link) => [link.userId, link.expiresAt]));
  return users.map(({ id, name, email, createdAt }) => ({
    id,
    name,
    email,
    createdAt,
    resetExpiresAt: resetEnds.get(id) ?? null,
  }));
}
