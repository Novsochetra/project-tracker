import type { Route } from '../navigation';

export interface CrumbProject {
  name: string;
  key: string;
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

type ProjectRoute = Exclude<Route, { name: 'projects' }>;

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
        { level: 'chats', label: ASK_LABEL, target: { name: 'chats', key } },
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
  const key = project?.key ?? route.key.toUpperCase();
  const projectCrumb: Crumb = {
    level: 'project',
    label: project?.name ?? key,
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
  route.name === 'projects' ? null : route.key;
