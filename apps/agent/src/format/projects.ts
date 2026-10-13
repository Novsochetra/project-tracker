import { openNotReviewed, type ProjectSummary } from '@tracker/shared';
import { SEP } from './text';

export function formatProjectLine(project: ProjectSummary): string {
  const reviewed = project.reviewedCount ?? 0;
  const parts = [
    project.key,
    project.name,
    `${openNotReviewed(project.openCount, reviewed)} open, ${reviewed} reviewed, ${project.totalCount} total`,
  ];
  if (project.repo) parts.push(`repo ${project.repo}`);
  return parts.join(SEP);
}

export function formatProjects(projects: readonly ProjectSummary[]): string {
  if (projects.length === 0) return 'No projects yet.';
  return projects.map(formatProjectLine).join('\n');
}
