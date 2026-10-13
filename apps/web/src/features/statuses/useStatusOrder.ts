import type { Status } from '@tracker/shared';
import { useReorderStatuses } from '../../api';
import { useSavedOrder, type SavedOrder } from './useSavedOrder';

export function useStatusOrder(projectKey: string, statuses: readonly Status[]): SavedOrder {
  const { mutate, error } = useReorderStatuses();
  return useSavedOrder(
    statuses.map((status) => status.id),
    { mutate: (ids, onSettled) => mutate({ projectKey, ids }, { onSettled }), error },
  );
}
