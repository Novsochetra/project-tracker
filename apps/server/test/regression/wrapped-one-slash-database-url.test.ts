import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabase } from '../../src/db/createDatabase';
import { describeDatabase } from '../../src/db/migrationCommands';

const ONE_SLASH = 'postgresql:/postgres:Sup3rSecretPW@db.example.com:5432/railway';

// Two slips at once: PT-137 looked for the scheme only at the very start, so a one-slash URL with
// quotes, a space or its name in front passed off Railway as a SQLite path, printed with its
// password and made folders named after it.
describe.each([`"${ONE_SLASH}"`, ` ${ONE_SLASH}`, `DATABASE_URL=${ONE_SLASH}`])(
  'a one-slash DATABASE_URL pasted as %s',
  (url) => {
    const home = process.cwd();
    let dir = '';

    beforeAll(() => {
      dir = mkdtempSync(join(tmpdir(), 'wrapped-one-slash-'));
      process.chdir(dir);
    });

    afterAll(() => {
      process.chdir(home);
      rmSync(dir, { recursive: true, force: true });
    });

    it('is never printed', () => {
      const text = describeDatabase(url);
      expect(text).not.toContain('Sup3rSecretPW');
      expect(text).not.toMatch(/^SQLite/);
    });

    it('is refused without making a folder', () => {
      const open = () => createDatabase(url);
      expect(open).toThrow(/DATABASE_URL/);
      expect(open).not.toThrow(/Sup3rSecretPW/);
      expect(readdirSync(dir)).toEqual([]);
    });
  },
);
