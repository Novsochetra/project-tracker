import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabase } from '../../src/db/createDatabase';
import { describeDatabase } from '../../src/db/migrationCommands';

// PT-137 took any value starting with letters or digits and a colon for a URL scheme, so a SQLite
// file name holding a colon, which opened before, was refused unless a folder came first.
describe('a DATABASE_URL that is a file name holding a colon', () => {
  const home = process.cwd();
  let dir = '';

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'colon-file-name-'));
    process.chdir(dir);
  });

  afterAll(() => {
    process.chdir(home);
    rmSync(dir, { recursive: true, force: true });
  });

  it.each(['tracker-10:30.db', 'backup:2026.db'])('opens as a SQLite file (%s)', async (name) => {
    expect(describeDatabase(name)).toBe(`SQLite ${name}`);
    const db = createDatabase(name);
    await sql`select 1`.execute(db);
    await db.destroy();
    expect(readdirSync(dir)).toContain(name);
  });
});
