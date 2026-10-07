import type { Project, ProjectSummary } from '@tracker/shared';

interface WithProject {
  project: Project;
}

const sameKey = (a: string, b: string): boolean => a.toUpperCase() === b.toUpperCase();

const summaryOf = (project: Project): ProjectSummary => ({
  ...project,
  totalCount: 0,
  openCount: 0,
  doneCount: 0,
  lastActivityAt: project.createdAt,
});

export const appendProjectSummary = (list: ProjectSummary[], project: Project): ProjectSummary[] =>
  list.some((item) => item.id === project.id) ? list : [...list, summaryOf(project)];

export const removeProjectSummary = (
  list: ProjectSummary[],
  projectKey: string,
): ProjectSummary[] => list.filter((item) => !sameKey(item.key, projectKey));

export const patchProjectSummary = (list: ProjectSummary[], project: Project): ProjectSummary[] =>
  list.map((item) => (item.id === project.id ? { ...item, ...project } : item));

export const withProject = <T extends WithProject>(data: T, project: Project): T =>
  data.project.id === project.id ? { ...data, project: { ...data.project, ...project } } : data;

export const withNextNum = <T extends WithProject>(data: T, num: number): T =>
  num >= data.project.nextNum ? { ...data, project: { ...data.project, nextNum: num + 1 } } : data;
