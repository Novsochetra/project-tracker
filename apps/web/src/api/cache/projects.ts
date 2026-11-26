import type { Project, ProjectSummary } from '@tracker/shared';

interface WithProject {
  project: Project;
}

const sameKey = (left: string, right: string): boolean =>
  left.toUpperCase() === right.toUpperCase();

const summaryOf = (project: Project): ProjectSummary => ({
  ...project,
  totalCount: 0,
  openCount: 0,
  doneCount: 0,
  reviewedCount: 0,
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

// A project the order doesn't name, such as one made in another tab meanwhile, stays after it.
export function reorderProjectSummaries(
  list: readonly ProjectSummary[],
  ids: readonly string[],
): ProjectSummary[] {
  const order = new Map(ids.map((id, index) => [id, index]));
  const place = (item: ProjectSummary, index: number) => order.get(item.id) ?? ids.length + index;

  return list
    .map((item, index) => ({ item, at: place(item, index) }))
    .sort((left, right) => left.at - right.at)
    .map(({ item }) => item);
}
