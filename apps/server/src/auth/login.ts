import { normalizeEmail } from '@tracker/shared';
import type { UserRow } from '../db/authTables';
import type { Db } from '../db/schema';
import { findUserByEmail } from '../repositories/users';
import { hashPassword, verifyPassword } from './passwords';
import { newSecret } from './secrets';

export type SignedInUser = Pick<UserRow, 'id' | 'email' | 'name' | 'role'>;

let dummyHash: Promise<string> | undefined;

// An unknown email still pays for one hash, so its answer takes as long as a wrong password.
const hashToCheck = (stored: string | undefined): Promise<string> =>
  stored !== undefined ? Promise.resolve(stored) : (dummyHash ??= hashPassword(newSecret()));

export async function checkLogin(
  db: Db,
  email: string,
  password: string,
): Promise<SignedInUser | null> {
  const user = await findUserByEmail(db, normalizeEmail(email));
  const passwordOk = await verifyPassword(password, await hashToCheck(user?.passwordHash));
  return user && passwordOk
    ? { id: user.id, email: user.email, name: user.name, role: user.role }
    : null;
}
