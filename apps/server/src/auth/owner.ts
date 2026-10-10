import { randomUUID } from 'node:crypto';
import { EMAIL_MAX, PASSWORD_MAX, normalizeEmail } from '@tracker/shared';
import { z } from 'zod';
import type { Db } from '../db/schema';
import { invalidInput } from '../errors';
import { assignOwnerlessRunners } from '../repositories/runners';
import { assignOwnerlessRuns } from '../repositories/runs';
import { deleteUserSessions } from '../repositories/sessions';
import { findOwner, insertUser, updateUserRow } from '../repositories/users';
import { hashPassword, verifyPassword, type ScryptParams } from './passwords';
import { newSecret, safeEqual } from './secrets';

export const PASSWORD_MIN = 12;

const ownerInput = z.object({
  email: z.email('Use a real email address.').max(EMAIL_MAX),
  password: z
    .string()
    .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters for the password.`)
    .max(PASSWORD_MAX, `Use at most ${PASSWORD_MAX} characters for the password.`),
});

export interface OwnerInput {
  email: string;
  password: string;
}

export interface Owner {
  id: string;
  email: string;
}

export interface SetOwnerResult {
  email: string;
  created: boolean;
  signedOut: number;
}

export const ownerExists = async (db: Db): Promise<boolean> => (await findOwner(db)) !== undefined;

let dummyHash: Promise<string> | undefined;

// Without an owner a sign-in still pays for one hash, so its answer takes as long as a wrong one.
const hashToCheck = (stored: string | undefined): Promise<string> =>
  stored !== undefined ? Promise.resolve(stored) : (dummyHash ??= hashPassword(newSecret()));

export async function checkLogin(db: Db, email: string, password: string): Promise<Owner | null> {
  const owner = await findOwner(db);
  // Both checks always run, so the time taken doesn't tell a wrong email from a wrong password.
  const passwordOk = await verifyPassword(password, await hashToCheck(owner?.passwordHash));
  const emailOk = owner !== undefined && safeEqual(normalizeEmail(email), owner.email);
  return owner && passwordOk && emailOk ? { id: owner.id, email: owner.email } : null;
}

function parseOwner(input: OwnerInput): OwnerInput {
  const result = ownerInput.safeParse({ ...input, email: normalizeEmail(input.email) });
  if (!result.success) throw invalidInput(result.error.issues[0]?.message ?? 'Invalid input.');
  return result.data;
}

// A new password signs every device out: whoever knew the old one may hold a session.
export async function setOwner(
  db: Db,
  input: OwnerInput,
  now: number,
  params?: ScryptParams,
): Promise<SetOwnerResult> {
  const { email, password } = parseOwner(input);
  const passwordHash = await hashPassword(password, params);
  return db.transaction().execute(async (trx) => {
    const owner = await findOwner(trx);
    if (!owner) {
      const id = randomUUID();
      await insertUser(trx, { id, email, passwordHash, createdAt: now, updatedAt: now });
      // Until now everyone on this computer was the one person, and that person is the owner.
      await assignOwnerlessRuns(trx, id);
      await assignOwnerlessRunners(trx, id);
      return { email, created: true, signedOut: 0 };
    }
    await updateUserRow(trx, owner.id, { email, passwordHash, updatedAt: now });
    return { email, created: false, signedOut: await deleteUserSessions(trx, owner.id) };
  });
}
