import { describe, expect, it } from 'vitest';
import { inviteDetails, inviteLinkFor } from './inviteText';

describe('inviteLinkFor', () => {
  it('keeps the secret after #, so it never reaches a server log', () => {
    expect(inviteLinkFor('s3cr3t', 'https://tracker.example.com')).toBe(
      'https://tracker.example.com/invite#s3cr3t',
    );
  });
});

describe('inviteDetails', () => {
  it('says when the link was made and until when it works', () => {
    const made = new Date(2026, 9, 11, 12).getTime();
    const until = new Date(2026, 9, 18, 12).getTime();
    expect(inviteDetails({ id: 'i', createdAt: made, expiresAt: until })).toBe(
      'Made Oct 11, 2026 · Works until Oct 18, 2026',
    );
  });
});
