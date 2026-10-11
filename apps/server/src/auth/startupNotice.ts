import type { AuthConfig } from '../authConfig';
import type { Db } from '../db/schema';
import { ownerExists } from './owner';

const SETUP_COMMAND = 'npm run owner:set -- --email you@example.com';

function withoutOwner(config: AuthConfig): string {
  if (config.openWithoutOwner !== false) {
    return (
      'No owner account: open to requests from this machine only (localhost); other devices, ' +
      "the dev server's LAN address included, must sign in. A proxy or tunnel on this machine " +
      '(ssh -R, socat, nginx) makes the requests it passes on look local, so set an owner before ' +
      `using one: ${SETUP_COMMAND}`
    );
  }
  const why = config.legacyToken
    ? 'TRACKER_TOKEN is set and there is no owner account'
    : 'No owner account yet';
  return `${why}, so every request is refused. Run ${SETUP_COMMAND}`;
}

export async function authNotice(db: Db, config: AuthConfig): Promise<string[]> {
  const lines = config.legacyToken
    ? ['TRACKER_TOKEN is no longer read by the server: agents use API tokens the owner creates.']
    : [];
  if (await ownerExists(db)) return [...lines, 'Sign-in required (owner account set).'];
  return [...lines, withoutOwner(config)];
}
