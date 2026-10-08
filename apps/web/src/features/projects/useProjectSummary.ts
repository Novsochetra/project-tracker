import type { ProjectSummary } from '@tracker/shared';
import { useProjects } from '../../api';
import { findProject } from './projectLookup';

export function useProjectSummary(projectKey: string): ProjectSummary | undefined {
  return findProject(useProjects().data, projectKey);
}
