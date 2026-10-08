import type { QueryClient, QueryKey } from '@tanstack/react-query';
import { isDeleted } from './deleted';
import { busyKeys, targetsOf, type BusyKeys } from './pending';
import { projectOfQuery, queryKeys, rootOf, scopeOf } from './queryKeys';

export interface SettleOptions {
  withTickets?: boolean;
}

export function isRefreshable(
  queryClient: QueryClient,
  queryKey: QueryKey,
  busy: BusyKeys,
): boolean {
  // Any ticket's move may have taken it off the ready list, which a refetch would undo.
  if (rootOf(queryKey) === 'ready') return busy.ticketKeys.size === 0;
  const scope = scopeOf(queryKey);
  if (!scope) return true;
  const projectKey = projectOfQuery(queryKey);
  if (projectKey && isDeleted(queryClient, projectKey)) return false;
  if (rootOf(queryKey) === 'ticket') {
    return !busy.ticketKeys.has(scope) && !isDeleted(queryClient, scope);
  }
  if (rootOf(queryKey) === 'project') return !busy.projectKeys.has(scope);
  return true;
}

function refreshProject(
  queryClient: QueryClient,
  projectKey: string,
  busy: BusyKeys,
  options: SettleOptions,
): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.projects(), exact: true });
  if (isRefreshable(queryClient, queryKeys.ready(), busy)) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.ready(), exact: true });
  }
  if (busy.projectKeys.has(projectKey) || isDeleted(queryClient, projectKey)) return;
  void queryClient.invalidateQueries({ queryKey: queryKeys.project(projectKey) });
  if (!options.withTickets) return;
  void queryClient.invalidateQueries({
    predicate: ({ queryKey }) =>
      rootOf(queryKey) === 'ticket' &&
      projectOfQuery(queryKey) === projectKey &&
      isRefreshable(queryClient, queryKey, busy),
  });
}

// Runs from onSettled. Waiting until no other mutation touches the same ticket or project avoids
// a refetch that would undo that mutation's optimistic state; the last one to settle refreshes.
export function settleMutation(
  queryClient: QueryClient,
  variables: unknown,
  options: SettleOptions = {},
): void {
  const { projectKey, ticketKey } = targetsOf(variables);
  const busy = busyKeys(queryClient, variables);
  if (ticketKey && !busy.ticketKeys.has(ticketKey) && !isDeleted(queryClient, ticketKey)) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.ticket(ticketKey) });
  }
  if (projectKey) refreshProject(queryClient, projectKey, busy, options);
}

export function refreshPeople(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.people(), exact: true });
}
