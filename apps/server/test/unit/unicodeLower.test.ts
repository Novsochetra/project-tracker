import { sql } from 'kysely';
import { describe, expect, it } from 'vitest';
import { createDatabase } from '../../src/db/createDatabase';
import { lowerFunction, unicodeLower } from '../../src/db/unicodeLower';

describe('unicodeLower', () => {
  it('lowercases accented capitals as JavaScript does and passes other values through', () => {
    expect(unicodeLower('ÉTÉ Ça ÖL')).toBe('été ça öl');
    expect(unicodeLower(null)).toBeNull();
    expect(unicodeLower(42)).toBe(42);
  });

  it('is unicode_lower on SQLite, next to its own lower()', async () => {
    const db = createDatabase(':memory:');
    expect(lowerFunction(db)).toBe('unicode_lower');
    const { rows } = await sql<{ mine: string; own: string }>`
      select unicode_lower('Été') as mine, lower('Été') as own`.execute(db);
    expect(rows).toEqual([{ mine: 'été', own: 'Été' }]);
    await db.destroy();
  });

  // The pool connects at its first query, so no server is needed.
  it('is lower on Postgres', async () => {
    const db = createDatabase('postgres://tracker@localhost:1/none', {});
    expect(lowerFunction(db)).toBe('lower');
    await db.destroy();
  });
});
