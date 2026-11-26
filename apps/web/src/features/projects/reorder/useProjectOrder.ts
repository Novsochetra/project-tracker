import type { ProjectSummary } from '@tracker/shared';
import { errorMessage, useReorderProjects } from '../../../api';
import { useToast } from '../../../components';
import { useSavedOrder, type SavedOrder } from '../../statuses/useSavedOrder';

export function useProjectOrder(projects: readonly ProjectSummary[]): SavedOrder {
  const { mutate, error } = useReorderProjects();
  const { show } = useToast();

  return useSavedOrder(
    projects.map((project) => project.id),
    {
      mutate: (ids, onSettled) =>
        mutate(ids, {
          onSettled,
          onError: (failure) => show(errorMessage(failure), { kind: 'error' }),
        }),
      error,
    },
  );
}
