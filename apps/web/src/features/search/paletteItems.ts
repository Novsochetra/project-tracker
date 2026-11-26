import { parseKeyQuery, type ProjectSummary, type TicketSearchHit } from '@tracker/shared';
import type { Route } from '../../navigation';
import { matchProjects } from './projectMatches';
import { rankTicketHits } from './rankHits';

// Enough to switch between projects without pushing the tickets out of sight.
export const PROJECTS_SHOWN = 6;

export type PaletteItem =
  | { kind: 'project'; id: string; route: Route; project: ProjectSummary }
  | { kind: 'ticket'; id: string; route: Route; hit: TicketSearchHit };

export interface PaletteSection {
  label: string;
  items: PaletteItem[];
}

const projectItem = (project: ProjectSummary): PaletteItem => ({
  kind: 'project',
  id: `search-project-${project.id}`,
  route: { name: 'project', key: project.key },
  project,
});

const ticketItem = (hit: TicketSearchHit): PaletteItem => ({
  kind: 'ticket',
  id: `search-ticket-${hit.key}`,
  route: { name: 'ticket', key: hit.projectKey, num: hit.num },
  hit,
});

export interface PaletteInput {
  projects: readonly ProjectSummary[];
  hits: readonly TicketSearchHit[];
  query: string;
  currentProjectKey: string | null;
}

// A ticket key typed in full puts its ticket above the projects, so Enter opens it.
export function paletteSections(input: PaletteInput): PaletteSection[] {
  const projects = matchProjects(input.projects, input.query).slice(0, PROJECTS_SHOWN);
  const tickets = rankTicketHits(input.hits, input.currentProjectKey);
  const empty = input.query.trim() === '';
  const sections: PaletteSection[] = [
    { label: 'Projects', items: projects.map(projectItem) },
    { label: empty ? 'Recent tickets' : 'Tickets', items: tickets.map(ticketItem) },
  ];
  const keyFirst = tickets[0]?.match === 'key';
  return (keyFirst ? sections.reverse() : sections).filter((section) => section.items.length > 0);
}

export const paletteItems = (sections: readonly PaletteSection[]): PaletteItem[] =>
  sections.flatMap((section) => section.items);

// Enter on a full key before its results arrive opens that ticket; an unknown one shows its
// project, as its link would.
export function keyRoute(text: string): Route | null {
  const key = parseKeyQuery(text);
  return key?.projectKey ? { name: 'ticket', key: key.projectKey, num: key.num } : null;
}
