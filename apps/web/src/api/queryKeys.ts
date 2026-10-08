import type { QueryKey } from '@tanstack/react-query';
import { parseTicketKey } from '@tracker/shared';

// Keys are case-insensitive in URLs, so every cache entry uses the canonical uppercase form.
const canonical = (key: string): string => key.toUpperCase();

export const queryKeys = {
  projects: () => ['projects'] as const,
  ready: () => ['ready'] as const,
  project: (projectKey: string) => ['project', canonical(projectKey)] as const,
  board: (projectKey: string) => ['project', canonical(projectKey), 'board'] as const,
  projectPrompt: (projectKey: string) => ['project', canonical(projectKey), 'prompt'] as const,
  ticket: (ticketKey: string) => ['ticket', canonical(ticketKey)] as const,
  ticketPrompt: (ticketKey: string) => ['ticket', canonical(ticketKey), 'prompt'] as const,
  people: () => ['people'] as const,
  reportPreview: (text: string, ticketKey?: string) =>
    ['reportPreview', ticketKey ? canonical(ticketKey) : '', text] as const,
  session: () => ['session'] as const,
  meta: () => ['meta'] as const,
  attachmentText: (attachmentId: string) => ['attachmentText', attachmentId] as const,
};

export const rootOf = (queryKey: QueryKey): unknown => queryKey[0];

export const scopeOf = (queryKey: QueryKey): string | undefined =>
  typeof queryKey[1] === 'string' ? queryKey[1] : undefined;

export const projectOfTicket = (ticketKey: string): string | undefined =>
  parseTicketKey(ticketKey)?.projectKey;

export function projectOfQuery(queryKey: QueryKey): string | undefined {
  const scope = scopeOf(queryKey);
  if (!scope) return undefined;
  if (rootOf(queryKey) === 'project') return scope;
  return rootOf(queryKey) === 'ticket' ? projectOfTicket(scope) : undefined;
}

export const belongsToProject = (queryKey: QueryKey, projectKey: string): boolean =>
  projectOfQuery(queryKey) === canonical(projectKey);
