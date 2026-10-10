import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabase } from '../../src/db/createDatabase';
import { describeDatabase } from '../../src/db/migrationCommands';

const ONE_SLASH = 'postgresql:/postgres:Sup3rSecretPW@db.example.com:5432/railway';

// With one slash after its scheme the value has no ://, so off Railway it passed as a SQLite path:
// db.js printed it, password and all, and opening it made folders named after it beside the app.
describe('a DATABASE_URL with one slash after its scheme', () => {
  const home = process.cwd();
  let dir = '';

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'one-slash-url-'));
    process.chdir(dir);
  });

  afterAll(() => {
    process.chdir(home);
    rmSync(dir, { recursive: true, force: true });
  });

  it.each([ONE_SLASH, 'postgres:postgres:Sup3rSecretPW@db.example.com/railway'])(
    'is never printed (%s)',
    (url) => {
      const text = describeDatabase(url);
      expect(text).not.toContain('Sup3rSecretPW');
      expect(text).not.toMatch(/^SQLite/);
    },
  );

  it('is refused without making a folder', () => {
    const open = () => createDatabase(ONE_SLASH);
    expect(open).toThrow(/DATABASE_URL/);
    expect(open).not.toThrow(/Sup3rSecretPW/);
    expect(readdirSync(dir)).toEqual([]);
  });

  it('leaves file paths alone, a Windows drive letter too', () => {
    expect(describeDatabase('data/tracker.db')).toBe('SQLite data/tracker.db');
    expect(describeDatabase(':memory:')).toBe('SQLite :memory:');
    expect(describeDatabase('C:\\data\\tracker.db')).toBe('SQLite C:\\data\\tracker.db');
  });
});
