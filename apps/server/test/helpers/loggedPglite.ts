import { PGlite, type Transaction } from '@electric-sql/pglite';
import { CamelCasePlugin, Kysely, PGliteDialect } from 'kysely';
import { migrateToLatest } from '../../src/db/migrator';
import type { Database } from '../../src/db/schema';
import { StripNulPlugin } from '../../src/db/stripNul';

// PGlite runs one query at a time, so lock order can't race in a test; a log of every statement,
// with "begin" and "commit" around a transaction's, shows the order the locks are taken in.
export async function loggedPglite(sql: string[]): Promise<Kysely<Database>> {
  const pglite = new PGlite({ parsers: { 20: Number } });
  const logged = <T extends Pick<PGlite, 'query'>>(target: T): T => {
    const query = target.query.bind(target);
    target.query = ((text: string, ...rest: unknown[]) => {
      sql.push(text);
      return query(text, ...(rest as []));
    }) as T['query'];
    return target;
  };
  logged(pglite);
  // Kysely's PGlite driver runs a transaction's queries on PGlite's own transaction object.
  const transaction = pglite.transaction.bind(pglite);
  pglite.transaction = (async (work: (tx: Transaction) => Promise<unknown>) =>
    transaction(async (tx) => {
      sql.push('begin');
      try {
        return await work(logged(tx));
      } finally {
        sql.push('commit');
      }
    })) as PGlite['transaction'];
  const db = new Kysely<Database>({
    dialect: new PGliteDialect({ pglite }),
    plugins: [new CamelCasePlugin(), new StripNulPlugin()],
  });
  await migrateToLatest(db);
  return db;
}

export const firstIndex = (sql: readonly string[], pattern: RegExp): number =>
  sql.findIndex((text) => pattern.test(text));

// Both statements ran, in this order, in one transaction.
export function inOrderInOneTransaction(sql: readonly string[], first: RegExp, then: RegExp) {
  const a = firstIndex(sql, first);
  const b = firstIndex(sql, then);
  const begin = sql.lastIndexOf('begin', a);
  return a > -1 && b > a && begin > -1 && !sql.slice(begin, b).includes('commit');
}
