import { projectDisplayName, type ProjectSummary } from '@tracker/shared';
import { findProject } from '../projects/projectLookup';

export interface ProjectChoice {
  key: string;
  name: string;
  color: string;
}

export const LAST_PROJECT_STORAGE_KEY = 'tracker.capture.project';

export const choiceOf = (project: ProjectSummary): ProjectChoice => ({
  key: project.key,
  name: projectDisplayName(project),
  color: project.color,
});

// No name in storage, so a name hidden later can't stay on the device; offline the key stands in.
function parseChoice(text: string | null): ProjectChoice | null {
  if (!text) return null;
  try {
    const value = JSON.parse(text) as Partial<Record<keyof ProjectChoice, unknown>> | null;
    const { key, color } = value ?? {};
    if (typeof key !== 'string' || typeof color !== 'string') return null;
    return { key, name: key, color };
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
    window.localStorage.setItem(
      LAST_PROJECT_STORAGE_KEY,
      JSON.stringify({ key: project.key, color: project.color }),
    );
  } catch {
    // Without storage the default still lands on this project: it is now the most recently active.
  }
}

// Offline there is no project list, but the last project used can still take a capture.
export const canCapture = (projects: readonly ProjectSummary[] | undefined): boolean =>
  projects ? projects.length > 0 : readLastProject() !== null;

export function projectChoices(
  projects: readonly ProjectSummary[] | undefined,
  remembered: ProjectChoice | null,
): ProjectChoice[] {
  if (projects) return projects.map(choiceOf);
  return remembered ? [remembered] : [];
}

const mostRecentlyActive = (projects: readonly ProjectSummary[]): ProjectSummary | undefined =>
  projects.reduce<ProjectSummary | undefined>(
    (best, project) => (!best || project.lastActivityAt > best.lastActivityAt ? project : best),
    undefined,
  );

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
