import type { Db } from '../db/schema';
import { findApiTokenById } from '../repositories/apiTokens';
import { findSessionRow } from '../repositories/sessions';
import type { Access } from './access';
import { ownerExists } from './owner';

// For a request that lasts, like a live-update stream: is the access it started with still good?
export async function accessStillValid(
  db: Db,
  access: Access | null | undefined,
  now: number,
): Promise<boolean> {
  switch (access?.kind) {
    case 'open':
      return !(await ownerExists(db));
    case 'session': {
      const session = await findSessionRow(db, access.sessionId);
      return session !== undefined && session.expiresAt > now;
    }
    case 'token':
      return (await findApiTokenById(db, access.tokenId)) !== undefined;
    case undefined:
      return false;
  }
}
