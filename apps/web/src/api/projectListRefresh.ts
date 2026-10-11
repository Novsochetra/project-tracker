import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from './queryKeys';

const LIST = { queryKey: queryKeys.projects(), exact: true };
const waiting = new WeakSet<QueryClient>();

// A change can land after a read on its way began, so that read may miss it; one read after it
// covers every change asked about meanwhile. Each refresher cancelling and reading again sent 4
// project list reads within 40 ms of one recovery (PT-154).
export function refreshProjectList(queryClient: QueryClient): void {
  if (queryClient.getQueryState(LIST.queryKey)?.fetchStatus !== 'fetching') {
    void queryClient.invalidateQueries(LIST);
    return;
  }
  if (waiting.has(queryClient)) return;
  waiting.add(queryClient);
  void queryClient.refetchQueries(LIST, { cancelRefetch: false }).finally(() => {
    waiting.delete(queryClient);
    void queryClient.invalidateQueries(LIST, { cancelRefetch: false });
  });
}
