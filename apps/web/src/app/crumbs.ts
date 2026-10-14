import { projectDisplayName, type NamedProject } from '@tracker/shared';
import type { Route } from '../navigation';

export interface CrumbProject extends NamedProject {
  color: string;
}

export interface Crumb {
  level: Route['name'];
  label: string;
  target: Route | null;
  color?: string | undefined;
}

export const ASK_LABEL = 'Ask Claude';
export const NEW_CHAT_LABEL = 'New chat';

const PROJECTS: Route = { name: 'projects' };

type ProjectRoute = Exclude<Route, { name: 'projects' | 'activity' }>;

// A chat opened from a ticket sits under that ticket, as on phones.
function chatParentCrumb(route: Extract<Route, { name: 'chat' }>, key: string): Crumb {
  const num = route.ticketNum;
  if (num === undefined)
    return { level: 'chats', label: ASK_LABEL, target: { name: 'chats', key } };
  return { level: 'ticket', label: `${key}-${num}`, target: { name: 'ticket', key, num } };
}

function leafCrumbs(route: ProjectRoute, key: string, chatTitle: string | undefined): Crumb[] {
  switch (route.name) {
    case 'project':
      return [];
    case 'ticket':
      return [{ level: 'ticket', label: `${key}-${route.num}`, target: null }];
    case 'chats':
      return [{ level: 'chats', label: ASK_LABEL, target: null }];
    case 'chat':
      return [
        chatParentCrumb(route, key),
        { level: 'chat', label: chatTitle ?? NEW_CHAT_LABEL, target: null },
      ];
  }
}

// The chat's title comes from its own answer, so the header passes it once it has loaded.
export function breadcrumbFor(
  route: Route,
  project: CrumbProject | undefined,
  chatTitle?: string,
): Crumb[] {
  if (route.name === 'projects') return [{ level: 'projects', label: 'Projects', target: null }];
  if (route.name === 'activity') return [{ level: 'activity', label: 'Activity', target: null }];
  const key = project?.key ?? route.key.toUpperCase();
  const projectCrumb: Crumb = {
    level: 'project',
    label: project ? projectDisplayName(project) : key,
    color: project?.color,
    target: route.name === 'project' ? null : { name: 'project', key },
  };
  return [
    { level: 'projects', label: 'Projects', target: PROJECTS },
    projectCrumb,
    ...leafCrumbs(route, key, chatTitle),
  ];
}

export const projectKeyOf = (route: Route): string | null =>
  route.name === 'projects' || route.name === 'activity' ? null : route.key;
