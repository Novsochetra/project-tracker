import { describe, expect, it } from 'vitest';
import { loadAuthConfig } from '../../src/authConfig';
import { authNotice } from '../../src/auth/startupNotice';
import { useTestServer } from '../helpers/server';

// Reviewer 100 (PT-138): a proxy or tunnel on this machine (ssh -R, socat, a bare nginx) that
// sends Host: localhost and no X-Forwarded-For looks local, and the server can't tell. Its start
// line has to say so while there is no owner.
describe('regression: a local proxy in front of a tracker without an owner', () => {
  const api = useTestServer('sqlite');

  it('is warned about at start', async () => {
    const notice = (await authNotice(api.db, loadAuthConfig({}, '127.0.0.1'))).join('\n');
    expect(notice).toContain(
      'A proxy or tunnel on this machine (ssh -R, socat, nginx) makes the requests it passes on ' +
        'look local, so set an owner before using one: npm run owner:set -- --email you@example.com',
    );
  });
});
