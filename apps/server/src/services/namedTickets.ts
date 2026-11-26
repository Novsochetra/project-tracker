import { formatTicketKey, parseTicketKey } from '@tracker/shared';
import type { UserScope } from '../auth/scope';
import type { Db, ProjectRow, StatusRow, TicketRow } from '../db/schema';
import { listStatusRows } from '../repositories/statuses';
import { listTicketsByNums } from '../repositories/tickets';
import { findProject } from './lookups';

export interface NamedTicket<T> {
  key: string;
  projectKey: string;
  num: number;
  value: T;
}

export interface NamedTickets<T> {
  // Each key once, in the order given; one that can't name a ticket stays as it was written.
  order: string[];
  named: NamedTicket<T>[];
}

// "mob-3" and "MOB-03" name the same ticket, which is read once, for the first of them.
export function nameTickets<T>(values: readonly T[], keyOf: (value: T) => string): NamedTickets<T> {
  const seen = new Set<string>();
  const named: NamedTicket<T>[] = [];
  for (const value of values) {
    const parsed = parseTicketKey(keyOf(value));
    const key = parsed ? formatTicketKey(parsed.projectKey, parsed.num) : keyOf(value);
    if (seen.has(key)) continue;

    seen.add(key);
    if (parsed) named.push({ key, ...parsed, value });
  }

  return { order: [...seen], named };
}

export interface ProjectTickets {
  project: ProjectRow;
  statuses: StatusRow[];
  tickets: TicketRow[];
}

function numsByProject(named: readonly NamedTicket<unknown>[]): Map<string, number[]> {
  const groups = new Map<string, number[]>();
  for (const { projectKey, num } of named) {
    const nums = groups.get(projectKey) ?? [];
    nums.push(num);
    groups.set(projectKey, nums);
  }

  return groups;
}

// One read for each project rather than each key. A project the caller can't reach reads as one
// that doesn't exist, so its tickets are left out like tickets that were never made.
export async function findNamedTickets(
  db: Db,
  scope: UserScope,
  named: readonly NamedTicket<unknown>[],
): Promise<ProjectTickets[]> {
  const found: ProjectTickets[] = [];
  for (const [projectKey, nums] of numsByProject(named)) {
    const project = await findProject(db, scope, projectKey);
    if (!project) continue;

    const statuses = await listStatusRows(db, project.id);
    found.push({ project, statuses, tickets: await listTicketsByNums(db, project.id, nums) });
  }

  return found;
}
