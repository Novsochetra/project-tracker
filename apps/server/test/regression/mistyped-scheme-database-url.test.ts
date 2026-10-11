import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabase } from '../../src/db/createDatabase';
import { describeDatabase } from '../../src/db/migrationCommands';

// Reviewer 134 (PT-151): with the scheme mistyped past postgres: (or lost) and no slash after it,
// looksLikeUrl took the value for a SQLite path, so it was printed with its password.
describe.each([
  'postgre:admin:Sup3rSecretPW@db.example.com:5432/railway',
  'admin:Sup3rSecretPW@db.example.com:5432/railway',
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
