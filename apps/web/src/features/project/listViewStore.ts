import { ALL_TICKETS, resolveFilter, type Status, type TicketFilter } from '@tracker/shared';
import { useSyncExternalStore } from 'react';

export interface ListView {
  filter: TicketFilter;
  query: string;
}

export const DEFAULT_LIST_VIEW: ListView = { filter: ALL_TICKETS, query: '' };

// Module state, so the New ticket sheet (rendered outside the screen) can read and reset it.
const views = new Map<string, ListView>();
const listeners = new Set<() => void>();

const canonical = (projectKey: string): string => projectKey.toUpperCase();
const emit = () => listeners.forEach((listener) => listener());

export const getListView = (projectKey: string): ListView =>
  views.get(canonical(projectKey)) ?? DEFAULT_LIST_VIEW;

function update(projectKey: string, patch: Partial<ListView>): void {
  views.set(canonical(projectKey), { ...getListView(projectKey), ...patch });
  emit();
}

export const setListFilter = (projectKey: string, filter: TicketFilter): void =>
  update(projectKey, { filter });

export const setListQuery = (projectKey: string, query: string): void =>
  update(projectKey, { query });

export function resetListView(projectKey: string): void {
  if (!views.delete(canonical(projectKey))) return;
  emit();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useListView = (projectKey: string): ListView =>
  useSyncExternalStore(
    subscribe,
    () => getListView(projectKey),
    () => DEFAULT_LIST_VIEW,
  );

export const isSearching = (view: ListView): boolean => view.query.trim() !== '';

export function hidesNewTicket(
  view: ListView,
  statuses: readonly Status[],
  statusId: string,
): boolean {
  const filter = resolveFilter(statuses, view.filter);
  return (filter !== ALL_TICKETS && filter !== statusId) || isSearching(view);
}
