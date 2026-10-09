import type { AuthConfig } from '../authConfig';
import type { Db } from '../db/schema';
import { ownerExists } from './owner';

const SETUP_COMMAND = 'npm run owner:set -- --email you@example.com';

export async function authNotice(db: Db, config: AuthConfig): Promise<string[]> {
  const lines = config.legacyToken
    ? ['TRACKER_TOKEN is no longer read by the server: agents use API tokens the owner creates.']
    : [];
  if (await ownerExists(db)) return [...lines, 'Sign-in required (owner account set).'];
  if (config.openWithoutOwner) {
    return [...lines, `No owner account: open to this machine only. Set one with ${SETUP_COMMAND}`];
  }
  return [...lines, `No owner account yet, so every request is refused. Run ${SETUP_COMMAND}`];
}
