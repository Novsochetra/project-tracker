import {
  findStatusByCategory,
  type Project,
  type Status,
  type TicketListItem,
  type TicketsAcrossProjects,
} from '@tracker/shared';

export interface ReadyItem {
  ticket: TicketListItem;
  project: Project;
  doneStatus: Status | null;
  statusColor: string | undefined;
}

const NOTHING_READY: TicketsAcrossProjects = { tickets: [], statuses: [] };

// A deleted project leaves the project list at once, before the ready list refetches.
export function readyItems(
  list: TicketsAcrossProjects | undefined,
  projects: readonly Project[],
): ReadyItem[] {
  const { tickets, statuses } = list ?? NOTHING_READY;
  const byId = new Map(projects.map((project) => [project.id, project]));
  return tickets.flatMap((ticket) => {
    const project = byId.get(ticket.projectId);
    if (!project) return [];
    const own = statuses.filter((status) => status.projectId === project.id);
    return [
      {
        ticket,
        project,
        doneStatus: findStatusByCategory(own, 'done') ?? null,
        statusColor: own.find((status) => status.id === ticket.statusId)?.color,
      },
    ];
  });
}

export function readyCounts(items: readonly ReadyItem[]): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const { project } of items) counts.set(project.id, (counts.get(project.id) ?? 0) + 1);
  return counts;
}
