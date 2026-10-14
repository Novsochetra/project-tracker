import type { Project } from '../domain/project';

export type NamedProject = Pick<Project, 'name' | 'key' | 'hideName'>;
export type PlacedProject = Pick<Project, 'repo' | 'hideName'>;

// The key stays: every ticket key on screen shows it anyway.
export const hiddenProjectName = (key: string): string => `Project ${key}`;

export const projectDisplayName = ({ name, key, hideName }: NamedProject): string =>
  hideName ? hiddenProjectName(key) : name;

// A folder path often names the project too.
export const projectDisplayRepo = ({ repo, hideName }: PlacedProject): string =>
  hideName ? '' : repo;
