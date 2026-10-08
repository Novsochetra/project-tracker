import type { ProjectSummary } from '@tracker/shared';
import { findProject } from '../projects/projectLookup';

export interface ProjectChoice {
  key: string;
  name: string;
  color: string;
}

export const LAST_PROJECT_STORAGE_KEY = 'tracker.capture.project';

const toChoice = ({ key, name, color }: ProjectChoice): ProjectChoice => ({ key, name, color });

function parseChoice(text: string | null): ProjectChoice | null {
  if (!text) return null;
  try {
    const value = JSON.parse(text) as Partial<Record<keyof ProjectChoice, unknown>> | null;
    const { key, name, color } = value ?? {};
    if (typeof key !== 'string' || typeof name !== 'string' || typeof color !== 'string') {
      return null;
    }
    return { key, name, color };
  } catch {
    return null;
  }
}

export function readLastProject(): ProjectChoice | null {
  try {
    return parseChoice(window.localStorage.getItem(LAST_PROJECT_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function rememberProject(project: ProjectChoice): void {
  try {
    window.localStorage.setItem(LAST_PROJECT_STORAGE_KEY, JSON.stringify(toChoice(project)));
  } catch {
    // Without storage the default still lands on this project: it is now the most recently active.
  }
}

/** Capture needs a project: one in the list or, offline without a list, the last one used. */
export const canCapture = (projects: readonly ProjectSummary[] | undefined): boolean =>
  projects ? projects.length > 0 : readLastProject() !== null;

/** The projects to pick from; offline without a project list, at least the last one used. */
export function projectChoices(
  projects: readonly ProjectSummary[] | undefined,
  remembered: ProjectChoice | null,
): ProjectChoice[] {
  if (projects) return projects.map(toChoice);
  return remembered ? [remembered] : [];
}

const mostRecentlyActive = (projects: readonly ProjectSummary[]): ProjectSummary | undefined =>
  projects.reduce<ProjectSummary | undefined>(
    (best, project) => (!best || project.lastActivityAt > best.lastActivityAt ? project : best),
    undefined,
  );

/** The last project used while it still exists, otherwise the most recently active one. */
export function defaultProjectKey(
  projects: readonly ProjectSummary[] | undefined,
  remembered: ProjectChoice | null,
): string | undefined {
  if (!projects) return remembered?.key;
  const last = remembered ? findProject(projects, remembered.key) : undefined;
  return (last ?? mostRecentlyActive(projects))?.key;
}

export function resolveProject(
  choices: readonly ProjectChoice[],
  chosenKey: string | null,
  defaultKey: string | undefined,
): ProjectChoice | undefined {
  const chosen = chosenKey === null ? undefined : findProject(choices, chosenKey);
  return chosen ?? (defaultKey === undefined ? undefined : findProject(choices, defaultKey));
}
