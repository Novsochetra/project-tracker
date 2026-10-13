import type { Label } from '@tracker/shared';
import { useReorderLabels } from '../../api/hooks/labels';
import { useSavedOrder, type SavedOrder } from '../statuses/useSavedOrder';

export function useLabelOrder(projectKey: string, labels: readonly Label[]): SavedOrder {
  const { mutate, error } = useReorderLabels();
  return useSavedOrder(
    labels.map((label) => label.id),
    { mutate: (ids, onSettled) => mutate({ projectKey, ids }, { onSettled }), error },
  );
}
