import { ProjectOptionsMenu } from './ProjectOptionsMenu';
import { ProjectOptionsSheet } from './ProjectOptionsSheet';

export interface ProjectOptionsButtonProps {
  projectKey: string;
  placement: 'header' | 'navbar';
}

export function ProjectOptionsButton({ projectKey, placement }: ProjectOptionsButtonProps) {
  return placement === 'header' ? (
    <ProjectOptionsMenu projectKey={projectKey} />
  ) : (
    <ProjectOptionsSheet projectKey={projectKey} />
  );
}
