import type { Project, TicketListItem } from '@tracker/shared';

export interface ReadyItem {
  ticket: TicketListItem;
  project: Project;
}

// A deleted project leaves the project list at once, before the ready list refetches.
export function readyItems(
  tickets: readonly TicketListItem[],
  projects: readonly Project[],
): ReadyItem[] {
  const byId = new Map(projects.map((project) => [project.id, project]));
  return tickets.flatMap((ticket) => {
    const project = byId.get(ticket.projectId);
    return project ? [{ ticket, project }] : [];
  });
}

export function readyCounts(items: readonly ReadyItem[]): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const { project } of items) counts.set(project.id, (counts.get(project.id) ?? 0) + 1);
  return counts;
}
