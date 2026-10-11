import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabase } from '../../src/db/createDatabase';
import { describeDatabase } from '../../src/db/migrationCommands';

// Reviewer 134 (PT-151): with the scheme mistyped past postgres: (or lost) and no slash after it,
// looksLikeUrl took the value for a SQLite path, so it was printed with its password. Reviewer
// PT-151/152: so was one percent-encoded, as copied from a query string or a log.
describe.each([
  'postgre:admin:Sup3rSecretPW@db.example.com:5432/railway',
  'admin:Sup3rSecretPW@db.example.com:5432/railway',
  encodeURIComponent('postgresql://postgres:Sup3rSecretPW@db.example.com:5432/railway'),
  'admin:Sup3rSecretPW%40db.example.com/railway',
  'pgsql:admin:Sup3rSecretPW%40db.example.com:5432/railway',
  'admin%3aSup3rSecretPW@db.example.com/railway',
])('a DATABASE_URL holding user:password@ as %s', (url) => {
  const home = process.cwd();
  let dir = '';

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'mistyped-scheme-'));
    process.chdir(dir);
  });

  afterAll(() => {
    process.chdir(home);
    rmSync(dir, { recursive: true, force: true });
  });

  it('is never printed', () => {
    expect(describeDatabase(url)).not.toContain('Sup3rSecretPW');
  });

  it('is refused without making a folder', () => {
    const open = () => createDatabase(url);
    expect(open).toThrow(/DATABASE_URL/);
    expect(open).not.toThrow(/Sup3rSecretPW/);
    expect(readdirSync(dir)).toEqual([]);
  });
});

// Reviewer PT-151/152: a real path refused for this was told only to start with postgres://.
describe('a file path holding a colon followed by an @', () => {
  it('is refused, saying a path can’t hold one', () => {
    expect(() => createDatabase('data/run:2@night.db')).toThrow(
      /file path can’t hold a colon followed by an @/,
    );
  });
});
