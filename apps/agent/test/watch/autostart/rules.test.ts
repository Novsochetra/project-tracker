import { describe, expect, it } from 'vitest';
import { privacyNote, refuseTokenFromEnv } from '../../../src/watch/autostart/rules';

describe('install rules', () => {
  it('refuses a token from a variable the job will not have, and says to unset it', () => {
    const base = { url: 'https://t.example.com', token: 'trk_x', agentName: 'Claude' };
    expect(() => refuseTokenFromEnv({ ...base, tokenSource: 'tracker login' })).not.toThrow();
    expect(() => refuseTokenFromEnv({ ...base, token: undefined })).not.toThrow();
    expect(() => refuseTokenFromEnv({ ...base, tokenSource: 'TRACKER_API_TOKEN' })).toThrow(
      'Unset TRACKER_API_TOKEN, run "tracker login --url https://t.example.com", then install again',
    );
    expect(() => refuseTokenFromEnv({ ...base, tokenSource: '--token' })).toThrow(
      'Leave out --token, run "tracker login',
    );
  });

  it('warns about folders macOS guards, for the code and for the tracker CLI', () => {
    const cli = '/Users/dara/Documents/tracker/apps/agent/dist/cli.js';
    expect(privacyNote(['/Users/dara/code/app', cli], '/Users/dara')).toContain('Documents');
    expect(privacyNote(['/Users/dara/Desktop/app', '/opt/cli.js'], '/Users/dara')).toContain(
      'Desktop',
    );
    expect(privacyNote(['/Users/dara/code/app', '/opt/cli.js'], '/Users/dara')).toBeUndefined();
    expect(privacyNote(['/Users/dara/Documentsx/app'], '/Users/dara')).toBeUndefined();
  });
});
