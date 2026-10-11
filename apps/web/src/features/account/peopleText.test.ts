import { describe, expect, it } from 'vitest';
import { personDetails, personName, resetLinkFor } from './peopleText';

const SAM = { id: 'u', name: 'Sam', email: 'sam@example.com', createdAt: 0, resetExpiresAt: null };

describe('resetLinkFor', () => {
  it('keeps the secret after #, so it never reaches a server log', () => {
    expect(resetLinkFor('s3cr3t', 'https://tracker.example.com')).toBe(
      'https://tracker.example.com/reset-password#s3cr3t',
    );
  });
});

describe('personName', () => {
  it('is the name, or the email for an account without one', () => {
    expect(personName(SAM)).toBe('Sam');
    expect(personName({ ...SAM, name: ' ' })).toBe('sam@example.com');
  });
});

describe('personDetails', () => {
  it('says until when an open reset link works', () => {
    expect(personDetails(SAM)).toBe('sam@example.com');
    const until = new Date(2026, 9, 12, 12).getTime();
    expect(personDetails({ ...SAM, resetExpiresAt: until })).toBe(
      'sam@example.com · Reset link works until Oct 12, 2026',
    );
  });
});
