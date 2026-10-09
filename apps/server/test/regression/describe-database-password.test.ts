import { describe, expect, it } from 'vitest';
import { createDatabase } from '../../src/db/createDatabase';
import { describeDatabase } from '../../src/db/migrationCommands';

// db.js prints this first, in the pre-deploy log. A postgres:// URL that URL can't parse (a '#',
// '?' or '/' in an unencoded password, a port typo) was printed whole, password included, as SQLite.
describe('describeDatabase with a Postgres URL URL cannot parse', () => {
  it.each([
    'postgresql://postgres:pa#ss@db.example.com:5432/railway',
    'postgresql://postgres:Sup3rSecretPW@db.example.com:54x2/railway',
  ])('never prints the password (%s)', (url) => {
    const text = describeDatabase(url);
    expect(text).not.toContain('Sup3rSecretPW');
    expect(text).not.toContain('pa#ss');
    expect(text).not.toMatch(/^SQLite/);
  });
});

// Pasted with its quotes, the value isn't postgres:// at all and was printed whole as a SQLite path
// (db.js, and the server's "Tracker API on …" line).
describe('describeDatabase with a URL that is not postgres://', () => {
  it.each([
    '"postgresql://postgres:Sup3rSecretPW@db.example.com:5432/railway"',
    ' postgresql://postgres:Sup3rSecretPW@db.example.com:5432/railway',
    'mysql://root:Sup3rSecretPW@db.example.com/tracker',
  ])('never prints the password (%s)', (url) => {
    const text = describeDatabase(url);
    expect(text).not.toContain('Sup3rSecretPW');
    expect(text).not.toMatch(/^SQLite/);
  });

  it('still names a SQLite file', () => {
    expect(describeDatabase('/data/tracker.db')).toBe('SQLite /data/tracker.db');
    expect(describeDatabase(':memory:')).toBe('SQLite :memory:');
  });
});

// Off Railway the same value opened a SQLite file at a path holding the password, such as
// ./"postgresql:/postgres:<password>@host/railway, beside the app.
describe('createDatabase with a URL that is not postgres://', () => {
  it('refuses it without showing it', () => {
    const open = () =>
      createDatabase('"postgresql://postgres:Sup3rSecretPW@db.example.com:5432/railway"');
    expect(open).toThrow(/DATABASE_URL/);
    expect(open).not.toThrow(/Sup3rSecretPW/);
  });
});
