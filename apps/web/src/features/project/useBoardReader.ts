import { useQueryClient } from '@tanstack/react-query';
import type { ProjectBoard } from '@tracker/shared';
import { useCallback } from 'react';
import { queryKeys } from '../../api';

/**
 * Reads the board from the cache at event time. Optimistic moves land in the cache before React
 * re-renders, so quick repeated drops and arrow presses plan from the latest order.
 */
export function useBoardReader(projectKey: string): () => ProjectBoard | undefined {
  const queryClient = useQueryClient();
  return useCallback(
    () => queryClient.getQueryData<ProjectBoard>(queryKeys.board(projectKey)),
    [queryClient, projectKey],
  );
}
