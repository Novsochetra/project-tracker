import { describe, expect, it } from 'vitest';
import { privacyNote, refuseTokenFromEnv } from '../../../src/watch/autostart/rules';

describe('install rules', () => {
  it('refuses a token from a variable the job will not have, and says to unset it', () => {
    const base = { url: 'https://t.example.com', token: 'trk_x', agentName: 'Claude' };
    expect(() => refuseTokenFromEnv({ ...base, tokenSource: 'tracker login' })).not.toThrow();
    expect(() => refuseTokenFromEnv({ ...base, token: undefined })).not.toThrow();
    expect(() => refuseTokenFromEnv({ ...base, tokenSource: 'TRACKER_API_TOKEN' })).toThrow(
      'The token comes from TRACKER_API_TOKEN. Unset it, run "tracker login --url https://t.example.com", then install again.',
    );
  });

  it('warns about folders macOS guards', () => {
    expect(privacyNote('/Users/dara/Documents/code/app', '/Users/dara')).toContain('Documents');
    expect(privacyNote('/Users/dara/code/app', '/Users/dara')).toBeUndefined();
    expect(privacyNote('/Users/dara/Documentsx/app', '/Users/dara')).toBeUndefined();
  });
});
