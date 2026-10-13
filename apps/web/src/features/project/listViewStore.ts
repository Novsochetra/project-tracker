import {
  ALL_TICKETS,
  hasLabel,
  resolveFilter,
  type Label,
  type Status,
  type Ticket,
  type TicketFilter,
} from '@tracker/shared';
import { useSyncExternalStore } from 'react';

export interface ListView {
  filter: TicketFilter;
  query: string;
  label: string | null;
}

export const DEFAULT_LIST_VIEW: ListView = { filter: ALL_TICKETS, query: '', label: null };

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

export const setListLabel = (projectKey: string, label: string | null): void =>
  update(projectKey, { label });

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

// The status a picked status tab shows: none on All, or once that status is deleted.
export const pickedStatus = <T extends Status>(view: ListView, statuses: readonly T[]) =>
  statuses.find((status) => status.id === view.filter);

// A label deleted while it was picked leaves its id behind; the list then shows every ticket.
export const pickedLabel = <T extends Pick<Label, 'id'>>(
  view: ListView,
  labels: readonly T[] = [],
) => labels.find((label) => label.id === view.label);

export function hidesNewTicket(
  view: ListView,
  statuses: readonly Status[],
  ticket: Pick<Ticket, 'statusId' | 'labelIds'>,
): boolean {
  const filter = resolveFilter(statuses, view.filter);
  const otherStatus = filter !== ALL_TICKETS && filter !== ticket.statusId;
  const otherLabel = view.label !== null && !hasLabel(ticket, view.label);
  return otherStatus || otherLabel || isSearching(view);
}
