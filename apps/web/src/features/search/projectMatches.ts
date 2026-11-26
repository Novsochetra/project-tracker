import { projectDisplayName, searchTerms, type NamedProject } from '@tracker/shared';

const textOf = (project: NamedProject) =>
  `${projectDisplayName(project)} ${project.key}`.toLowerCase();

function scoreOf(project: NamedProject, query: string): number {
  const key = project.key.toLowerCase();
  if (key === query) return 0;
  const name = projectDisplayName(project).toLowerCase();

  return name.startsWith(query) || key.startsWith(query) ? 1 : 2;
}

// Every word in the name or the key; the key itself first, then names that start with the query.
// A hidden name is matched as shown, so a search never reveals it.
export function matchProjects<T extends NamedProject>(projects: readonly T[], query: string): T[] {
  const terms = searchTerms(query);
  if (terms.length === 0) return [...projects];
  const text = query.trim().toLowerCase();

  return projects
    .filter((project) => terms.every((term) => textOf(project).includes(term)))
    .map((project, index) => ({ project, index, score: scoreOf(project, text) }))
    .sort((left, right) => left.score - right.score || left.index - right.index)
    .map(({ project }) => project);
}
