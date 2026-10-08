import type { ProjectBoard, TicketDetail, TicketsAcrossProjects } from '@tracker/shared';
import { withoutMovedTicket } from './cache/ready';
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

// Only status changes touch the ready list, so other edits don't cancel its refetches.
export const readyChanges = (ticketKey: string, statusId: string | undefined): CacheChange[] =>
  statusId === undefined
    ? []
    : [
        cacheChange<TicketsAcrossProjects>(queryKeys.ready(), (list) =>
          withoutMovedTicket(list, ticketKey, statusId),
        ),
      ];
