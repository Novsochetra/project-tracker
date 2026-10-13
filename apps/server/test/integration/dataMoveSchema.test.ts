import { describe, expect, it } from 'vitest';
import { COPIED_TABLES, SKIPPED_TABLES } from '../../src/dataMove/tables';
import { portableSchema } from '../helpers/schemaShape';
import { createTestDatabase, DIALECTS } from '../helpers/server';

// The schema names tables as the database does; the move as Kysely's camel-case plugin does.
const snakeCase = (name: string) => name.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

const referencedTables = (foreignKeys: string[]) =>
  [...new Set(foreignKeys.map((key) => /-> (\w+)\./.exec(key)?.[1]))].sort();

// A table a later migration adds must be copied by the move or left out on purpose.
describe.each(DIALECTS)('the tables the data move copies (%s)', (dialect) => {
  it('are every table but sign-in, with the foreign keys the schema has', async () => {
    const db = await createTestDatabase(dialect);
    try {
      const schema = await portableSchema(db, dialect);
      const copied = COPIED_TABLES.map((table) => snakeCase(table.name));

      expect(Object.keys(schema).sort()).toEqual(
        [...copied, ...Object.keys(SKIPPED_TABLES)].sort(),
      );
      for (const table of COPIED_TABLES) {
        const leftBehind: readonly string[] = 'leftBehind' in table ? table.leftBehind : [];
        expect(referencedTables(schema[snakeCase(table.name)]!.foreignKeys)).toEqual(
          [...table.references, ...leftBehind].sort(),
        );
      }
    } finally {
      await db.destroy();
    }
  });
});
