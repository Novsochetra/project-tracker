import type { Db } from '../db/schema';
import { invalidInput } from '../errors';
import { deleteOtherSessions } from '../repositories/sessions';
import { findUserById, updateUserRow } from '../repositories/users';
import { hashPassword, verifyPassword, type ScryptParams } from './passwords';

export const WRONG_CURRENT_PASSWORD = 'Your current password is not right.';

export interface PasswordChange {
  userId: string;
  // The session asking: it stays signed in.
  sessionId: string;
  currentPassword: string;
  newPassword: string;
}

// Every other session ends: whoever knew the old password may hold one. API tokens stay; they are
// separate credentials the person revokes in Connect.
export async function changePassword(
  db: Db,
  change: PasswordChange,
  now: number,
  params?: ScryptParams,
): Promise<void> {
  const user = await findUserById(db, change.userId);
  const known =
    user !== undefined && (await verifyPassword(change.currentPassword, user.passwordHash));
  if (!user || !known) throw invalidInput(WRONG_CURRENT_PASSWORD);
  const passwordHash = await hashPassword(change.newPassword, params);
  await db.transaction().execute(async (trx) => {
    await updateUserRow(trx, user.id, { passwordHash, updatedAt: now });
    await deleteOtherSessions(trx, user.id, change.sessionId);
  });
}
