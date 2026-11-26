import { containsPattern, LIKE_ESCAPE, type KeyQuery, type StatusCategory } from '@tracker/shared';
import { sql, type Expression, type ExpressionBuilder, type SqlBool } from 'kysely';
import type { UserScope } from '../auth/scope';
import type { Database, Db } from '../db/schema';
import { lowerFunction } from '../db/unicodeLower';
import { ownedBy } from './projects';

export interface TicketSearch {
  // As typed: the database lowercases them, as it does the columns.
  words: readonly string[];
  key: KeyQuery | null;
  limit: number;
}

export interface TicketSearchRow {
  id: string;
  projectId: string;
  projectKey: string;
  num: number;
  title: string;
  description: string;
  statusId: string;
  statusName: string;
  statusCategory: StatusCategory;
  statusColor: string;
  updatedAt: number;
}

type SearchBuilder = ExpressionBuilder<Database, 'tickets' | 'projects' | 'statuses'>;
type Column = 'tickets.title' | 'tickets.description';

// Postgres LIKE is case-sensitive, so both sides go through the same lower(), on SQLite one that
// knows accented capitals (unicodeLower.ts).
interface TextSearch {
  words: readonly string[];
  lower: ReturnType<typeof lowerFunction>;
}

const contains = (
  eb: SearchBuilder,
  { lower }: TextSearch,
  column: Column,
  word: string,
): Expression<SqlBool> => {
  const fn = sql.raw(lower);

  return sql<SqlBool>`${fn}(${eb.ref(column)}) like ${fn}(${containsPattern(word)}) escape ${LIKE_ESCAPE}`;
};

const inTitle = (eb: SearchBuilder, text: TextSearch) =>
  eb.and(text.words.map((word) => contains(eb, text, 'tickets.title', word)));

const inText = (eb: SearchBuilder, text: TextSearch) =>
  eb.and(
    text.words.map((word) =>
      eb.or([
        contains(eb, text, 'tickets.title', word),
        contains(eb, text, 'tickets.description', word),
      ]),
    ),
  );

function keyHit(eb: SearchBuilder, key: KeyQuery | null): Expression<SqlBool> {
  if (key === null) return eb.lit(false);
  const num = eb('tickets.num', '=', key.num);
  if (key.projectKey === null) return num;

  return eb.and([num, eb(eb.fn('upper', ['projects.key']), '=', key.projectKey)]);
}

function matches(eb: SearchBuilder, search: TicketSearch, text: TextSearch): Expression<SqlBool> {
  if (search.words.length === 0 && search.key === null) return eb.lit(true);
  const textHit = search.words.length === 0 ? [] : [inText(eb, text)];

  return eb.or([keyHit(eb, search.key), ...textHit]);
}

// Key hits first, then tickets with every word in the title, then the rest; newest first in each.
const rankOf = (eb: SearchBuilder, search: TicketSearch, text: TextSearch) =>
  eb
    .case()
    .when(keyHit(eb, search.key))
    .then(0)
    .when(search.words.length === 0 ? eb.lit(false) : inTitle(eb, text))
    .then(1)
    .else(2)
    .end();

export async function searchTicketRows(
  db: Db,
  scope: UserScope,
  search: TicketSearch,
): Promise<TicketSearchRow[]> {
  const text: TextSearch = { words: search.words, lower: lowerFunction(db) };
  const rows = await db
    .selectFrom('tickets')
    .innerJoin('projects', 'projects.id', 'tickets.projectId')
    .innerJoin('statuses', 'statuses.id', 'tickets.statusId')
    .where(ownedBy(scope))
    .where((eb) => matches(eb, search, text))
    .select([
      'tickets.id',
      'tickets.projectId',
      'projects.key as projectKey',
      'tickets.num',
      'tickets.title',
      'tickets.statusId',
      'statuses.name as statusName',
      'statuses.category as statusCategory',
      'statuses.color as statusColor',
      'tickets.updatedAt',
    ])
    // Only a match needs a snippet; a list of recent tickets leaves the long text unread.
    .select((eb) =>
      search.words.length > 0
        ? eb.ref('tickets.description').as('description')
        : sql<string>`''`.as('description'),
    )
    .orderBy((eb) => rankOf(eb, search, text))
    .orderBy('tickets.updatedAt', 'desc')
    .orderBy('tickets.id')
    .limit(search.limit)
    .execute();

  return rows.map((row) => ({ ...row, num: Number(row.num), updatedAt: Number(row.updatedAt) }));
}
