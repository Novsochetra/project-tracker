import type { QueryClient } from '@tanstack/react-query';
import { projectOfTicket } from './queryKeys';

export interface MutationTargets {
  projectKey?: string;
  ticketKey?: string;
}

export interface BusyKeys {
  projectKeys: ReadonlySet<string>;
  ticketKeys: ReadonlySet<string>;
}

function readKey(variables: unknown, field: 'projectKey' | 'ticketKey'): string | undefined {
  if (typeof variables !== 'object' || variables === null) return undefined;
  const value: unknown = (variables as Record<string, unknown>)[field];

  return typeof value === 'string' && value ? value.toUpperCase() : undefined;
}

export function targetsOf(variables: unknown): MutationTargets {
  const ticketKey = readKey(variables, 'ticketKey');
  const projectKey =
    readKey(variables, 'projectKey') ?? (ticketKey ? projectOfTicket(ticketKey) : undefined);

  return { projectKey, ticketKey };
}

function manyTicketKeys(variables: unknown): string[] {
  if (typeof variables !== 'object' || variables === null) return [];

  const keys: unknown = (variables as Record<string, unknown>).ticketKeys;
  if (!Array.isArray(keys)) return [];

  return keys
    .filter((key): key is string => typeof key === 'string' && key !== '')
    .map((key) => key.toUpperCase());
}

const sameTargets = (left: MutationTargets, right: MutationTargets): boolean =>
  left.projectKey === right.projectKey && left.ticketKey === right.ticketKey;

// A mutation still counts as pending inside its own callbacks, so a settling mutation passes
// its variables to leave itself out and only other pending work keeps a key busy.
export function busyKeys(queryClient: QueryClient, settling?: unknown): BusyKeys {
  const pending = queryClient
    .getMutationCache()
    .findAll({ status: 'pending' })
    .map((mutation) => mutation.state.variables);
  const targets = pending.map(targetsOf);
  if (settling !== undefined) {
    const own = targetsOf(settling);
    const index = targets.findIndex((item) => sameTargets(item, own));
    if (index >= 0) targets.splice(index, 1);
  }

  // A pending mutation keeps the very variables its callbacks get.
  const many = pending.filter((variables) => variables !== settling).flatMap(manyTicketKeys);
  const projectKeys = targets.flatMap(({ projectKey }) => (projectKey ? [projectKey] : []));
  const ticketKeys = targets.flatMap(({ ticketKey }) => (ticketKey ? [ticketKey] : []));

  return {
    projectKeys: new Set([...projectKeys, ...many.flatMap((key) => projectOfTicket(key) ?? [])]),
    ticketKeys: new Set([...ticketKeys, ...many]),
  };
}
