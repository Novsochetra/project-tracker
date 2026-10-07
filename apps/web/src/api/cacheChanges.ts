import type { ProjectBoard, TicketDetail } from '@tracker/shared';
import { cacheChange, type CacheChange } from './optimistic';
import { projectOfTicket, queryKeys } from './queryKeys';

export function boardChanges(
  ticketKey: string,
  update: (board: ProjectBoard) => ProjectBoard,
): CacheChange[] {
  const projectKey = projectOfTicket(ticketKey);
  return projectKey ? [cacheChange<ProjectBoard>(queryKeys.board(projectKey), update)] : [];
}

export const ticketChange = (
  ticketKey: string,
  update: (detail: TicketDetail) => TicketDetail,
): CacheChange => cacheChange<TicketDetail>(queryKeys.ticket(ticketKey), update);
