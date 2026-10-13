import type { Db } from '../db/schema';
import { findStoredKeys, storeKeysOnce } from '../repositories/pushKeys';
import { generateVapidKeys, signingKeyOf, type VapidKeys } from './vapidKeys';
import type { Sender } from './pushRequest';

// Without keys in the environment the server makes a pair once and keeps it, so push works on a
// fresh deploy; the browsers' subscriptions are tied to it, so it must outlive restarts.
async function storedKeys(db: Db, now: number): Promise<VapidKeys> {
  const found = await findStoredKeys(db);
  if (found) return found;
  await storeKeysOnce(db, { ...generateVapidKeys(), createdAt: now });
  const stored = await findStoredKeys(db);
  if (!stored) throw new Error('The VAPID keys could not be stored.');
  return stored;
}

export interface SenderSettings {
  keys: VapidKeys | null;
  subject: string;
}

export async function loadSender(db: Db, settings: SenderSettings, now: number): Promise<Sender> {
  const { publicKey, privateKey } = settings.keys ?? (await storedKeys(db, now));
  return {
    publicKey,
    signingKey: signingKeyOf({ publicKey, privateKey }),
    subject: settings.subject,
  };
}
