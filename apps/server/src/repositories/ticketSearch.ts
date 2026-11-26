import { containsPattern, LIKE_ESCAPE, type KeyQuery, type StatusCategory } from '@tracker/shared';
import { sql, type Expression, type ExpressionBuilder, type SqlBool } from 'kysely';
import type { UserScope } from '../auth/scope';
import type { Database, Db } from '../db/schema';
import { ownedBy } from './projects';

export interface TicketSearch {
  terms: readonly string[];
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

// lower() on both sides: Postgres LIKE is case-sensitive, SQLite's only for non-ASCII letters.
const contains = (eb: SearchBuilder, column: Column, term: string): Expression<SqlBool> =>
  sql<SqlBool>`lower(${eb.ref(column)}) like ${containsPattern(term)} escape ${LIKE_ESCAPE}`;

const inTitle = (eb: SearchBuilder, terms: readonly string[]) =>
  eb.and(terms.map((term) => contains(eb, 'tickets.title', term)));

const inText = (eb: SearchBuilder, terms: readonly string[]) =>
  eb.and(
    terms.map((term) =>
      eb.or([contains(eb, 'tickets.title', term), contains(eb, 'tickets.description', term)]),
    ),
  );

function keyHit(eb: SearchBuilder, key: KeyQuery | null): Expression<SqlBool> {
  if (key === null) return eb.lit(false);
  const num = eb('tickets.num', '=', key.num);
  if (key.projectKey === null) return num;
  return eb.and([num, eb(eb.fn('upper', ['projects.key']), '=', key.projectKey)]);
}

function matches(eb: SearchBuilder, search: TicketSearch): Expression<SqlBool> {
  if (search.terms.length === 0 && search.key === null) return eb.lit(true);
  const text = search.terms.length === 0 ? [] : [inText(eb, search.terms)];
  return eb.or([keyHit(eb, search.key), ...text]);
}

// Key hits first, then tickets with every word in the title, then the rest; newest first in each.
const rankOf = (eb: SearchBuilder, search: TicketSearch) =>
  eb
    .case()
    .when(keyHit(eb, search.key))
    .then(0)
    .when(search.terms.length === 0 ? eb.lit(false) : inTitle(eb, search.terms))
    .then(1)
    .else(2)
    .end();

export async function searchTicketRows(
  db: Db,
  scope: UserScope,
  search: TicketSearch,
): Promise<TicketSearchRow[]> {
  const rows = await db
    .selectFrom('tickets')
    .innerJoin('projects', 'projects.id', 'tickets.projectId')
    .innerJoin('statuses', 'statuses.id', 'tickets.statusId')
    .where(ownedBy(scope))
    .where((eb) => matches(eb, search))
    .select([
      'tickets.id',
      'tickets.projectId',
      'projects.key as projectKey',
      'tickets.num',
      'tickets.title',
      'tickets.description',
      'tickets.statusId',
      'statuses.name as statusName',
      'statuses.category as statusCategory',
      'statuses.color as statusColor',
      'tickets.updatedAt',
    ])
    .orderBy((eb) => rankOf(eb, search))
    .orderBy('tickets.updatedAt', 'desc')
    .orderBy('tickets.id')
    .limit(search.limit)
    .execute();
  return rows.map((row) => ({ ...row, num: Number(row.num), updatedAt: Number(row.updatedAt) }));
}
