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

const sameTargets = (a: MutationTargets, b: MutationTargets): boolean =>
  a.projectKey === b.projectKey && a.ticketKey === b.ticketKey;

// A mutation still counts as pending inside its own callbacks, so a settling mutation passes
// its variables to leave itself out and only other pending work keeps a key busy.
export function busyKeys(queryClient: QueryClient, settling?: unknown): BusyKeys {
  const targets = queryClient
    .getMutationCache()
    .findAll({ status: 'pending' })
    .map((mutation) => targetsOf(mutation.state.variables));
  if (settling !== undefined) {
    const own = targetsOf(settling);
    const index = targets.findIndex((item) => sameTargets(item, own));
    if (index >= 0) targets.splice(index, 1);
  }
  return {
    projectKeys: new Set(targets.flatMap(({ projectKey }) => (projectKey ? [projectKey] : []))),
    ticketKeys: new Set(targets.flatMap(({ ticketKey }) => (ticketKey ? [ticketKey] : []))),
  };
}
