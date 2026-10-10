import { resolve } from 'node:path';

export interface ProjectRepo {
  key: string;
  repo: string;
}

export class WatchSetupError extends Error {
  override name = 'WatchSetupError';
}

const inFolder = (repo: string, home: string): string =>
  resolve(repo.startsWith('~/') ? `${home}${repo.slice(1)}` : repo);

export function pickProject(
  projects: readonly ProjectRepo[],
  folder: { cwd: string; home: string },
  wanted?: string,
): string {
  if (wanted !== undefined) {
    const key = wanted.trim().toUpperCase();
    if (projects.some((project) => project.key === key)) return key;
    throw new WatchSetupError(`Project ${key} was not found on this tracker.`);
  }
  const here = resolve(folder.cwd);
  const matches = projects.filter(
    (project) => project.repo.trim() && inFolder(project.repo.trim(), folder.home) === here,
  );
  if (matches.length === 1) return matches[0]!.key;
  const keys = matches.map((project) => project.key).join(', ');
  throw new WatchSetupError(
    matches.length === 0
      ? 'No project has this folder as its repo. Name it: tracker watch <PROJECT>.'
      : `Several projects use this folder (${keys}). Name one: tracker watch <PROJECT>.`,
  );
}
