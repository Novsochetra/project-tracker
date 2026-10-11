import { randomUUID } from 'node:crypto';
import { EMAIL_MAX, PASSWORD_MAX, PASSWORD_MIN, normalizeEmail } from '@tracker/shared';
import { z } from 'zod';
import type { Db } from '../db/schema';
import { conflict, invalidInput } from '../errors';
import { assignOwnerlessChats } from '../repositories/chats';
import { assignOwnerlessRunners } from '../repositories/runners';
import { assignOwnerlessRuns } from '../repositories/runs';
import { deleteUserSessions } from '../repositories/sessions';
import { assignOwnerlessProjects } from '../repositories/projects';
import { assignOwnerlessUploads } from '../repositories/attachments';
import { findOwner, findUserByEmail, insertUser, updateUserRow } from '../repositories/users';
import { hashPassword, type ScryptParams } from './passwords';

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

export interface SetOwnerResult {
  email: string;
  created: boolean;
  signedOut: number;
}

export const ownerExists = async (db: Db): Promise<boolean> => (await findOwner(db)) !== undefined;

function parseOwner(input: OwnerInput): OwnerInput {
  const result = ownerInput.safeParse({ ...input, email: normalizeEmail(input.email) });
  if (!result.success) throw invalidInput(result.error.issues[0]?.message ?? 'Invalid input.');
  return result.data;
}

async function refuseEmailOfAnother(db: Db, email: string, ownerId: string | undefined) {
  const user = await findUserByEmail(db, email);
  if (user && user.id !== ownerId) throw conflict('Another account already uses that email.');
}

async function createOwner(db: Db, owner: { email: string; passwordHash: string; now: number }) {
  const { email, passwordHash, now } = owner;
  const id = randomUUID();
  const row = { id, email, passwordHash, name: '', role: 'owner' as const };
  await insertUser(db, { ...row, createdAt: now, updatedAt: now });
  // Until now everyone on this computer was the one person, and that person is the owner.
  await assignOwnerlessProjects(db, id);
  await assignOwnerlessUploads(db, id);
  await assignOwnerlessRuns(db, id);
  await assignOwnerlessRunners(db, id);
  await assignOwnerlessChats(db, id);
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
    await refuseEmailOfAnother(trx, email, owner?.id);
    if (!owner) {
      await createOwner(trx, { email, passwordHash, now });
      return { email, created: true, signedOut: 0 };
    }
    await updateUserRow(trx, owner.id, { email, passwordHash, updatedAt: now });
    return { email, created: false, signedOut: await deleteUserSessions(trx, owner.id) };
  });
}
