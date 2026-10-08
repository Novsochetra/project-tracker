import { ProjectOptionsMenu } from './ProjectOptionsMenu';
import { ProjectOptionsSheet } from './ProjectOptionsSheet';

export interface ProjectOptionsButtonProps {
  projectKey: string;
  placement: 'header' | 'navbar';
}

/** Desktop header: ••• popover. Phone nav bar: ••• action sheet. */
export function ProjectOptionsButton({ projectKey, placement }: ProjectOptionsButtonProps) {
  return placement === 'header' ? (
    <ProjectOptionsMenu projectKey={projectKey} />
  ) : (
    <ProjectOptionsSheet projectKey={projectKey} />
  );
}
