import type { Db } from '../db/schema';
import {
  deleteExpiredSessions,
  deleteSessionRow,
  deleteUserSessions,
  findSessionWithEmail,
  insertSession,
  renewSessionRow,
} from '../repositories/sessions';
import { hashSecret, newSecret } from './secrets';

const DAY_MS = 24 * 60 * 60 * 1000;

// A session ends after 30 days without use and after 90 days in any case, so a stolen cookie
// can't be kept alive forever. Use renews it at most once a day, which keeps writes rare.
export const SESSION_IDLE_MS = 30 * DAY_MS;
export const SESSION_MAX_MS = 90 * DAY_MS;
export const SESSION_RENEW_AFTER_MS = DAY_MS;

export interface StartedSession {
  secret: string;
  expiresAt: number;
}

export interface ActiveSession {
  sessionId: string;
  userId: string;
  email: string;
  expiresAt: number;
  renewed: boolean;
}

export async function startSession(db: Db, userId: string, now: number): Promise<StartedSession> {
  const secret = newSecret();
  const expiresAt = now + SESSION_IDLE_MS;
  await deleteExpiredSessions(db, now);
  await insertSession(db, {
    id: hashSecret(secret),
    userId,
    createdAt: now,
    lastSeenAt: now,
    expiresAt,
  });
  return { secret, expiresAt };
}

export async function resumeSession(
  db: Db,
  secret: string,
  now: number,
): Promise<ActiveSession | null> {
  const row = await findSessionWithEmail(db, hashSecret(secret));
  if (!row) return null;
  if (row.expiresAt <= now) {
    await deleteSessionRow(db, row.id);
    return null;
  }
  const renewed = now - row.lastSeenAt >= SESSION_RENEW_AFTER_MS;
  const expiresAt = renewed
    ? Math.min(now + SESSION_IDLE_MS, row.createdAt + SESSION_MAX_MS)
    : row.expiresAt;
  if (renewed) await renewSessionRow(db, row.id, { lastSeenAt: now, expiresAt });
  return { sessionId: row.id, userId: row.userId, email: row.email, expiresAt, renewed };
}

export const endSession = (db: Db, secret: string): Promise<void> =>
  deleteSessionRow(db, hashSecret(secret));

export const endAllSessions = (db: Db, userId: string): Promise<number> =>
  deleteUserSessions(db, userId);
