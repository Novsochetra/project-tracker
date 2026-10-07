import type { QueryClient } from '@tanstack/react-query';

// Screens for a deleted project or ticket stay mounted while they animate away; remembering the
// keys stops live refreshes from refetching them into 404s. Keyed by QueryClient so tests stay isolated.
const registry = new WeakMap<QueryClient, Set<string>>();

function keysOf(queryClient: QueryClient): Set<string> {
  const existing = registry.get(queryClient);
  if (existing) return existing;
  const created = new Set<string>();
  registry.set(queryClient, created);
  return created;
}

export function markDeleted(queryClient: QueryClient, key: string): void {
  keysOf(queryClient).add(key.toUpperCase());
}

export function forgetDeleted(queryClient: QueryClient, projectKey: string): void {
  const prefix = projectKey.toUpperCase();
  const keys = keysOf(queryClient);
  for (const key of keys) {
    if (key === prefix || key.startsWith(`${prefix}-`)) keys.delete(key);
  }
}

export const isDeleted = (queryClient: QueryClient, key: string): boolean =>
  keysOf(queryClient).has(key.toUpperCase());
