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

const PROJECTS: Route = { name: 'projects' };

export function breadcrumbFor(route: Route, project: CrumbProject | undefined): Crumb[] {
  if (route.name === 'projects') return [{ level: 'projects', label: 'Projects', target: null }];
  const key = project?.key ?? route.key.toUpperCase();
  const projectCrumb: Crumb = {
    level: 'project',
    label: project?.name ?? key,
    color: project?.color,
    target: route.name === 'ticket' ? { name: 'project', key } : null,
  };
  const crumbs: Crumb[] = [
    { level: 'projects', label: 'Projects', target: PROJECTS },
    projectCrumb,
  ];
  if (route.name === 'project') return crumbs;
  return [...crumbs, { level: 'ticket', label: `${key}-${route.num}`, target: null }];
}

export const projectKeyOf = (route: Route): string | null =>
  route.name === 'projects' ? null : route.key;
