import type { resetPasswordInput } from '@tracker/shared';
import type { z } from 'zod';
import type { Db } from '../db/schema';
import { notFound } from '../errors';
import { useLinkRow } from '../repositories/invites';
import { deleteUserSessions } from '../repositories/sessions';
import { updateUserRow } from '../repositories/users';
import { hashPassword, type ScryptParams } from './passwords';
import { requireUsableReset, RESET_USED } from './passwordResets';

type ResetValues = z.output<typeof resetPasswordInput>;

// The link is checked before the password is hashed, so a bad link costs no hashing. Every
// session ends: whoever knew the old password may hold one.
export async function resetPassword(
  db: Db,
  input: ResetValues,
  now: number,
  params?: ScryptParams,
): Promise<void> {
  const link = await requireUsableReset(db, input.secret, now);
  const userId = link.userId ?? '';
  const passwordHash = await hashPassword(input.password, params);
  await db.transaction().execute(async (trx) => {
    // Another use may have taken the link since it was checked; then this one changes nothing.
    if (!(await useLinkRow(trx, link.id, { usedBy: userId, usedAt: now }))) {
      throw notFound(RESET_USED);
    }
    await updateUserRow(trx, userId, { passwordHash, updatedAt: now });
    await deleteUserSessions(trx, userId);
  });
}
