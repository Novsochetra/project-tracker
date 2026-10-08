import type { QueryKey } from '@tanstack/react-query';
import type { ChangeEvent } from '@tracker/shared';
import { isRecord } from '../../lib/isRecord';
import { rootOf, scopeOf } from '../queryKeys';

export interface CachedEntry {
  queryKey: QueryKey;
  data: unknown;
}

export interface ChangeScope {
  all: boolean;
  projectKeys: ReadonlySet<string>;
  ticketKeys: ReadonlySet<string>;
}

interface Ref {
  id: string;
  key: string;
  projectId: string | null;
}

interface CacheIndex {
  projectKeys: Map<string, string>;
  tickets: Map<string, Ref>;
}

export const EVERYTHING: ChangeScope = { all: true, projectKeys: new Set(), ticketKeys: new Set() };

const INDEXED_ROOTS = new Set<unknown>(['projects', 'project', 'ticket']);

function refOf(value: unknown): Ref[] {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.key !== 'string') return [];
  const projectId = typeof value.projectId === 'string' ? value.projectId : null;
  return [{ id: value.id, key: value.key.toUpperCase(), projectId }];
}

const refsOf = (values: unknown): Ref[] => (Array.isArray(values) ? values.flatMap(refOf) : []);

function collect(data: unknown): { projects: Ref[]; tickets: Ref[] } {
  if (Array.isArray(data)) return { projects: refsOf(data), tickets: [] };
  if (!isRecord(data)) return { projects: [], tickets: [] };
  return {
    projects: refOf(data.project),
    tickets: [...refsOf(data.tickets), ...refOf(data.ticket)],
  };
}

function indexCache(entries: readonly CachedEntry[]): CacheIndex {
  const index: CacheIndex = { projectKeys: new Map(), tickets: new Map() };
  for (const entry of entries) {
    if (!INDEXED_ROOTS.has(rootOf(entry.queryKey))) continue;
    const { projects, tickets } = collect(entry.data);
    for (const project of projects) index.projectKeys.set(project.id, project.key);
    for (const ticket of tickets) index.tickets.set(ticket.id, ticket);
  }
  return index;
}

const ticketKeysIn = (index: CacheIndex, projectId: string | null): string[] =>
  [...index.tickets.values()]
    .filter((ticket) => projectId !== null && ticket.projectId === projectId)
    .map((ticket) => ticket.key);

export function changeScope(event: ChangeEvent, entries: readonly CachedEntry[]): ChangeScope {
  if (!event.projectId && !event.ticketId) return EVERYTHING;
  const index = indexCache(entries);
  const ticket = event.ticketId ? index.tickets.get(event.ticketId) : undefined;
  const projectId = event.projectId ?? ticket?.projectId ?? null;
  const projectKey = projectId ? index.projectKeys.get(projectId) : undefined;
  const ticketKeys = event.ticketId ? (ticket ? [ticket.key] : []) : ticketKeysIn(index, projectId);
  return {
    all: false,
    projectKeys: new Set(projectKey ? [projectKey] : []),
    ticketKeys: new Set(ticketKeys),
  };
}

export function isAffected(queryKey: QueryKey, scope: ChangeScope): boolean {
  const root = rootOf(queryKey);
  if (root === 'projects' || root === 'ready' || root === 'reportPreview') return true;
  if (root === 'people') return scope.all;
  const key = scopeOf(queryKey) ?? '';
  if (root === 'project') return scope.all || scope.projectKeys.has(key);
  if (root === 'ticket') return scope.all || scope.ticketKeys.has(key);
  return false;
}
