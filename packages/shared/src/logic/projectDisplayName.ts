import type { Project } from '../domain/project';

export type NamedProject = Pick<Project, 'name' | 'key' | 'hideName'>;

// The key stays: every ticket key on screen shows it anyway.
export const hiddenProjectName = (key: string): string => `Project ${key}`;

export const projectDisplayName = ({ name, key, hideName }: NamedProject): string =>
  hideName ? hiddenProjectName(key) : name;
