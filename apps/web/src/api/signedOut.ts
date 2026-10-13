import { hashKey, type QueryClient } from '@tanstack/react-query';
import type { SessionState } from '@tracker/shared';
import { forgetDevicePush } from '../pwa/forgetDevicePush';
import { forgetSavedAnswers } from '../pwa/forgetSavedAnswers';
import { queryKeys, rootOf } from './queryKeys';

const SESSION_HASH = hashKey(queryKeys.session());

export const isSignedOut = (session: SessionState | undefined): boolean =>
  session !== undefined && session.authRequired && !session.authenticated;

const notSession = ({ queryKey }: { queryKey: readonly unknown[] }) =>
  rootOf(queryKey) !== 'session';

// Drops what was read while signed in: the service worker's caches and the answers no screen
// shows. Screens still open let theirs go once the sign-in screen replaces them; removing those
// now would make them read again, get refused and sign out once more. The device's push
// subscription goes too, so nobody's notifications reach whoever holds the phone next.
export async function forgetSignedInData(
  queryClient: QueryClient,
  session: SessionState,
): Promise<void> {
  queryClient.removeQueries({ type: 'inactive', predicate: notSession });
  await Promise.all([forgetSavedAnswers(session), forgetDevicePush()]);
}

// However the app learns it is signed out (signing out, a 401, a session check), it forgets.
export function watchSignedOut(queryClient: QueryClient): () => void {
  return queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== 'updated' || event.query.queryHash !== SESSION_HASH) return;
    if (event.action.type !== 'success') return;
    const session = event.query.state.data as SessionState | undefined;
    if (session && isSignedOut(session)) void forgetSignedInData(queryClient, session);
  });
}
