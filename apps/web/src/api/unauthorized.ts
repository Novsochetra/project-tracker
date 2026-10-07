import { hashKey, type QueryClient } from '@tanstack/react-query';
import type { SessionState } from '@tracker/shared';
import { isUnauthorized } from './errors';
import { queryKeys } from './queryKeys';

export const SIGNED_OUT: SessionState = { authRequired: true, authenticated: false };

const SESSION_HASH = hashKey(queryKeys.session());

export function watchUnauthorized(queryClient: QueryClient): () => void {
  const check = (error: unknown) => {
    if (isUnauthorized(error)) queryClient.setQueryData(queryKeys.session(), SIGNED_OUT);
  };
  const stopQueries = queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== 'updated' || event.action.type !== 'error') return;
    if (event.query.queryHash !== SESSION_HASH) check(event.action.error);
  });
  const stopMutations = queryClient.getMutationCache().subscribe((event) => {
    if (event.type === 'updated' && event.action.type === 'error') check(event.action.error);
  });
  return () => {
    stopQueries();
    stopMutations();
  };
}
