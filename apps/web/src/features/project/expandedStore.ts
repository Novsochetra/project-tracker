import { useSyncExternalStore } from 'react';

// Kept in memory for the session, per project and status (SPEC §7.3).
const expanded = new Set<string>();
const listeners = new Set<() => void>();

const groupKey = (projectKey: string, statusId: string): string =>
  `${projectKey.toUpperCase()}|${statusId}`;

const emit = () => listeners.forEach((listener) => listener());

export const isExpanded = (projectKey: string, statusId: string): boolean =>
  expanded.has(groupKey(projectKey, statusId));

export function toggleExpanded(projectKey: string, statusId: string): void {
  const key = groupKey(projectKey, statusId);
  if (!expanded.delete(key)) expanded.add(key);
  emit();
}

export function expandGroup(projectKey: string, statusId: string): void {
  const key = groupKey(projectKey, statusId);
  if (expanded.has(key)) return;
  expanded.add(key);
  emit();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useIsExpanded = (projectKey: string, statusId: string): boolean =>
  useSyncExternalStore(
    subscribe,
    () => isExpanded(projectKey, statusId),
    () => false,
  );
